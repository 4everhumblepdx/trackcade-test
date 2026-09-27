#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { FALLBACK_TRACK } from '../../src/track.config.js';

const SCHEMA = 'trackcade-art-assets-baseline-audit-v1';
const SPEC_COMMIT = 'b6ef8090d570e0e01d8cc5a8f232ae788d75497c';
const ROLES = ['player','obstacleLow','obstacleWall','orb','cell','skyline'];
const PNG_SIG = Buffer.from([137,80,78,71,13,10,26,10]);
const RUNTIME = {
  player: { width:49, height:64, source:'src/scenes/play.js drawPlayer basis' },
  obstacleLow: { width:64, height:33, source:'src/scenes/play.js drawObstacle low basis' },
  obstacleWall: { width:59, height:64, source:'src/scenes/play.js drawObstacle wall basis' },
  orb: { width:63, height:64, source:'src/scenes/play.js drawPickup orb basis' },
  cell: { width:36, height:64, source:'src/scenes/play.js drawPickup cell basis' },
  skyline: { width:384, height:240, source:'src/scenes/play.js skyline presentation aspect only' },
};

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function fail(message, code = 2) {
  console.error(`REFUSE: ${message}`);
  process.exit(code);
}

function paeth(a,b,c) {
  const p = a + b - c;
  const pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function parsePng(buf, role) {
  if (buf.length < 8 || !buf.subarray(0,8).equals(PNG_SIG)) throw new Error(`${role}: invalid PNG signature`);
  let off = 8;
  let ihdr = null;
  let plte = null;
  let trns = null;
  const idat = [];
  const chunks = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off); off += 4;
    const type = buf.toString('ascii', off, off+4); off += 4;
    if (off + len + 4 > buf.length) throw new Error(`${role}: truncated PNG chunk ${type}`);
    const data = buf.subarray(off, off+len); off += len;
    const crc = buf.readUInt32BE(off); off += 4;
    chunks.push({ type, length: len, crc32Hex: crc.toString(16).padStart(8,'0') });
    if (type === 'IHDR') ihdr = Buffer.from(data);
    else if (type === 'PLTE') plte = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
  }
  if (!ihdr || ihdr.length !== 13) throw new Error(`${role}: missing/invalid IHDR`);
  if (!idat.length) throw new Error(`${role}: no IDAT data`);
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compressionMethod = ihdr[10];
  const filterMethod = ihdr[11];
  const interlaceMethod = ihdr[12];
  const bytesPerPixel = ({0:1,2:3,3:1,4:2,6:4})[colorType] ?? null;
  const structure = {
    width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod,
    plteBytes: plte?.length ?? 0,
    trnsBytes: trns?.length ?? 0,
    idatChunks: idat.length,
    idatCompressedBytes: idat.reduce((n,b)=>n+b.length,0),
    chunks,
  };
  if (bitDepth !== 8 || interlaceMethod !== 0 || !bytesPerPixel || compressionMethod !== 0 || filterMethod !== 0) {
    return { structure, pixelAnalysisSupported:false, pixelAnalysisReason:'requires 8-bit, non-interlaced PNG color type 0/2/3/4/6 with standard compression/filter method' };
  }
  if (colorType === 3 && (!plte || plte.length < 3)) throw new Error(`${role}: indexed PNG missing PLTE`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rowBytes = width * bytesPerPixel;
  const expected = height * (rowBytes + 1);
  if (raw.length !== expected) throw new Error(`${role}: decompressed byte length ${raw.length} != expected ${expected}`);
  const rows = [];
  let pos = 0;
  let prev = Buffer.alloc(rowBytes);
  for (let y=0; y<height; y++) {
    const filter = raw[pos++];
    const src = raw.subarray(pos, pos+rowBytes); pos += rowBytes;
    const row = Buffer.alloc(rowBytes);
    for (let x=0; x<rowBytes; x++) {
      const a = x >= bytesPerPixel ? row[x-bytesPerPixel] : 0;
      const b = prev[x] ?? 0;
      const c = x >= bytesPerPixel ? prev[x-bytesPerPixel] : 0;
      let val;
      if (filter === 0) val = src[x];
      else if (filter === 1) val = (src[x] + a) & 255;
      else if (filter === 2) val = (src[x] + b) & 255;
      else if (filter === 3) val = (src[x] + Math.floor((a+b)/2)) & 255;
      else if (filter === 4) val = (src[x] + paeth(a,b,c)) & 255;
      else throw new Error(`${role}: unsupported PNG filter ${filter}`);
      row[x] = val;
    }
    rows.push(row);
    prev = row;
  }

  let transGray = null;
  let transRgb = null;
  if (colorType === 0 && trns?.length >= 2) transGray = trns.readUInt16BE(0);
  if (colorType === 2 && trns?.length >= 6) transRgb = [trns.readUInt16BE(0),trns.readUInt16BE(2),trns.readUInt16BE(4)];

  const alphaFor = (row, x) => {
    if (colorType === 0) {
      const g = row[x];
      return transGray !== null && g === transGray ? 0 : 255;
    }
    if (colorType === 2) {
      const i = x*3, rgb=[row[i],row[i+1],row[i+2]];
      return transRgb && rgb[0]===transRgb[0] && rgb[1]===transRgb[1] && rgb[2]===transRgb[2] ? 0 : 255;
    }
    if (colorType === 3) {
      const idx = row[x];
      return trns && idx < trns.length ? trns[idx] : 255;
    }
    if (colorType === 4) return row[x*2+1];
    return row[x*4+3];
  };

  const total = width * height;
  const alphaHistogram = new Array(256).fill(0);
  const thresholds = {
    gt0: { count:0, minX:width, minY:height, maxX:-1, maxY:-1 },
    ge128: { count:0, minX:width, minY:height, maxX:-1, maxY:-1 },
  };
  let minAlpha=255, maxAlpha=0;
  for (let y=0;y<height;y++) {
    const row=rows[y];
    for (let x=0;x<width;x++) {
      const a=alphaFor(row,x);
      alphaHistogram[a]++;
      if (a<minAlpha) minAlpha=a;
      if (a>maxAlpha) maxAlpha=a;
      if (a>0) {
        const s=thresholds.gt0; s.count++; s.minX=Math.min(s.minX,x); s.maxX=Math.max(s.maxX,x); s.minY=Math.min(s.minY,y); s.maxY=Math.max(s.maxY,y);
      }
      if (a>=128) {
        const s=thresholds.ge128; s.count++; s.minX=Math.min(s.minX,x); s.maxX=Math.max(s.maxX,x); s.minY=Math.min(s.minY,y); s.maxY=Math.max(s.maxY,y);
      }
    }
  }
  const finish = (s) => {
    if (!s.count) return { count:0, coverageFraction:0, bbox:null, bboxWidthFraction:0, bboxHeightFraction:0, margins:{left:width,right:width,top:height,bottom:height}, touches:{left:false,right:false,top:false,bottom:false} };
    const bboxWidth=s.maxX-s.minX+1, bboxHeight=s.maxY-s.minY+1;
    const margins={left:s.minX,right:width-1-s.maxX,top:s.minY,bottom:height-1-s.maxY};
    return {
      count:s.count,
      coverageFraction:s.count/total,
      bbox:{minX:s.minX,minY:s.minY,maxX:s.maxX,maxY:s.maxY,width:bboxWidth,height:bboxHeight},
      bboxWidthFraction:bboxWidth/width,
      bboxHeightFraction:bboxHeight/height,
      margins,
      touches:{left:margins.left===0,right:margins.right===0,top:margins.top===0,bottom:margins.bottom===0},
    };
  };
  const transparent = alphaHistogram[0];
  const opaque = alphaHistogram[255];
  const partial = total-transparent-opaque;
  return {
    structure,
    pixelAnalysisSupported:true,
    alpha:{
      totalPixels:total,
      minAlpha,maxAlpha,
      fullyTransparentPixels:transparent,
      fullyTransparentFraction:transparent/total,
      partiallyTransparentPixels:partial,
      partiallyTransparentFraction:partial/total,
      fullyOpaquePixels:opaque,
      fullyOpaqueFraction:opaque/total,
      gt0:finish(thresholds.gt0),
      ge128:finish(thresholds.ge128),
    },
  };
}

async function download(url, role) {
  const res = await fetch(url, { redirect:'follow' });
  if (!res.ok) throw new Error(`${role}: HTTP ${res.status} downloading ${url}`);
  const arr = await res.arrayBuffer();
  return { bytes:Buffer.from(arr), finalUrl:res.url, contentType:res.headers.get('content-type') ?? null };
}

const outputArg = getArg('--output');
const downloadDirArg = getArg('--download-dir');
if (!outputArg || !downloadDirArg) {
  console.error('usage: audit_baseline_assets_v1.mjs --output report.json --download-dir dir');
  process.exit(64);
}
const output = path.resolve(outputArg);
const downloadDir = path.resolve(downloadDirArg);
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.mkdirSync(downloadDir, {recursive:true});

const roleRecords = {};
for (const role of ROLES) {
  const url = FALLBACK_TRACK.art[role];
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) fail(`${role}: invalid FALLBACK_TRACK art URL`,65);
  let dl;
  try { dl = await download(url,role); } catch (e) { fail(e.message,69); }
  const file = path.join(downloadDir, `${role}.png`);
  fs.writeFileSync(file, dl.bytes);
  let parsed;
  try { parsed = parsePng(dl.bytes, role); } catch (e) { fail(e.message,65); }
  if (!parsed.pixelAnalysisSupported) fail(`${role}: ${parsed.pixelAnalysisReason}`,65);
  const rt=RUNTIME[role];
  const srcAspect=parsed.structure.width/parsed.structure.height;
  const runtimeAspect=rt.width/rt.height;
  roleRecords[role] = {
    role,
    url,
    finalUrl:dl.finalUrl,
    httpContentType:dl.contentType,
    byteLength:dl.bytes.length,
    sha256:sha256(dl.bytes),
    pngSignatureValid:true,
    ...parsed,
    runtimePresentation:{...rt,aspect:runtimeAspect},
    comparison:{
      exactDimensionMatch:parsed.structure.width===rt.width && parsed.structure.height===rt.height,
      sourceAspect:srcAspect,
      runtimeAspect,
      aspectDelta:srcAspect-runtimeAspect,
      aspectRatioMultiple:srcAspect/runtimeAspect,
      sourceWidthMultiple:parsed.structure.width/rt.width,
      sourceHeightMultiple:parsed.structure.height/rt.height,
    },
  };
}

const report={
  schema:SCHEMA,
  specCommit:SPEC_COMMIT,
  provenance:{
    analyzerReleaseBranch:'release/analyzer-v0.19',
    analyzerSourceCommit:'e308d867980fb1877c3f2e4ce27950deecac0855',
    analyzerRunnerSha256:'9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432',
    structureSafeManifestArtifactDigest:'sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87',
    gameplayClosureCommit:'141bf6127d7af763ea04e497bfe5fcf6e5ff364c',
    gameplayVariantArtifactDigest:'sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8',
    visualWorldClosureCommit:'8c3bc6dc07067c3cea016ff76b2023a29fde7933',
    visualWorldArtifactDigest:'sha256:054e34dbb20a10184138167066476d64e9a5ede42c1c6bbbd19ae156ba29ada0',
  },
  engineFrameBehavior:{
    preloadMethod:'load.image(url)',
    lookupMethod:'game.assets.framesOf(url)',
    frameWidthArgument:null,
    frameHeightArgument:null,
    fullHeightRow:true,
    atlasDefaultFrameWidth:'src.width',
    effectiveFramesPerRole:1,
  },
  runtimePresentationConstants:RUNTIME,
  roles:roleRecords,
  recommendations:[],
  acceptanceThresholds:[],
};
fs.writeFileSync(output, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  schema:report.schema,
  roles:Object.fromEntries(ROLES.map(role=>[role,{
    dimensions:[roleRecords[role].structure.width,roleRecords[role].structure.height],
    colorType:roleRecords[role].structure.colorType,
    alphaGt0:roleRecords[role].alpha.gt0.coverageFraction,
    alphaGe128:roleRecords[role].alpha.ge128.coverageFraction,
    sha256:roleRecords[role].sha256,
  }]))
},null,2));