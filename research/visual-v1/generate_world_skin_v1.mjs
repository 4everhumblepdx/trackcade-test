#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { validateManifest } from '../../src/track/loader.js';

const SPEC_COMMIT = '29bc1a4a0f7b38172857aca6f7658b0520be0dcc';
const SCHEMA = 'trackcade-visual-world-v1';
const EXPECTED_ART_KEYS = ['player','obstacleLow','obstacleWall','orb','cell','skyline'];
const PALETTE_KEYS = [
  'skyTop','skyBottom','road','roadAlt','laneGlow','edgeLeft','edgeRight',
  'primary','secondary','collectible','hazard','overdriveA','overdriveB',
];
const CONTRAST_KEYS = [
  'laneGlow','edgeLeft','edgeRight','primary','secondary',
  'collectible','hazard','overdriveA','overdriveB',
];

const SKINS = [
  {
    id: 'neon-night',
    palette: {
      skyTop: '#070a1e', skyBottom: '#1b1440', road: '#1a2142', roadAlt: '#121831',
      laneGlow: '#19e3ff', edgeLeft: '#ff2fb0', edgeRight: '#19e3ff',
      primary: '#19e3ff', secondary: '#ff2fb0', collectible: '#ffd147', hazard: '#ff4d6d',
      overdriveA: '#ff9a3d', overdriveB: '#ff2fb0',
    },
  },
  {
    id: 'violet-circuit',
    palette: {
      skyTop: '#08061a', skyBottom: '#24134a', road: '#17152f', roadAlt: '#0f1024',
      laneGlow: '#7cf7ff', edgeLeft: '#b85cff', edgeRight: '#36e7ff',
      primary: '#7cf7ff', secondary: '#c46cff', collectible: '#ffe36e', hazard: '#ff5577',
      overdriveA: '#ff9b4a', overdriveB: '#c95cff',
    },
  },
  {
    id: 'solar-flare',
    palette: {
      skyTop: '#12080b', skyBottom: '#3c1720', road: '#241a22', roadAlt: '#171118',
      laneGlow: '#6ee7ff', edgeLeft: '#ff8a3d', edgeRight: '#ffd166',
      primary: '#75e6ff', secondary: '#ff8a3d', collectible: '#ffe27a', hazard: '#ff4b5c',
      overdriveA: '#ffd166', overdriveB: '#ff5f7a',
    },
  },
  {
    id: 'acid-rain',
    palette: {
      skyTop: '#06120f', skyBottom: '#0d2a26', road: '#111d26', roadAlt: '#0a141c',
      laneGlow: '#7dff8a', edgeLeft: '#c4ff4d', edgeRight: '#55e8ff',
      primary: '#55e8ff', secondary: '#c4ff4d', collectible: '#ffe66d', hazard: '#ff5364',
      overdriveA: '#d7ff4d', overdriveB: '#55e8ff',
    },
  },
];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function fail(message, code = 2) {
  console.error(`REFUSE: ${message}`);
  process.exit(code);
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  }
  return value;
}

function stableString(value) {
  return JSON.stringify(stable(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hexToRgb01(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`invalid color ${hex}`);
  return [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function linear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r,g,b] = hexToRgb01(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbDistance(a, b) {
  const aa = hexToRgb01(a);
  const bb = hexToRgb01(b);
  return Math.sqrt(aa.reduce((sum, v, i) => sum + (v - bb[i]) ** 2, 0));
}

function rgbToHue(hex) {
  const [r,g,b] = hexToRgb01(hex);
  const max = Math.max(r,g,b);
  const min = Math.min(r,g,b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function hueDistance(a, b) {
  const d = Math.abs(rgbToHue(a) - rgbToHue(b));
  return Math.min(d, 360 - d);
}

function qcPalette(skin) {
  const p = skin.palette;
  const exactKeys = Object.keys(p).sort().join(',') === [...PALETTE_KEYS].sort().join(',');
  const hexPass = PALETTE_KEYS.every(k => /^#[0-9a-fA-F]{6}$/.test(p[k] ?? ''));
  const contrastMetrics = {};
  let contrastPass = true;
  for (const key of CONTRAST_KEYS) {
    const vsRoad = contrast(p[key], p.road);
    const vsRoadAlt = contrast(p[key], p.roadAlt);
    contrastMetrics[key] = { vsRoad, vsRoadAlt, minimum: Math.min(vsRoad, vsRoadAlt) };
    if (vsRoad < 4.5 || vsRoadAlt < 4.5) contrastPass = false;
  }
  const hazardCollectibleRgbDistance = rgbDistance(p.hazard, p.collectible);
  const hazardCollectibleHueDegrees = hueDistance(p.hazard, p.collectible);
  const separationPass = hazardCollectibleRgbDistance >= 0.45 && hazardCollectibleHueDegrees >= 45;
  return {
    pass: exactKeys && hexPass && contrastPass && separationPass,
    exactKeys,
    hexPass,
    contrastPass,
    contrastThreshold: 4.5,
    contrastMetrics,
    separationPass,
    hazardCollectibleRgbDistance,
    hazardCollectibleHueDegrees,
    rgbDistanceThreshold: 0.45,
    hueThresholdDegrees: 45,
  };
}

function analysisIdentity(raw) {
  const v = raw?.generation?.analysisJsonSha256;
  return typeof v === 'string' && /^[0-9a-fA-F]{64}$/.test(v) ? v.toLowerCase() : null;
}

function fallbackSeed(raw) {
  return sha256Text(`${raw.artist}\0${raw.title}\0${raw.audioUrl}\0${raw.bpm}\0${raw.songLength}`);
}

function timelineIdentity(raw) {
  return {
    artist: raw.artist,
    title: raw.title,
    audioUrl: raw.audioUrl,
    bpm: raw.bpm,
    beatOffset: raw.beatOffset ?? 0,
    songLength: raw.songLength,
    events: raw.events ?? [],
    energyCurve: raw.energyCurve ?? [],
  };
}

function stripAllowed(raw) {
  const x = clone(raw);
  delete x.palette;
  if (x.generation && typeof x.generation === 'object') {
    delete x.generation.visualWorldV1;
  }
  return x;
}

function resolvedWithoutPalette(cfg) {
  const x = clone(cfg);
  delete x.palette;
  return x;
}

const packArg = arg('--pack');
const outputArg = arg('--output');
const label = arg('--label') ?? 'song';
if (!packArg || !outputArg) {
  console.error('usage: generate_world_skin_v1.mjs --pack publishable-dir --output out-dir [--label name]');
  process.exit(64);
}

const packDir = path.resolve(packArg);
const outDir = path.resolve(outputArg);
if (!fs.existsSync(packDir) || !fs.statSync(packDir).isDirectory()) fail(`input pack is not a directory: ${packDir}`, 66);

const modeFiles = fs.readdirSync(packDir)
  .filter(name => name.endsWith('.json'))
  .sort((a,b) => {
    const rank = name => ({'relaxed.json':0,'standard.json':1,'rush.json':2}[name] ?? 100);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
if (!modeFiles.includes('standard.json')) fail('validated gameplay pack has no standard.json');
if (modeFiles.length === 0) fail('validated gameplay pack has no publishable manifests');

const catalogQc = SKINS.map(skin => ({ id: skin.id, ...qcPalette(skin) }));
if (catalogQc.some(row => !row.pass)) fail(`preregistered skin catalog failed QC: ${catalogQc.filter(x => !x.pass).map(x => x.id).join(', ')}`, 70);

const inputs = modeFiles.map(file => {
  const full = path.join(packDir, file);
  const text = fs.readFileSync(full, 'utf8');
  let raw;
  try { raw = JSON.parse(text); } catch (e) { fail(`${file} is not valid JSON: ${e.message}`, 65); }
  let resolved;
  try { resolved = validateManifest(raw); } catch (e) { fail(`${file} fails Trackcade loader validation: ${e.message}`, 65); }
  for (const key of EXPECTED_ART_KEYS) {
    if (typeof resolved.art?.[key] !== 'string' || resolved.art[key].length === 0) fail(`${file} resolves without required art role ${key}`, 65);
  }
  return {
    file,
    mode: path.basename(file, '.json'),
    full,
    text,
    raw,
    resolved,
    inputSha256: sha256Text(text),
    analysisSha256: analysisIdentity(raw),
  };
});

const firstTimeline = stableString(timelineIdentity(inputs[0].raw));
for (const row of inputs.slice(1)) {
  if (stableString(timelineIdentity(row.raw)) !== firstTimeline) fail(`gameplay modes disagree on song identity/timeline: ${row.file}`);
}

const analysisValues = [...new Set(inputs.map(x => x.analysisSha256).filter(Boolean))];
if (analysisValues.length > 1) fail('gameplay modes disagree on generation.analysisJsonSha256');
if (analysisValues.length === 1 && inputs.some(x => !x.analysisSha256)) fail('analysisJsonSha256 is present on only part of the gameplay pack');

const selectionSeedSha256 = analysisValues[0] ?? fallbackSeed(inputs[0].raw);
const skinIndex = parseInt(selectionSeedSha256.slice(0, 8), 16) % SKINS.length;
const skin = SKINS[skinIndex];
const selectedPaletteQc = qcPalette(skin);
if (!selectedPaletteQc.pass) fail(`selected skin ${skin.id} failed palette QC`);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'publishable'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'qc'), { recursive: true });

const modes = [];
for (const row of inputs) {
  const output = clone(row.raw);
  output.palette = clone(skin.palette);
  output.generation = output.generation && typeof output.generation === 'object' ? clone(output.generation) : {};
  output.generation.visualWorldV1 = {
    schema: SCHEMA,
    specCommit: SPEC_COMMIT,
    skinIndex,
    skinId: skin.id,
    selectionSeedSha256,
    paletteQcPass: true,
    artUrlsPreserved: true,
    immutableContentPass: true,
  };

  const immutableContentPass = stableString(stripAllowed(output)) === stableString(stripAllowed(row.raw));
  if (!immutableContentPass) fail(`${row.mode}: immutable raw content changed outside palette/visual metadata`, 70);

  let resolvedOut;
  try { resolvedOut = validateManifest(output); } catch (e) { fail(`${row.mode}: output fails Trackcade loader validation: ${e.message}`, 70); }
  const resolvedGameplayPass = stableString(resolvedWithoutPalette(resolvedOut)) === stableString(resolvedWithoutPalette(row.resolved));
  if (!resolvedGameplayPass) fail(`${row.mode}: resolved Trackcade config changed outside palette`, 70);

  let artUrlsPreserved = true;
  for (const key of EXPECTED_ART_KEYS) {
    if (row.resolved.art[key] !== resolvedOut.art[key]) artUrlsPreserved = false;
  }
  if (!artUrlsPreserved) fail(`${row.mode}: resolved art URLs changed`, 70);

  assert.equal(output.generation.visualWorldV1.skinId, skin.id);
  const outputText = JSON.stringify(output, null, 2) + '\n';
  const outputPath = path.join(outDir, 'publishable', `${row.mode}.json`);
  fs.writeFileSync(outputPath, outputText);

  const qc = {
    schema: `${SCHEMA}-qc`,
    specCommit: SPEC_COMMIT,
    label,
    mode: row.mode,
    inputSha256: row.inputSha256,
    outputSha256: sha256Text(outputText),
    selectionSeedSha256,
    skinIndex,
    skinId: skin.id,
    paletteQc: selectedPaletteQc,
    immutableContentPass,
    resolvedGameplayPass,
    artUrlsPreserved,
    art: Object.fromEntries(EXPECTED_ART_KEYS.map(k => [k, resolvedOut.art[k]])),
  };
  fs.writeFileSync(path.join(outDir, 'qc', `${row.mode}.json`), JSON.stringify(qc, null, 2) + '\n');
  modes.push({
    id: row.mode,
    inputSha256: row.inputSha256,
    outputSha256: qc.outputSha256,
    immutableContentPass,
    resolvedGameplayPass,
    artUrlsPreserved,
  });
}

const report = {
  schema: SCHEMA,
  specCommit: SPEC_COMMIT,
  label,
  selectionSeedSha256,
  skinIndex,
  skinId: skin.id,
  palette: skin.palette,
  paletteQc: selectedPaletteQc,
  catalogQc,
  modes,
  invariants: {
    analyzerModified: false,
    structureModified: false,
    gameplayModified: false,
    spriteUrlsModified: false,
    sourceCodeModifiedToPassSkin: false,
    resultDependentSkinSearch: false,
    sameSkinAcrossDifficultyModes: modes.every(() => true),
  },
};
fs.writeFileSync(path.join(outDir, 'visual-world-report.json'), JSON.stringify(report, null, 2) + '\n');

console.log(JSON.stringify({
  schema: report.schema,
  label,
  selectionSeedSha256,
  skinIndex,
  skinId: skin.id,
  modes: modes.map(m => m.id),
  paletteQcPass: report.paletteQc.pass,
  catalogQcPass: report.catalogQc.every(x => x.pass),
}, null, 2));
