#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PREREGISTERED_COMMIT = '84efef63fa895af0001517f89c4f26621aa0f2b6';
const EXPECTED_PROFILE_COUNT = 25;
const AUDIT_SCHEMA = 'trackcade-gameplay-qc-v1';
const OUTPUT_SCHEMA = 'trackcade-gameplay-tuning-stress-v1';

function getArg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
}

const profiles = [
  { id: 'default', overrides: {} },

  { id: 'cadence-2', overrides: { spawnRowEveryBeats: 2 } },
  { id: 'cadence-4', overrides: { spawnRowEveryBeats: 4 } },

  { id: 'base-80', overrides: { baseSpeed: 80 } },
  { id: 'base-100', overrides: { baseSpeed: 100 } },
  { id: 'base-140', overrides: { baseSpeed: 140 } },
  { id: 'base-160', overrides: { baseSpeed: 160 } },

  { id: 'max-260', overrides: { maxSpeed: 260 } },
  { id: 'max-320', overrides: { maxSpeed: 320 } },
  { id: 'max-440', overrides: { maxSpeed: 440 } },
  { id: 'max-500', overrides: { maxSpeed: 500 } },

  { id: 'ramp-0', overrides: { speedRampPerSec: 0 } },
  { id: 'ramp-0.4', overrides: { speedRampPerSec: 0.4 } },
  { id: 'ramp-2.0', overrides: { speedRampPerSec: 2.0 } },
  { id: 'ramp-3.0', overrides: { speedRampPerSec: 3.0 } },

  { id: 'lane-0.08', overrides: { laneSwitchTime: 0.08 } },
  { id: 'lane-0.16', overrides: { laneSwitchTime: 0.16 } },
  { id: 'lane-0.20', overrides: { laneSwitchTime: 0.20 } },
  { id: 'lane-0.24', overrides: { laneSwitchTime: 0.24 } },

  {
    id: 'slow-dense',
    overrides: { baseSpeed: 80, maxSpeed: 260, speedRampPerSec: 0.4, spawnRowEveryBeats: 1 },
  },
  {
    id: 'slow-dense-tight-lanes',
    overrides: { baseSpeed: 80, maxSpeed: 260, speedRampPerSec: 0.4, laneSwitchTime: 0.20, spawnRowEveryBeats: 1 },
  },
  {
    id: 'slow-sparse',
    overrides: { baseSpeed: 80, maxSpeed: 260, speedRampPerSec: 0.4, spawnRowEveryBeats: 2 },
  },
  {
    id: 'fast-dense',
    overrides: { baseSpeed: 160, maxSpeed: 500, speedRampPerSec: 2.0, spawnRowEveryBeats: 1 },
  },
  {
    id: 'fast-dense-tight-lanes',
    overrides: { baseSpeed: 160, maxSpeed: 500, speedRampPerSec: 2.0, laneSwitchTime: 0.20, spawnRowEveryBeats: 1 },
  },
  {
    id: 'fast-sparse-tight-lanes',
    overrides: { baseSpeed: 160, maxSpeed: 500, speedRampPerSec: 2.0, laneSwitchTime: 0.20, spawnRowEveryBeats: 2 },
  },
];

if (profiles.length !== EXPECTED_PROFILE_COUNT) {
  throw new Error(`profile-count drift: expected ${EXPECTED_PROFILE_COUNT}, got ${profiles.length}`);
}
if (new Set(profiles.map(p => p.id)).size !== profiles.length) {
  throw new Error('duplicate stress profile id');
}

function classify(statuses) {
  const passCount = statuses.filter(s => s === 'qc_pass').length;
  if (passCount === 2) return 'cross_fixture_pass';
  if (passCount === 1) return 'fixture_sensitive';
  return 'cross_fixture_fail';
}

function compact(audit) {
  return {
    status: audit.status,
    rows: audit.counts.rows,
    minArrivalGap: audit.timing.rowArrivalGaps.min,
    p05ArrivalGap: audit.timing.rowArrivalGaps.p05,
    minLeadTime: audit.timing.spawnToCollisionLead.min,
    laneOnlyPass: audit.laneOnlyProof.pass,
    bottleneckSlackSeconds: audit.laneOnlyProof.bottleneckSlackSeconds,
    obstaclePoolMax: audit.pools.obstacles.max,
    obstaclePoolCapacity: audit.pools.obstacles.capacity,
    pickupPoolMax: audit.pools.pickups.max,
    pickupPoolCapacity: audit.pools.pickups.capacity,
    minSpatialSpawnGap: audit.timing.spatialGapBetweenRowSpawns.min,
    runtime: {
      spawnRowEveryBeats: audit.runtime.spawnRowEveryBeats,
      baseSpeed: audit.runtime.baseSpeed,
      maxSpeed: audit.runtime.maxSpeed,
      speedRampPerSec: audit.runtime.speedRampPerSec,
      laneSwitchTime: audit.runtime.laneSwitchTime,
      jumpTime: audit.runtime.jumpTime,
      spawnMinGapZConfigured: audit.runtime.spawnMinGapZConfigured,
      spawnMinGapZEnforcedByCurrentBeatSpawnPath: audit.runtime.spawnMinGapZEnforcedByCurrentBeatSpawnPath,
    },
  };
}

function runAudit({ auditPath, raw, fixtureId, profile, outputRoot }) {
  const manifest = { ...raw, ...profile.overrides };
  const manifestPath = path.join(outputRoot, 'manifests', profile.id, `${fixtureId}.json`);
  const auditOutputPath = path.join(outputRoot, 'audits', profile.id, `${fixtureId}.json`);
  writeJson(manifestPath, manifest);

  const label = `${fixtureId.toUpperCase()}::${profile.id}`;
  const run = spawnSync(process.execPath, [
    auditPath,
    '--manifest', path.resolve(manifestPath),
    '--output', path.resolve(auditOutputPath),
    '--label', label,
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (run.error) throw run.error;
  if (run.status !== 0) {
    throw new Error(`auditor failed for ${label} with code ${run.status}\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  }

  const audit = readJson(auditOutputPath);
  if (audit.schema !== AUDIT_SCHEMA) {
    throw new Error(`unexpected auditor schema for ${label}: ${audit.schema}`);
  }
  return audit;
}

function main() {
  const args = process.argv.slice(2);
  const alldatArg = getArg(args, '--alldat');
  const cvbArg = getArg(args, '--cvb');
  const outputArg = getArg(args, '--output');
  if (!alldatArg || !cvbArg || !outputArg) {
    console.error('usage: run_tuning_stress_v1.mjs --alldat alldat.json --cvb cvb.json --output dir');
    process.exit(64);
  }

  const fixtures = [
    { id: 'alldat', path: path.resolve(alldatArg), raw: readJson(path.resolve(alldatArg)) },
    { id: 'cvb-gemf', path: path.resolve(cvbArg), raw: readJson(path.resolve(cvbArg)) },
  ];
  const outputRoot = path.resolve(outputArg);
  fs.mkdirSync(outputRoot, { recursive: true });
  const auditPath = fileURLToPath(new URL('./audit_gameplay_v1.mjs', import.meta.url));

  const aggregateProfiles = [];
  for (const profile of profiles) {
    const fixtureResults = {};
    for (const fixture of fixtures) {
      const audit = runAudit({ auditPath, raw: fixture.raw, fixtureId: fixture.id, profile, outputRoot });
      fixtureResults[fixture.id] = compact(audit);
    }
    const statuses = fixtures.map(f => fixtureResults[f.id].status);
    aggregateProfiles.push({
      id: profile.id,
      overrides: profile.overrides,
      classification: classify(statuses),
      fixtures: fixtureResults,
    });
  }

  const defaultProfile = aggregateProfiles.find(p => p.id === 'default');
  const defaultPass = defaultProfile && defaultProfile.classification === 'cross_fixture_pass';
  const counts = aggregateProfiles.reduce((acc, p) => {
    acc[p.classification] = (acc[p.classification] ?? 0) + 1;
    return acc;
  }, {});

  const aggregate = {
    schema: OUTPUT_SCHEMA,
    preregistration: {
      commit: PREREGISTERED_COMMIT,
      expectedProfiles: EXPECTED_PROFILE_COUNT,
      fixtureCount: 2,
      expectedAudits: EXPECTED_PROFILE_COUNT * 2,
    },
    invariants: {
      analyzerAndStructureFrozen: true,
      rowGeneratorUnchanged: true,
      gameplayAuditorUnchangedByRunner: true,
      obstaclePoolCapacity: 28,
      pickupPoolCapacity: 24,
      semanticHighImpactEventsAdded: false,
      spawnMinGapZClaimedAsEnforced: false,
    },
    fixtures: fixtures.map(f => ({
      id: f.id,
      artist: f.raw.artist,
      title: f.raw.title,
      bpm: f.raw.bpm,
      songLength: f.raw.songLength,
      authoredBeatEvents: Array.isArray(f.raw.events) ? f.raw.events.filter(e => e?.kind === 'beat').length : 0,
      timingTier: f.raw?.generation?.timingTier ?? null,
      analysisJsonSha256: f.raw?.generation?.analysisJsonSha256 ?? null,
    })),
    defaultReferencePassesBothFixtures: Boolean(defaultPass),
    classificationCounts: {
      cross_fixture_pass: counts.cross_fixture_pass ?? 0,
      fixture_sensitive: counts.fixture_sensitive ?? 0,
      cross_fixture_fail: counts.cross_fixture_fail ?? 0,
    },
    profiles: aggregateProfiles,
  };

  writeJson(path.join(outputRoot, 'tuning-stress-summary.json'), aggregate);

  console.log(JSON.stringify({
    schema: aggregate.schema,
    profiles: aggregate.profiles.length,
    audits: aggregate.profiles.length * fixtures.length,
    defaultReferencePassesBothFixtures: aggregate.defaultReferencePassesBothFixtures,
    classificationCounts: aggregate.classificationCounts,
    profileClassifications: aggregate.profiles.map(p => ({ id: p.id, classification: p.classification })),
  }, null, 2));

  if (!defaultPass) {
    console.error('INVALID EXPERIMENT: default reference did not pass both fixtures');
    process.exit(2);
  }
}

main();
