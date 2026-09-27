#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SPEC_COMMIT = 'c6027dbe3a0f6e5f535a8bd5645ee06e46150f50';
const SCHEMA = 'trackcade-gameplay-difficulty-variants-v1';
const QC_SCHEMA = 'trackcade-gameplay-qc-v1';

const MODES = [
  {
    id: 'relaxed',
    mandatory: false,
    overrides: { spawnRowEveryBeats: 2 },
  },
  {
    id: 'standard',
    mandatory: true,
    overrides: {},
  },
  {
    id: 'rush',
    mandatory: false,
    overrides: {
      baseSpeed: 160,
      maxSpeed: 500,
      speedRampPerSec: 2.0,
      spawnRowEveryBeats: 1,
    },
  },
];

const TUNING_KEYS = new Set([
  'baseSpeed', 'maxSpeed', 'speedRampPerSec', 'energySpeedBoost',
  'overdriveSpeedMult', 'jumpTime', 'jumpHeight', 'laneSwitchTime',
  'maxHits', 'invincibleTime', 'spawnRowEveryBeats', 'spawnMinGapZ',
  'scorePerMeter', 'orbScore', 'nearMissScore', 'comboEvery', 'comboCap',
  'overdriveComboBonus', 'overdriveOrbChance', 'overdriveBloom', 'baseBloom',
  'crashScoreFraction', 'crashScoreFlat', 'crashStunTime', 'crashInvincibleTime',
]);

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

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(p) {
  return sha256Bytes(fs.readFileSync(p));
}

function deepEqual(a, b) {
  return util.isDeepStrictEqual(a, b);
}

function immutableCheck(source, candidate) {
  const fieldChecks = {};
  for (const key of Object.keys(source)) {
    if (TUNING_KEYS.has(key) || key === 'generation') continue;
    fieldChecks[key] = deepEqual(candidate[key], source[key]);
  }

  const sourceGeneration = source?.generation && typeof source.generation === 'object' && !Array.isArray(source.generation)
    ? source.generation
    : {};
  const candidateGeneration = candidate?.generation && typeof candidate.generation === 'object' && !Array.isArray(candidate.generation)
    ? candidate.generation
    : {};
  const generationChecks = Object.fromEntries(
    Object.keys(sourceGeneration).map(key => [key, deepEqual(candidateGeneration[key], sourceGeneration[key])]),
  );

  const pass = Object.values(fieldChecks).every(Boolean) && Object.values(generationChecks).every(Boolean);
  return { pass, fieldChecks, generationChecks };
}

function buildCandidate(source, mode) {
  const sourceGeneration = source?.generation && typeof source.generation === 'object' && !Array.isArray(source.generation)
    ? source.generation
    : {};
  return {
    ...source,
    ...mode.overrides,
    generation: {
      ...sourceGeneration,
      gameplayDifficultyV1: {
        schema: SCHEMA,
        specCommit: SPEC_COMMIT,
        mode: mode.id,
        overrides: mode.overrides,
      },
    },
  };
}

function runPreflight({ preflightPath, candidatePath, qcPath, label }) {
  const run = spawnSync(process.execPath, [
    preflightPath,
    '--manifest', path.resolve(candidatePath),
    '--output', path.resolve(qcPath),
    '--label', label,
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (run.error) {
    throw new Error(`preflight execution error for ${label}: ${run.error.message}`);
  }
  if (run.status !== 0 && run.status !== 2) {
    throw new Error(`preflight infrastructure failure for ${label}: exit ${run.status}\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  }
  if (!fs.existsSync(qcPath)) {
    throw new Error(`preflight did not produce QC JSON for ${label}`);
  }

  const qc = readJson(qcPath);
  if (qc?.schema !== QC_SCHEMA) {
    throw new Error(`unexpected QC schema for ${label}: ${String(qc?.schema)}`);
  }
  const pass = run.status === 0 && qc.status === 'qc_pass';
  if (run.status === 0 && qc.status !== 'qc_pass') {
    throw new Error(`preflight exit/status disagreement for ${label}: exit 0 with ${qc.status}`);
  }
  if (run.status === 2 && qc.status === 'qc_pass') {
    throw new Error(`preflight exit/status disagreement for ${label}: exit 2 with qc_pass`);
  }
  return {
    exitCode: run.status,
    pass,
    qc,
  };
}

function compactQc(qc) {
  return {
    status: qc.status,
    rows: qc?.counts?.rows ?? null,
    obstacles: qc?.counts?.obstacles ?? null,
    pickups: qc?.counts?.pickups ?? null,
    obstaclePoolMax: qc?.pools?.obstacles?.max ?? null,
    obstaclePoolCapacity: qc?.pools?.obstacles?.capacity ?? null,
    pickupPoolMax: qc?.pools?.pickups?.max ?? null,
    pickupPoolCapacity: qc?.pools?.pickups?.capacity ?? null,
    laneOnlyPass: qc?.laneOnlyProof?.pass ?? null,
    bottleneckSlackSeconds: qc?.laneOnlyProof?.bottleneckSlackSeconds ?? null,
    minArrivalGap: qc?.timing?.rowArrivalGaps?.min ?? null,
    minLeadTime: qc?.timing?.spawnToCollisionLead?.min ?? null,
    runtime: {
      spawnRowEveryBeats: qc?.runtime?.spawnRowEveryBeats ?? null,
      baseSpeed: qc?.runtime?.baseSpeed ?? null,
      maxSpeed: qc?.runtime?.maxSpeed ?? null,
      speedRampPerSec: qc?.runtime?.speedRampPerSec ?? null,
      laneSwitchTime: qc?.runtime?.laneSwitchTime ?? null,
      jumpTime: qc?.runtime?.jumpTime ?? null,
      spawnMinGapZConfigured: qc?.runtime?.spawnMinGapZConfigured ?? null,
      spawnMinGapZEnforcedByCurrentBeatSpawnPath: qc?.runtime?.spawnMinGapZEnforcedByCurrentBeatSpawnPath ?? null,
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  const manifestArg = getArg(args, '--manifest');
  const outputArg = getArg(args, '--output');
  const labelArg = getArg(args, '--label');
  if (!manifestArg || !outputArg) {
    console.error('usage: generate_difficulty_variants_v1.mjs --manifest safe.json --output dir [--label name]');
    process.exit(64);
  }

  const manifestPath = path.resolve(manifestArg);
  const outputRoot = path.resolve(outputArg);
  const sourceBytes = fs.readFileSync(manifestPath);
  const source = JSON.parse(sourceBytes.toString('utf8'));
  const label = labelArg ?? `${source.artist ?? 'artist'} — ${source.title ?? 'title'}`;
  const preflightPath = fileURLToPath(new URL('./preflight_gameplay_v1.mjs', import.meta.url));

  fs.mkdirSync(path.join(outputRoot, 'candidates'), { recursive: true });
  fs.mkdirSync(path.join(outputRoot, 'qc'), { recursive: true });

  const results = [];
  for (const mode of MODES) {
    const candidate = buildCandidate(source, mode);
    const integrity = immutableCheck(source, candidate);
    if (!integrity.pass) {
      throw new Error(`immutable music/content facts changed while building mode ${mode.id}`);
    }

    const candidatePath = path.join(outputRoot, 'candidates', `${mode.id}.json`);
    const qcPath = path.join(outputRoot, 'qc', `${mode.id}.json`);
    writeJson(candidatePath, candidate);

    const preflight = runPreflight({
      preflightPath,
      candidatePath,
      qcPath,
      label: `${label}::${mode.id}`,
    });

    results.push({
      id: mode.id,
      mandatory: mode.mandatory,
      overrides: mode.overrides,
      preflightExitCode: preflight.exitCode,
      qcStatus: preflight.qc.status,
      publishable: preflight.pass,
      integrity,
      candidateSha256: sha256File(candidatePath),
      qcSha256: sha256File(qcPath),
      qc: compactQc(preflight.qc),
    });
  }

  const standard = results.find(r => r.id === 'standard');
  if (!standard) throw new Error('internal error: standard mode missing');
  const standardPassed = standard.publishable === true;
  const publishedModes = standardPassed ? results.filter(r => r.publishable).map(r => r.id) : [];

  const report = {
    schema: SCHEMA,
    specCommit: SPEC_COMMIT,
    source: {
      label,
      artist: source.artist ?? null,
      title: source.title ?? null,
      bpm: source.bpm ?? null,
      beatOffset: source.beatOffset ?? null,
      songLength: source.songLength ?? null,
      manifestSha256: sha256Bytes(sourceBytes),
      analysisJsonSha256: source?.generation?.analysisJsonSha256 ?? null,
      timingTier: source?.generation?.timingTier ?? null,
    },
    invariants: {
      analyzerOrStructureModified: false,
      semanticHighImpactEventsAdded: false,
      poolCapacitiesModified: false,
      candidateSearchAfterFailure: false,
      existingWholeSongPreflightAuthoritative: true,
    },
    standardPassed,
    publishedModes,
    modes: results,
  };
  writeJson(path.join(outputRoot, 'difficulty-variants-report.json'), report);

  if (standardPassed) {
    const publishableDir = path.join(outputRoot, 'publishable');
    fs.mkdirSync(publishableDir, { recursive: true });
    for (const result of results) {
      if (!result.publishable) continue;
      fs.copyFileSync(
        path.join(outputRoot, 'candidates', `${result.id}.json`),
        path.join(publishableDir, `${result.id}.json`),
      );
    }
  }

  console.log(JSON.stringify({
    schema: report.schema,
    label,
    standardPassed,
    publishedModes,
    modes: results.map(r => ({
      id: r.id,
      qcStatus: r.qcStatus,
      publishable: r.publishable,
      obstaclePoolMax: r.qc.obstaclePoolMax,
      pickupPoolMax: r.qc.pickupPoolMax,
      laneOnlyPass: r.qc.laneOnlyPass,
      bottleneckSlackSeconds: r.qc.bottleneckSlackSeconds,
    })),
  }, null, 2));

  if (!standardPassed) {
    console.error('REFUSE VARIANT PACK: mandatory standard mode did not pass gameplay preflight');
    process.exit(2);
  }
}

main();
