#!/usr/bin/env node
import fs from 'node:fs';
import { validateManifest } from '../../src/track/loader.js';
import { MusicDirector } from '../../src/logic/director.js';
import { Difficulty } from '../../src/logic/difficulty.js';
import { RowGenerator, rowIsSurvivable } from '../../src/logic/spawner.js';

const VIEW_Z = 560;
const PLAYER_Z = 26;
const CULL_Z = -30;
const COLLISION_DISTANCE = VIEW_Z - PLAYER_Z;
const CULL_DISTANCE = VIEW_Z - CULL_Z;
const OBSTACLE_POOL = 28;
const PICKUP_POOL = 24;
const SAMPLE_DT = 1 / 240;

function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
function q(sorted, p) {
  if (!sorted.length) return null;
  const x = (sorted.length - 1) * p;
  const lo = Math.floor(x), hi = Math.ceil(x), f = x - lo;
  return sorted[lo] * (1 - f) + sorted[hi] * f;
}
function stats(values) {
  const a = values.filter(finite).sort((x, y) => x - y);
  if (!a.length) return { count: 0, min: null, p01: null, p05: null, median: null, p95: null, max: null, mean: null };
  return {
    count: a.length,
    min: a[0], p01: q(a, .01), p05: q(a, .05), median: q(a, .5), p95: q(a, .95), max: a[a.length - 1],
    mean: a.reduce((s, x) => s + x, 0) / a.length,
  };
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
  let prevSpeed = null;
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
    prevSpeed = s1;
  }
  return { times, cumulative, finalSpeed: prevSpeed };
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
  let hi = cumulative.length - 1;
  if (cumulative[hi] < target) return null;
  let left = Math.max(0, lo - 1), right = hi;
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
  events.sort((a, b) => a[0] - b[0] || b[1] - a[1]); // conservative: additions first on exact tie
  let n = 0, max = 0, at = 0;
  for (const [t, d] of events) {
    n += d;
    if (n > max) { max = n; at = t; }
  }
  return { max, at };
}
function laneOnlyPath(cfg, rows) {
  const initialLane = Math.floor(cfg.lanes / 2);
  let dp = new Map([[initialLane, Infinity]]); // lane -> max bottleneck slack
  let previousCollision = 0;
  let failure = null;
  const chosenLayers = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const blocked = new Set(row.obstacles.map(o => o.lane)); // low is conservatively blocked too
    const safe = [...Array(cfg.lanes).keys()].filter(l => !blocked.has(l));
    if (!safe.length) {
      failure = { rowIndex: i, reason: 'no_obstacle_free_lane', collisionTime: row.collisionTime };
      break;
    }
    const available = i === 0 ? row.collisionTime - row.spawnTime : row.collisionTime - previousCollision;
    const next = new Map();
    for (const b of safe) {
      let best = -Infinity;
      for (const [a, bottleneck] of dp) {
        const need = Math.abs(a - b) * cfg.laneSwitchTime;
        const slack = available - need;
        if (slack >= -1e-9) best = Math.max(best, Math.min(bottleneck, slack));
      }
      if (best > -Infinity) next.set(b, best);
    }
    if (!next.size) {
      failure = {
        rowIndex: i, reason: 'lane_switch_time_insufficient', collisionTime: row.collisionTime,
        previousCollisionTime: previousCollision, availableSeconds: available, safeLanes: safe,
        reachablePreviousLanes: [...dp.keys()],
      };
      break;
    }
    dp = next;
    previousCollision = row.collisionTime;
    chosenLayers.push({ rowIndex: i, safeLanes: safe, reachableLanes: [...dp.keys()] });
  }
  return {
    pass: !failure,
    bottleneckSlackSeconds: dp.size ? Math.max(...dp.values()) : null,
    finalReachableLanes: [...dp.keys()],
    failure,
    layersEvaluated: chosenLayers.length,
  };
}
function main() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const manifestPath = get('--manifest');
  const outputPath = get('--output');
  const label = get('--label') ?? manifestPath;
  if (!manifestPath || !outputPath) throw new Error('usage: audit_gameplay_v1.mjs --manifest file.json --output audit.json [--label name]');
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const cfg = validateManifest(raw);
  const director = new MusicDirector(cfg, cfg.songLength + 5);
  const beatTimes = director.beatTimes.filter(t => finite(t) && t >= 0 && t <= cfg.songLength + 1e-9);
  const beatIntervals = beatTimes.slice(1).map((t, i) => t - beatTimes[i]);
  if (beatIntervals.some(x => !finite(x) || x <= 0)) throw new Error('nonfinite/nonpositive beat interval');

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
    const collisionTime = timeAtDistanceAfter(table, t, COLLISION_DISTANCE);
    const cullTime = timeAtDistanceAfter(table, t, CULL_DISTANCE);
    if (!finite(collisionTime) || !finite(cullTime) || collisionTime <= t || cullTime <= collisionTime) {
      throw new Error(`invalid travel timing row ${rowIndex}`);
    }
    rows.push({
      rowIndex, spawnTime: t, collisionTime, cullTime,
      leadTime: collisionTime - t,
      speedAtSpawn: (() => { ramp.energyLevel = energyLevelAt(cfg, t); return ramp.speed(t, od); })(),
      intensity, overdrive: od,
      obstacles: row.obstacles,
      pickups: row.pickups,
      obstacleCount: row.obstacles.length,
      pickupCount: row.pickups.length,
      rowSurvivable: rowIsSurvivable(row, cfg.lanes),
    });
    rowIndex++;
  }
  const arrivalGaps = rows.slice(1).map((r, i) => r.collisionTime - rows[i].collisionTime);
  const leadTimes = rows.map(r => r.leadTime);
  const spawnGaps = rows.slice(1).map((r, i) => r.spawnTime - rows[i].spawnTime);
  const spatialSpawnGaps = rows.slice(1).map((r, i) => interpCumulative(table, r.spawnTime) - interpCumulative(table, rows[i].spawnTime));
  const obstaclePool = maxConcurrent(rows, 'obstacleCount');
  const pickupPool = maxConcurrent(rows, 'pickupCount');
  const lanePath = laneOnlyPath(cfg, rows);
  const individuallySurvivable = rows.every(r => r.rowSurvivable);
  const collisionStrict = rows.every((r, i) => i === 0 || r.collisionTime > rows[i - 1].collisionTime);
  const finiteRows = rows.every(r => [r.spawnTime, r.collisionTime, r.cullTime, r.leadTime, r.speedAtSpawn, r.intensity].every(finite));
  let status = 'qc_pass';
  if (!finiteRows || !collisionStrict || !individuallySurvivable) status = 'invalid_generation';
  else if (obstaclePool.max > OBSTACLE_POOL || pickupPool.max > PICKUP_POOL) status = 'pool_overflow_risk';
  else if (!lanePath.pass) status = 'needs_jump_aware_analysis';

  const result = {
    schema: 'trackcade-gameplay-qc-v1', label, status,
    source: {
      artist: cfg.artist, title: cfg.title, songLength: cfg.songLength, bpm: cfg.bpm,
      authoredBeatGrid: cfg.events.filter(e => e.kind === 'beat').length >= 2,
      timingTier: raw?.generation?.timingTier ?? null,
      analysisJsonSha256: raw?.generation?.analysisJsonSha256 ?? null,
    },
    runtime: {
      lanes: cfg.lanes, spawnRowEveryBeats: cfg.spawnRowEveryBeats,
      laneSwitchTime: cfg.laneSwitchTime, jumpTime: cfg.jumpTime,
      baseSpeed: cfg.baseSpeed, maxSpeed: cfg.maxSpeed, speedRampPerSec: cfg.speedRampPerSec,
      obstaclePoolCapacity: OBSTACLE_POOL, pickupPoolCapacity: PICKUP_POOL,
      spawnMinGapZConfigured: cfg.spawnMinGapZ,
      spawnMinGapZEnforcedByCurrentBeatSpawnPath: false,
    },
    counts: {
      beats: beatTimes.length, rows: rows.length,
      obstacles: rows.reduce((s, r) => s + r.obstacleCount, 0),
      pickups: rows.reduce((s, r) => s + r.pickupCount, 0),
      overdriveRows: rows.filter(r => r.overdrive).length,
      individuallySurvivableRows: rows.filter(r => r.rowSurvivable).length,
    },
    timing: {
      beatIntervals: stats(beatIntervals), spawnGaps: stats(spawnGaps),
      rowArrivalGaps: stats(arrivalGaps), spawnToCollisionLead: stats(leadTimes),
      spatialGapBetweenRowSpawns: stats(spatialSpawnGaps),
    },
    intensity: stats(rows.map(r => r.intensity)),
    speedAtSpawn: stats(rows.map(r => r.speedAtSpawn)),
    laneOnlyProof: lanePath,
    pools: {
      obstacles: { ...obstaclePool, capacity: OBSTACLE_POOL, overflow: obstaclePool.max > OBSTACLE_POOL },
      pickups: { ...pickupPool, capacity: PICKUP_POOL, overflow: pickupPool.max > PICKUP_POOL, note: 'row-generator pickups only; peak spiral modeled in later semantic QC' },
    },
    integrity: { finiteRows, collisionTimesStrictlyIncreasing: collisionStrict, everyRowIndividuallySurvivable: individuallySurvivable },
    sampleRows: rows.slice(0, 8),
  };
  fs.mkdirSync(new URL('.', `file://${outputPath}`).pathname, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({
    label, status, beats: result.counts.beats, rows: result.counts.rows,
    minArrivalGap: result.timing.rowArrivalGaps.min,
    laneOnlyPass: result.laneOnlyProof.pass,
    bottleneckSlack: result.laneOnlyProof.bottleneckSlackSeconds,
    maxObstaclePool: result.pools.obstacles.max,
    maxPickupPool: result.pools.pickups.max,
  }, null, 2));
}

main();
