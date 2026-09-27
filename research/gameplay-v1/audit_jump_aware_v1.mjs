#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateManifest } from '../../src/track/loader.js';
import { MusicDirector } from '../../src/logic/director.js';
import { Difficulty } from '../../src/logic/difficulty.js';
import { RowGenerator, rowIsSurvivable } from '../../src/logic/spawner.js';

const SPEC_COMMIT = '13c0e663344db3861bae8fb2ddee9f61bb9ba096';
const SCHEMA = 'trackcade-gameplay-jump-aware-v1';
const BASELINE_SCHEMA = 'trackcade-gameplay-qc-v1';
const VIEW_Z = 560;
const PLAYER_Z = 26;
const HIT_DEPTH = 10;
const CULL_Z = -30;
const OBSTACLE_POOL = 28;
const PICKUP_POOL = 24;
const SAMPLE_DT = 1 / 240;
const EPS = 1e-9;

function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
function getArg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
}
function overdriveAt(cfg, t) {
  let activeUntil = -Infinity;
  for (const e of cfg.events) {
    if (e.t > t) break;
    if (e.kind === 'drop') activeUntil = e.t + (e.duration ?? 12);
  }
  return t < activeUntil;
}
function energyLevelAt(cfg, t) {
  let n = 0;
  for (const e of cfg.events) {
    if (e.t > t) break;
    if (e.kind === 'energy') n++;
  }
  return n;
}
function buildDistanceTable(cfg) {
  const ramp = new Difficulty(cfg);
  const horizon = cfg.songLength + 15;
  const times = [0];
  const cumulative = [0];
  let t = 0;
  while (t < horizon - 1e-12) {
    const next = Math.min(horizon, t + SAMPLE_DT);
    ramp.energyLevel = energyLevelAt(cfg, t);
    const s0 = ramp.speed(t, overdriveAt(cfg, t));
    ramp.energyLevel = energyLevelAt(cfg, next);
    const s1 = ramp.speed(next, overdriveAt(cfg, next));
    if (!finite(s0) || !finite(s1) || s0 <= 0 || s1 <= 0) throw new Error('nonfinite/nonpositive runtime speed');
    cumulative.push(cumulative[cumulative.length - 1] + 0.5 * (s0 + s1) * (next - t));
    times.push(next);
    t = next;
  }
  return { times, cumulative };
}
function interpCumulative(table, t) {
  const { times, cumulative } = table;
  if (t <= 0) return 0;
  if (t >= times[times.length - 1]) return cumulative[cumulative.length - 1];
  let lo = 0, hi = times.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid; else hi = mid;
  }
  const f = (t - times[lo]) / (times[hi] - times[lo]);
  return cumulative[lo] + f * (cumulative[hi] - cumulative[lo]);
}
function timeAtDistanceAfter(table, startT, distance) {
  const startD = interpCumulative(table, startT);
  const target = startD + distance;
  const { times, cumulative } = table;
  let lo = 0;
  while (lo < cumulative.length && cumulative[lo] < startD) lo++;
  if (cumulative[cumulative.length - 1] < target) return null;
  let left = Math.max(0, lo - 1), right = cumulative.length - 1;
  while (left + 1 < right) {
    const mid = (left + right) >> 1;
    if (cumulative[mid] < target) left = mid; else right = mid;
  }
  const d0 = cumulative[left], d1 = cumulative[right];
  const f = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
  return times[left] + f * (times[right] - times[left]);
}
function maxConcurrent(rows, key) {
  const events = [];
  for (const r of rows) {
    const count = r[key];
    if (!count) continue;
    events.push([r.spawnTime, +count]);
    events.push([r.cullTime, -count]);
  }
  events.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let n = 0, max = 0, at = 0;
  for (const [t, d] of events) {
    n += d;
    if (n > max) { max = n; at = t; }
  }
  return { max, at };
}
function laneOnlyPath(cfg, rows) {
  const initialLane = Math.floor(cfg.lanes / 2);
  let dp = new Set([initialLane]);
  let previousCollision = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const blocked = new Set(row.obstacles.map(o => o.lane));
    const safe = [...Array(cfg.lanes).keys()].filter(l => !blocked.has(l));
    if (!safe.length) return false;
    const available = i === 0 ? row.collisionTime - row.spawnTime : row.collisionTime - previousCollision;
    const next = new Set();
    for (const b of safe) {
      for (const a of dp) {
        if (Math.abs(a - b) * cfg.laneSwitchTime <= available + EPS) {
          next.add(b);
          break;
        }
      }
    }
    if (!next.size) return false;
    dp = next;
    previousCollision = row.collisionTime;
  }
  return true;
}
function buildRows(cfg) {
  const director = new MusicDirector(cfg, cfg.songLength + 5);
  const beatTimes = director.beatTimes.filter(t => finite(t) && t >= 0 && t <= cfg.songLength + EPS);
  const table = buildDistanceTable(cfg);
  const rowGen = new RowGenerator(cfg);
  const ramp = new Difficulty(cfg);
  const rows = [];
  let beatCount = 0;
  let rowIndex = 0;
  for (const t of beatTimes) {
    beatCount++;
    if (beatCount % cfg.spawnRowEveryBeats !== 0) continue;
    ramp.energyLevel = energyLevelAt(cfg, t);
    const od = overdriveAt(cfg, t);
    const intensity = ramp.spawnIntensity(t, t);
    const row = rowGen.row(rowIndex * 7919 + 13, intensity, od);
    const entryTime = timeAtDistanceAfter(table, t, VIEW_Z - (PLAYER_Z + HIT_DEPTH));
    const collisionTime = timeAtDistanceAfter(table, t, VIEW_Z - PLAYER_Z);
    const exitTime = timeAtDistanceAfter(table, t, VIEW_Z - (PLAYER_Z - HIT_DEPTH));
    const cullTime = timeAtDistanceAfter(table, t, VIEW_Z - CULL_Z);
    if (![entryTime, collisionTime, exitTime, cullTime].every(finite) ||
        !(t < entryTime && entryTime < collisionTime && collisionTime < exitTime && exitTime < cullTime)) {
      throw new Error(`invalid travel timing row ${rowIndex}`);
    }
    rows.push({
      rowIndex,
      spawnTime: t,
      entryTime,
      collisionTime,
      exitTime,
      cullTime,
      obstacles: row.obstacles,
      pickups: row.pickups,
      obstacleCount: row.obstacles.length,
      pickupCount: row.pickups.length,
      rowSurvivable: rowIsSurvivable(row, cfg.lanes),
    });
    rowIndex++;
  }
  return { beatTimes, rows };
}
function laneRequirement(row, lane, clearStartRel, clearEndRel, jumpHeight) {
  const obs = row.obstacles.filter(o => o.lane === lane);
  if (!obs.length) return { kind: 'free' };
  if (obs.some(o => o.kind === 'wall')) return { kind: 'wall' };
  if (jumpHeight <= 20) return { kind: 'low', feasible: false, lower: null, upper: null };
  const lower = Math.max(0, row.exitTime - clearEndRel + EPS);
  const upper = row.entryTime - clearStartRel - EPS;
  return { kind: 'low', feasible: lower <= upper, lower, upper };
}
function candidateStarts(cfg, rows) {
  if (cfg.jumpHeight <= 20) return { starts: [], clearStartRel: null, clearEndRel: null };
  const alpha = Math.asin(20 / cfg.jumpHeight) / Math.PI;
  const clearStartRel = alpha * cfg.jumpTime;
  const clearEndRel = (1 - alpha) * cfg.jumpTime;
  const raw = [];
  for (const row of rows) {
    for (let lane = 0; lane < cfg.lanes; lane++) {
      const req = laneRequirement(row, lane, clearStartRel, clearEndRel, cfg.jumpHeight);
      if (req.kind !== 'low' || !req.feasible) continue;
      raw.push(req.lower, req.upper, (req.lower + req.upper) / 2);
    }
  }
  const keyed = new Map();
  for (const x of raw) {
    if (!finite(x) || x < 0) continue;
    const key = x.toFixed(12);
    if (!keyed.has(key)) keyed.set(key, x);
  }
  const starts = [...keyed.values()].sort((a, b) => a - b);
  return { starts, clearStartRel, clearEndRel };
}
function covers(start, req) {
  return req.kind === 'low' && req.feasible && start >= req.lower - EPS && start <= req.upper + EPS;
}
function lowerBound(a, x) {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}
function pruneExpiredStates(states, starts, clearEndRel, nextEntry) {
  if (!finite(nextEntry) || clearEndRel === null) return states;
  const lanes = new Map();
  for (const state of states.values()) {
    if (!lanes.has(state.lane)) lanes.set(state.lane, { noJump: null, active: [], expired: [] });
    const bucket = lanes.get(state.lane);
    if (state.jumpIdx < 0) {
      bucket.noJump = state;
    } else if (starts[state.jumpIdx] + clearEndRel >= nextEntry - EPS) {
      bucket.active.push(state);
    } else {
      bucket.expired.push(state);
    }
  }
  const out = new Map();
  for (const [lane, bucket] of lanes) {
    if (bucket.noJump) out.set(`${lane}|-1`, bucket.noJump);
    for (const state of bucket.active) out.set(`${lane}|${state.jumpIdx}`, state);
    // Once a jump can no longer clear the next or any later row, its only
    // remaining effect is when a future jump may begin. No-jump dominates all
    // expired jumps; otherwise the earliest expired jump dominates later ones.
    if (!bucket.noJump && bucket.expired.length) {
      let best = bucket.expired[0];
      for (const state of bucket.expired) {
        if (starts[state.jumpIdx] < starts[best.jumpIdx]) best = state;
      }
      out.set(`${lane}|${best.jumpIdx}`, best);
    }
  }
  return out;
}
function jumpAwarePath(cfg, rows) {
  const { starts, clearStartRel, clearEndRel } = candidateStarts(cfg, rows);
  const initialLane = Math.floor(cfg.lanes / 2);
  let states = new Map([[`${initialLane}|-1`, { lane: initialLane, jumpIdx: -1 }]]);
  let previousCollision = 0;
  let maxStates = states.size;
  let maxStatesBeforePrune = states.size;
  let firstDeadRow = null;
  let lowTransitions = 0;
  let newJumpTransitions = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const available = i === 0 ? row.collisionTime - row.spawnTime : row.collisionTime - previousCollision;
    const next = new Map();
    const requirements = [...Array(cfg.lanes).keys()].map(lane =>
      laneRequirement(row, lane, clearStartRel, clearEndRel, cfg.jumpHeight));

    for (const state of states.values()) {
      for (let lane = 0; lane < cfg.lanes; lane++) {
        if (Math.abs(state.lane - lane) * cfg.laneSwitchTime > available + EPS) continue;
        const req = requirements[lane];
        if (req.kind === 'wall') continue;

        if (req.kind === 'free') {
          const key = `${lane}|${state.jumpIdx}`;
          if (!next.has(key)) next.set(key, { lane, jumpIdx: state.jumpIdx });
          continue;
        }

        if (!req.feasible) continue;
        lowTransitions++;

        if (state.jumpIdx >= 0 && covers(starts[state.jumpIdx], req)) {
          const key = `${lane}|${state.jumpIdx}`;
          if (!next.has(key)) next.set(key, { lane, jumpIdx: state.jumpIdx });
        }

        const readyTime = state.jumpIdx >= 0 ? starts[state.jumpIdx] + cfg.jumpTime : 0;
        const first = lowerBound(starts, Math.max(req.lower - EPS, readyTime - EPS));
        for (let j = first; j < starts.length; j++) {
          const s = starts[j];
          if (s > req.upper + EPS) break;
          if (s + EPS < readyTime) continue;
          const key = `${lane}|${j}`;
          if (!next.has(key)) {
            next.set(key, { lane, jumpIdx: j });
            newJumpTransitions++;
          }
        }
      }
    }

    if (!next.size) {
      firstDeadRow = {
        rowIndex: i,
        collisionTime: row.collisionTime,
        entryTime: row.entryTime,
        exitTime: row.exitTime,
        previousStateCount: states.size,
        laneRequirements: requirements.map((r, lane) => ({ lane, ...r })),
      };
      states = next;
      break;
    }
    maxStatesBeforePrune = Math.max(maxStatesBeforePrune, next.size);
    const nextEntry = i + 1 < rows.length ? rows[i + 1].entryTime : Infinity;
    states = pruneExpiredStates(next, starts, clearEndRel, nextEntry);
    maxStates = Math.max(maxStates, states.size);
    previousCollision = row.collisionTime;
  }

  return {
    pass: states.size > 0 && firstDeadRow === null,
    rowsEvaluated: firstDeadRow ? firstDeadRow.rowIndex : rows.length,
    candidateJumpStarts: starts.length,
    clearWindowRelativeToJumpStart: clearStartRel === null ? null : {
      strictlyAboveHeight: 20,
      start: clearStartRel,
      end: clearEndRel,
      duration: clearEndRel - clearStartRel,
    },
    maxReachableStates: maxStates,
    maxReachableStatesBeforeDominancePrune: maxStatesBeforePrune,
    finalStateCount: states.size,
    lowTransitionsConsidered: lowTransitions,
    newJumpTransitionsMaterialized: newJumpTransitions,
    firstDeadRow,
  };
}
function runBaseline(manifestPath, label) {
  const auditPath = fileURLToPath(new URL('./audit_gameplay_v1.mjs', import.meta.url));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trackcade-jump-baseline-'));
  const out = path.join(tmp, 'baseline.json');
  const run = spawnSync(process.execPath, [
    auditPath,
    '--manifest', manifestPath,
    '--output', out,
    '--label', `${label}::baseline`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`baseline auditor failed (${run.status})\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  const baseline = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(tmp, { recursive: true, force: true });
  if (baseline.schema !== BASELINE_SCHEMA) throw new Error(`unexpected baseline schema ${baseline.schema}`);
  return baseline;
}
function main() {
  const args = process.argv.slice(2);
  const manifestArg = getArg(args, '--manifest');
  const outputArg = getArg(args, '--output');
  const label = getArg(args, '--label') ?? manifestArg;
  if (!manifestArg || !outputArg) {
    console.error('usage: audit_jump_aware_v1.mjs --manifest file.json --output result.json [--label name]');
    process.exit(64);
  }

  const manifestPath = path.resolve(manifestArg);
  const outputPath = path.resolve(outputArg);
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const cfg = validateManifest(raw);
  const baseline = runBaseline(manifestPath, label);
  const { beatTimes, rows } = buildRows(cfg);
  const obstaclePool = maxConcurrent(rows, 'obstacleCount');
  const pickupPool = maxConcurrent(rows, 'pickupCount');
  const reconstructedLaneOnly = laneOnlyPath(cfg, rows);
  const reconstructed = {
    beats: beatTimes.length,
    rows: rows.length,
    obstacles: rows.reduce((s, r) => s + r.obstacleCount, 0),
    pickups: rows.reduce((s, r) => s + r.pickupCount, 0),
    obstaclePoolMax: obstaclePool.max,
    pickupPoolMax: pickupPool.max,
    laneOnlyPass: reconstructedLaneOnly,
    everyRowIndividuallySurvivable: rows.every(r => r.rowSurvivable),
  };
  const expected = {
    beats: baseline.counts.beats,
    rows: baseline.counts.rows,
    obstacles: baseline.counts.obstacles,
    pickups: baseline.counts.pickups,
    obstaclePoolMax: baseline.pools.obstacles.max,
    pickupPoolMax: baseline.pools.pickups.max,
    laneOnlyPass: baseline.laneOnlyProof.pass,
    everyRowIndividuallySurvivable: baseline.integrity.everyRowIndividuallySurvivable,
  };
  const checks = Object.fromEntries(Object.keys(expected).map(k => [k, Object.is(reconstructed[k], expected[k])]));
  const modelMatches = Object.values(checks).every(Boolean);

  let status;
  let proof = null;
  if (!modelMatches) {
    status = 'model_mismatch';
  } else if (baseline.status === 'pool_overflow_risk' || baseline.status === 'invalid_generation') {
    status = 'out_of_scope';
  } else {
    proof = jumpAwarePath(cfg, rows);
    status = proof.pass ? 'jump_aware_pass' : 'jump_aware_unresolved';
  }

  const result = {
    schema: SCHEMA,
    preregistrationCommit: SPEC_COMMIT,
    label,
    status,
    source: baseline.source,
    runtime: {
      lanes: cfg.lanes,
      spawnRowEveryBeats: cfg.spawnRowEveryBeats,
      laneSwitchTime: cfg.laneSwitchTime,
      jumpTime: cfg.jumpTime,
      jumpHeight: cfg.jumpHeight,
      baseSpeed: cfg.baseSpeed,
      maxSpeed: cfg.maxSpeed,
      speedRampPerSec: cfg.speedRampPerSec,
      hitDepth: HIT_DEPTH,
      lowClearHeightStrictlyGreaterThan: 20,
      obstaclePoolCapacity: OBSTACLE_POOL,
      pickupPoolCapacity: PICKUP_POOL,
    },
    baseline: {
      status: baseline.status,
      laneOnlyPass: baseline.laneOnlyProof.pass,
      counts: baseline.counts,
      pools: baseline.pools,
    },
    selfConsistency: { pass: modelMatches, checks, expected, reconstructed },
    proof,
  };
  writeJson(outputPath, result);
  console.log(JSON.stringify({
    label,
    status,
    baselineStatus: baseline.status,
    baselineLaneOnlyPass: baseline.laneOnlyProof.pass,
    modelMatches,
    candidateJumpStarts: proof?.candidateJumpStarts ?? null,
    maxReachableStates: proof?.maxReachableStates ?? null,
    firstDeadRow: proof?.firstDeadRow?.rowIndex ?? null,
  }, null, 2));
}

main();
