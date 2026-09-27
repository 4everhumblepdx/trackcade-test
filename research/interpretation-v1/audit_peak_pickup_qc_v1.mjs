#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateManifest } from '../../src/track/loader.js';
import { MusicDirector } from '../../src/logic/director.js';
import { Difficulty } from '../../src/logic/difficulty.js';
import { RowGenerator } from '../../src/logic/spawner.js';

const VIEW_Z = 560;
const CULL_Z = -30;
const CULL_DISTANCE = VIEW_Z - CULL_Z;
const PICKUP_POOL = 24;
const SAMPLE_DT = 1 / 240;
const CURRENT_RUNTIME_PEAK_ORBS = 13;
const QUEUE_CAP_PEAK_ORBS = 14;

function finite(x) {
  return typeof x === 'number' && Number.isFinite(x);
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
    if (!finite(s0) || !finite(s1) || s0 <= 0 || s1 <= 0) {
      throw new Error('nonfinite/nonpositive runtime speed');
    }
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
  let lo = 0;
  let hi = times.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
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
  const hi = cumulative.length - 1;
  if (cumulative[hi] < target) return null;
  let left = Math.max(0, lo - 1);
  let right = hi;
  while (left + 1 < right) {
    const mid = (left + right) >> 1;
    if (cumulative[mid] < target) left = mid;
    else right = mid;
  }
  const d0 = cumulative[left];
  const d1 = cumulative[right];
  const f = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
  return times[left] + f * (times[right] - times[left]);
}

function maxConcurrentIntervals(intervals) {
  const events = [];
  for (const item of intervals) {
    if (!item.count) continue;
    events.push([item.spawnTime, +item.count]);
    events.push([item.cullTime, -item.count]);
  }
  events.sort((a, b) => a[0] - b[0] || b[1] - a[1]); // conservative: additions first on exact tie
  let n = 0;
  let max = 0;
  let at = 0;
  for (const [t, d] of events) {
    n += d;
    if (n > max) {
      max = n;
      at = t;
    }
  }
  return { max, at };
}

function reconstructRows(cfg, table) {
  const director = new MusicDirector(cfg, cfg.songLength + 5);
  const beatTimes = director.beatTimes.filter(t => finite(t) && t >= 0 && t <= cfg.songLength + 1e-9);
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
    const cullTime = timeAtDistanceAfter(table, t, CULL_DISTANCE);
    if (!finite(cullTime) || cullTime <= t) throw new Error(`invalid pickup cull timing row ${rowIndex}`);
    rows.push({
      rowIndex,
      spawnTime: t,
      cullTime,
      pickupCount: row.pickups.length,
    });
    rowIndex++;
  }

  return { beatTimes, rows };
}

function parityField(name, trustedValue, reconstructedValue) {
  return {
    name,
    trusted: trustedValue,
    reconstructed: reconstructedValue,
    pass: Object.is(trustedValue, reconstructedValue),
  };
}

function evaluateBound(rowIntervals, peakEvents, table, orbCount) {
  const peakBatches = peakEvents.map((e, i) => {
    const cullTime = timeAtDistanceAfter(table, e.t, CULL_DISTANCE);
    return {
      peakIndex: i,
      spawnTime: e.t,
      cullTime,
      count: orbCount,
    };
  });
  const finiteBatches = peakBatches.every(b => finite(b.spawnTime) && finite(b.cullTime) && b.cullTime > b.spawnTime);
  const combined = finiteBatches ? maxConcurrentIntervals([...rowIntervals, ...peakBatches]) : { max: null, at: null };
  const overflowCount = finite(combined.max) ? Math.max(0, combined.max - PICKUP_POOL) : null;
  return {
    orbCountPerPeak: orbCount,
    attemptedPeakOrbs: peakEvents.length * orbCount,
    peakBatches,
    maxConcurrentCombinedPickups: combined.max,
    timeOfCombinedMaximum: combined.at,
    poolCapacity: PICKUP_POOL,
    overflowCount,
    silentDropRisk: finite(combined.max) ? combined.max > PICKUP_POOL : true,
    finite: finiteBatches && finite(combined.max) && finite(combined.at),
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
  const trustedOutputArg = get('--trusted-output');
  if (!manifestPath || !outputPath) {
    throw new Error('usage: audit_peak_pickup_qc_v1.mjs --manifest file.json --output qc.json [--trusted-output trusted.json] [--label name]');
  }

  const absoluteOutput = path.resolve(outputPath);
  const outputDir = path.dirname(absoluteOutput);
  fs.mkdirSync(outputDir, { recursive: true });
  const trustedOutput = trustedOutputArg
    ? path.resolve(trustedOutputArg)
    : path.join(os.tmpdir(), `trackcade-trusted-${process.pid}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(trustedOutput), { recursive: true });

  const trustedAuditor = fileURLToPath(new URL('../gameplay-v1/audit_gameplay_v1.mjs', import.meta.url));
  execFileSync(process.execPath, [
    trustedAuditor,
    '--manifest', path.resolve(manifestPath),
    '--output', trustedOutput,
    '--label', label,
  ], { stdio: 'inherit' });

  const trusted = JSON.parse(fs.readFileSync(trustedOutput, 'utf8'));
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const cfg = validateManifest(raw);
  const table = buildDistanceTable(cfg);
  const reconstruction = reconstructRows(cfg, table);
  const rowIntervals = reconstruction.rows.map(r => ({
    spawnTime: r.spawnTime,
    cullTime: r.cullTime,
    count: r.pickupCount,
  }));
  const rowOnly = maxConcurrentIntervals(rowIntervals);
  const totalRowPickups = reconstruction.rows.reduce((sum, r) => sum + r.pickupCount, 0);

  const parity = [
    parityField('beatCount', trusted?.counts?.beats, reconstruction.beatTimes.length),
    parityField('rowCount', trusted?.counts?.rows, reconstruction.rows.length),
    parityField('totalRowPickupCount', trusted?.counts?.pickups, totalRowPickups),
    parityField('rowOnlyMaxConcurrentPickups', trusted?.pools?.pickups?.max, rowOnly.max),
    parityField('pickupPoolCapacity', trusted?.pools?.pickups?.capacity, PICKUP_POOL),
  ];
  const parityPass = parity.every(x => x.pass);

  const peakEvents = cfg.events
    .filter(e => e.kind === 'peak')
    .map(e => ({ t: e.t, kind: e.kind }));
  const currentRuntimeBound = evaluateBound(rowIntervals, peakEvents, table, CURRENT_RUNTIME_PEAK_ORBS);
  const queueCapStressBound = evaluateBound(rowIntervals, peakEvents, table, QUEUE_CAP_PEAK_ORBS);

  const allFinite = reconstruction.beatTimes.every(finite)
    && reconstruction.rows.every(r => finite(r.spawnTime) && finite(r.cullTime) && Number.isInteger(r.pickupCount) && r.pickupCount >= 0)
    && peakEvents.every(e => finite(e.t))
    && currentRuntimeBound.finite
    && queueCapStressBound.finite;

  let status = 'qc_pass';
  if (trusted.status !== 'qc_pass') status = 'trusted_gameplay_not_qc_pass';
  else if (!parityPass) status = 'reconstruction_parity_failure';
  else if (!peakEvents.length) status = 'not_applicable_no_peak';
  else if (!allFinite) status = 'invalid_reconstruction';
  else if (currentRuntimeBound.silentDropRisk || queueCapStressBound.silentDropRisk) status = 'peak_pickup_pool_overflow_risk';

  const result = {
    schema: 'trackcade-peak-pickup-qc-v1',
    label,
    status,
    source: {
      artist: cfg.artist,
      title: cfg.title,
      songLength: cfg.songLength,
      timingTier: raw?.generation?.timingTier ?? null,
      analysisJsonSha256: raw?.generation?.analysisJsonSha256 ?? null,
    },
    runtime: {
      viewZ: VIEW_Z,
      cullZ: CULL_Z,
      pickupPoolCapacity: PICKUP_POOL,
      currentRuntimePeakOrbBound: CURRENT_RUNTIME_PEAK_ORBS,
      queueCapStressPeakOrbBound: QUEUE_CAP_PEAK_ORBS,
      noCollectionAssumption: true,
      additionsBeforeRemovalsOnExactTie: true,
    },
    trustedGameplayAudit: {
      status: trusted.status,
      beatCount: trusted?.counts?.beats,
      rowCount: trusted?.counts?.rows,
      totalRowPickupCount: trusted?.counts?.pickups,
      rowOnlyMaxConcurrentPickups: trusted?.pools?.pickups?.max,
      pickupPoolCapacity: trusted?.pools?.pickups?.capacity,
    },
    reconstruction: {
      beatCount: reconstruction.beatTimes.length,
      rowCount: reconstruction.rows.length,
      totalRowPickupCount: totalRowPickups,
      rowOnlyMaxConcurrentPickups: rowOnly.max,
      rowOnlyMaximumTime: rowOnly.at,
      pickupPoolCapacity: PICKUP_POOL,
    },
    parity: {
      pass: parityPass,
      fields: parity,
    },
    peaks: {
      count: peakEvents.length,
      times: peakEvents.map(e => e.t),
    },
    bounds: {
      currentRuntime13: currentRuntimeBound,
      queueCapStress14: queueCapStressBound,
    },
    integrity: {
      allFinite,
      peakEventsPresent: peakEvents.length > 0,
      trustedGameplayQcPass: trusted.status === 'qc_pass',
      exactParity: parityPass,
    },
  };

  fs.writeFileSync(absoluteOutput, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({
    label,
    status,
    peaks: result.peaks.count,
    rowOnlyMax: rowOnly.max,
    combined13: currentRuntimeBound.maxConcurrentCombinedPickups,
    combined14: queueCapStressBound.maxConcurrentCombinedPickups,
    capacity: PICKUP_POOL,
    parityPass,
  }, null, 2));

  if (status !== 'qc_pass') process.exitCode = 2;
}

main();
