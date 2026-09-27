#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function getArg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const args = process.argv.slice(2);
const manifestArg = getArg(args, '--manifest');
const outputArg = getArg(args, '--output');
const label = getArg(args, '--label') ?? manifestArg ?? 'manifest';

if (!manifestArg || !outputArg) {
  console.error('usage: preflight_gameplay_v1.mjs --manifest file.json --output qc.json [--label name]');
  process.exit(64);
}

const manifestPath = path.resolve(manifestArg);
const outputPath = path.resolve(outputArg);
const auditPath = fileURLToPath(new URL('./audit_gameplay_v1.mjs', import.meta.url));

const run = spawnSync(process.execPath, [
  auditPath,
  '--manifest', manifestPath,
  '--output', outputPath,
  '--label', label,
], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

if (run.error) {
  console.error(`REFUSE: gameplay preflight could not execute auditor: ${run.error.message}`);
  process.exit(70);
}
if (run.status !== 0) {
  console.error(`REFUSE: gameplay auditor exited with code ${run.status}`);
  process.exit(run.status ?? 70);
}

let result;
try {
  result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
} catch (err) {
  console.error(`REFUSE: gameplay preflight could not read QC result: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(70);
}

if (result?.schema !== 'trackcade-gameplay-qc-v1') {
  console.error('REFUSE: gameplay preflight received an unknown QC schema');
  process.exit(70);
}

if (result.status !== 'qc_pass') {
  console.error(`REFUSE: gameplay QC status=${result.status} for ${label}`);
  process.exit(2);
}

console.log(JSON.stringify({
  preflight: 'pass',
  label,
  status: result.status,
  obstaclePoolMax: result?.pools?.obstacles?.max ?? null,
  obstaclePoolCapacity: result?.pools?.obstacles?.capacity ?? null,
  pickupPoolMax: result?.pools?.pickups?.max ?? null,
  pickupPoolCapacity: result?.pools?.pickups?.capacity ?? null,
  laneOnlyPass: result?.laneOnlyProof?.pass ?? null,
  bottleneckSlackSeconds: result?.laneOnlyProof?.bottleneckSlackSeconds ?? null,
}, null, 2));
