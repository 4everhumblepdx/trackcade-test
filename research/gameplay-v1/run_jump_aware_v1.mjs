#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SPEC_COMMIT = '13c0e663344db3861bae8fb2ddee9f61bb9ba096';
const OUTPUT_SCHEMA = 'trackcade-gameplay-jump-aware-matrix-v1';
const AUDIT_SCHEMA = 'trackcade-gameplay-jump-aware-v1';
const profiles = [
  { id: 'default', role: 'control', overrides: {}, expectedBaseline: 'qc_pass' },
  { id: 'lane-0.16', role: 'control', overrides: { laneSwitchTime: 0.16 }, expectedBaseline: 'qc_pass' },
  { id: 'lane-0.20', role: 'target', overrides: { laneSwitchTime: 0.20 }, expectedBaseline: 'needs_jump_aware_analysis' },
  { id: 'lane-0.24', role: 'target', overrides: { laneSwitchTime: 0.24 }, expectedBaseline: 'needs_jump_aware_analysis' },
  {
    id: 'fast-dense-tight-lanes', role: 'target',
    overrides: { baseSpeed: 160, maxSpeed: 500, speedRampPerSec: 2.0, laneSwitchTime: 0.20, spawnRowEveryBeats: 1 },
    expectedBaseline: 'needs_jump_aware_analysis',
  },
];

function getArg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
}
function runProof({ auditPath, raw, fixtureId, profile, outputRoot }) {
  const manifest = { ...raw, ...profile.overrides };
  const manifestPath = path.join(outputRoot, 'manifests', profile.id, `${fixtureId}.json`);
  const resultPath = path.join(outputRoot, 'proofs', profile.id, `${fixtureId}.json`);
  writeJson(manifestPath, manifest);
  const run = spawnSync(process.execPath, [
    auditPath,
    '--manifest', path.resolve(manifestPath),
    '--output', path.resolve(resultPath),
    '--label', `${fixtureId.toUpperCase()}::${profile.id}`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`jump auditor failed for ${fixtureId}/${profile.id} (${run.status})\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  const result = readJson(resultPath);
  if (result.schema !== AUDIT_SCHEMA) throw new Error(`unexpected jump audit schema ${result.schema}`);
  return result;
}
function compact(result) {
  return {
    status: result.status,
    baselineStatus: result.baseline.status,
    baselineLaneOnlyPass: result.baseline.laneOnlyPass,
    selfConsistencyPass: result.selfConsistency.pass,
    rows: result.baseline.counts.rows,
    obstaclePoolMax: result.baseline.pools.obstacles.max,
    pickupPoolMax: result.baseline.pools.pickups.max,
    candidateJumpStarts: result.proof?.candidateJumpStarts ?? null,
    maxReachableStates: result.proof?.maxReachableStates ?? null,
    finalStateCount: result.proof?.finalStateCount ?? null,
    firstDeadRow: result.proof?.firstDeadRow?.rowIndex ?? null,
    clearWindowRelativeToJumpStart: result.proof?.clearWindowRelativeToJumpStart ?? null,
    runtime: result.runtime,
  };
}

function main() {
  const args = process.argv.slice(2);
  const alldatArg = getArg(args, '--alldat');
  const cvbArg = getArg(args, '--cvb');
  const outputArg = getArg(args, '--output');
  if (!alldatArg || !cvbArg || !outputArg) {
    console.error('usage: run_jump_aware_v1.mjs --alldat alldat.json --cvb cvb.json --output dir');
    process.exit(64);
  }
  const fixtures = [
    { id: 'alldat', raw: readJson(path.resolve(alldatArg)) },
    { id: 'cvb-gemf', raw: readJson(path.resolve(cvbArg)) },
  ];
  const outputRoot = path.resolve(outputArg);
  const auditPath = fileURLToPath(new URL('./audit_jump_aware_v1.mjs', import.meta.url));
  const rows = [];
  let provenanceValid = true;
  let controlsPass = true;

  for (const profile of profiles) {
    const results = {};
    for (const fixture of fixtures) {
      const full = runProof({ auditPath, raw: fixture.raw, fixtureId: fixture.id, profile, outputRoot });
      const item = compact(full);
      results[fixture.id] = item;
      if (item.baselineStatus !== profile.expectedBaseline || !item.selfConsistencyPass) provenanceValid = false;
      if (profile.role === 'control' && item.status !== 'jump_aware_pass') controlsPass = false;
    }
    rows.push({
      id: profile.id,
      role: profile.role,
      overrides: profile.overrides,
      expectedBaseline: profile.expectedBaseline,
      fixtures: results,
      crossFixtureJumpPass: fixtures.every(f => results[f.id].status === 'jump_aware_pass'),
    });
  }

  const aggregate = {
    schema: OUTPUT_SCHEMA,
    preregistration: {
      commit: SPEC_COMMIT,
      profiles: profiles.length,
      fixtures: fixtures.length,
      proofsPerPass: profiles.length * fixtures.length,
    },
    provenanceValid,
    controlsPass,
    fixtures: fixtures.map(f => ({
      id: f.id,
      artist: f.raw.artist,
      title: f.raw.title,
      bpm: f.raw.bpm,
      songLength: f.raw.songLength,
      analysisJsonSha256: f.raw?.generation?.analysisJsonSha256 ?? null,
      timingTier: f.raw?.generation?.timingTier ?? null,
    })),
    profiles: rows,
  };
  writeJson(path.join(outputRoot, 'jump-aware-summary.json'), aggregate);
  console.log(JSON.stringify({
    schema: aggregate.schema,
    provenanceValid,
    controlsPass,
    profiles: rows.map(r => ({
      id: r.id,
      role: r.role,
      crossFixtureJumpPass: r.crossFixtureJumpPass,
      statuses: Object.fromEntries(Object.entries(r.fixtures).map(([k, v]) => [k, v.status])),
    })),
  }, null, 2));

  if (!provenanceValid) {
    console.error('INVALID EXPERIMENT: baseline status or model parity drift');
    process.exit(2);
  }
  if (!controlsPass) {
    console.error('INVALID EXPERIMENT: jump-aware controls did not remain provable');
    process.exit(3);
  }
}

main();
