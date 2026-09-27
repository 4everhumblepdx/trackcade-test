#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const SPEC_COMMIT = '0154bf24d3ab7128f01055cb1efac78b76336843';
const PNG_SIG = Buffer.from([137,80,78,71,13,10,26,10]);
const SRC_W=1536, SRC_H=1024, CROP_Y=32, CROP_W=1536, CROP_H=960, OUT_W=384, OUT_H=240;

function arg(name) { const i=process.argv.indexOf(name); return i>=0?process.argv[i+1]:null; }
function fail(msg,code=2){ console.error(`REFUSE: ${msg}`); process.exit(code); }
function sha256(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
function paeth(a,b,c){ const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c); return pa<=pb&&pa<=pc?a:pb<=pc?b:c; }

function decodePng(buf){
  if(buf.length<8||!buf.subarray(0,8).equals(PNG_SIG)) throw new Error('invalid PNG signature');
  let off=8, ihdr=null; const idat=[];
  while(off+12<=buf.length){
    const len=buf.readUInt32BE(off); off+=4;
    const type=buf.toString('ascii',off,off+4); off+=4;
    if(off+len+4>buf.length) throw new Error(`truncated PNG chunk ${type}`);
    const data=buf.subarray(off,off+len); off+=len; off+=4;
    if(type==='IHDR') ihdr=Buffer.from(data);
    else if(type==='IDAT') idat.push(Buffer.from(data));
    else if(type==='IEND') break;
  }
  if(!ihdr||ihdr.length!==13||!idat.length) throw new Error('missing PNG IHDR/IDAT');
  const width=ihdr.readUInt32BE(0),height=ihdr.readUInt32BE(4),bitDepth=ihdr[8],colorType=ihdr[9],compression=ihdr[10],filterMethod=ihdr[11],interlace=ihdr[12];
  if(width!==SRC_W||height!==SRC_H) throw new Error(`candidate dimensions ${width}x${height}; required ${SRC_W}x${SRC_H}`);
  if(bitDepth!==8||!([2,6].includes(colorType))||compression!==0||filterMethod!==0||interlace!==0) throw new Error(`candidate must be non-interlaced 8-bit RGB/RGBA PNG; got bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  const bpp=colorType===6?4:3;
  const rowBytes=width*bpp;
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const expected=height*(rowBytes+1);
  if(raw.length!==expected) throw new Error(`decompressed bytes ${raw.length}; expected ${expected}`);
  const pixels=Buffer.alloc(width*height*4);
  let pos=0; let prev=Buffer.alloc(rowBytes);
  for(let y=0;y<height;y++){
    const filter=raw[pos++]; const src=raw.subarray(pos,pos+rowBytes); pos+=rowBytes; const row=Buffer.alloc(rowBytes);
    for(let x=0;x<rowBytes;x++){
      const a=x>=bpp?row[x-bpp]:0,b=prev[x]??0,c=x>=bpp?prev[x-bpp]:0;
      let v;
      if(filter===0)v=src[x];
      else if(filter===1)v=(src[x]+a)&255;
      else if(filter===2)v=(src[x]+b)&255;
      else if(filter===3)v=(src[x]+Math.floor((a+b)/2))&255;
      else if(filter===4)v=(src[x]+paeth(a,b,c))&255;
      else throw new Error(`unsupported PNG filter ${filter}`);
      row[x]=v;
    }
    for(let x=0;x<width;x++){
      const si=x*bpp,di=(y*width+x)*4;
      pixels[di]=row[si]; pixels[di+1]=row[si+1]; pixels[di+2]=row[si+2]; pixels[di+3]=colorType===6?row[si+3]:255;
    }
    prev=row;
  }
  return {width,height,bitDepth,colorType,pixels};
}

function parseHex(s){
  if(!/^#[0-9a-fA-F]{6}$/.test(s)) throw new Error(`invalid color ${s}`);
  return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
}

function normalize(decoded,skyTop,skyBottom){
  const top=parseHex(skyTop),bot=parseHex(skyBottom);
  const crop=Buffer.alloc(CROP_W*CROP_H*4);
  for(let y=0;y<CROP_H;y++){
    const t=y/(CROP_H-1);
    const bg=[0,1,2].map(c=>Math.round(top[c]*(1-t)+bot[c]*t));
    for(let x=0;x<CROP_W;x++){
      const si=((y+CROP_Y)*SRC_W+x)*4, di=(y*CROP_W+x)*4, a=decoded.pixels[si+3];
      for(let c=0;c<3;c++) crop[di+c]=Math.round((decoded.pixels[si+c]*a+bg[c]*(255-a))/255);
      crop[di+3]=255;
    }
  }
  const out=Buffer.alloc(OUT_W*OUT_H*4);
  for(let oy=0;oy<OUT_H;oy++) for(let ox=0;ox<OUT_W;ox++){
    const sums=[0,0,0];
    for(let dy=0;dy<4;dy++) for(let dx=0;dx<4;dx++){
      const i=((oy*4+dy)*CROP_W+(ox*4+dx))*4;
      sums[0]+=crop[i]; sums[1]+=crop[i+1]; sums[2]+=crop[i+2];
    }
    const o=(oy*OUT_W+ox)*4;
    out[o]=Math.floor((sums[0]+8)/16); out[o+1]=Math.floor((sums[1]+8)/16); out[o+2]=Math.floor((sums[2]+8)/16); out[o+3]=255;
  }
  return out;
}

const crcTable=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function crc32(buf){ let c=0xffffffff; for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
function chunk(type,data){
  const tb=Buffer.from(type,'ascii'), out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0); tb.copy(out,4); data.copy(out,8);
  const crcInput=Buffer.concat([tb,data]); out.writeUInt32BE(crc32(crcInput),8+data.length); return out;
}
function encodeRgba(pixels){
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(OUT_W,0); ihdr.writeUInt32BE(OUT_H,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const raw=Buffer.alloc(OUT_H*(1+OUT_W*4)); let p=0;
  for(let y=0;y<OUT_H;y++){ raw[p++]=0; pixels.copy(raw,p,y*OUT_W*4,(y+1)*OUT_W*4); p+=OUT_W*4; }
  const compressed=zlib.deflateSync(raw,{level:9});
  return Buffer.concat([PNG_SIG,chunk('IHDR',ihdr),chunk('IDAT',compressed),chunk('IEND',Buffer.alloc(0))]);
}

function inspectFinal(buf){
  const d=decodeFinal(buf); const total=OUT_W*OUT_H; let opaque=0,transparent=0; const colors=new Set();
  for(let i=0;i<d.pixels.length;i+=4){
    const a=d.pixels[i+3]; if(a===255)opaque++; if(a===0)transparent++;
    if(a>=128) colors.add(`${d.pixels[i]},${d.pixels[i+1]},${d.pixels[i+2]}`);
  }
  return {width:d.width,height:d.height,bitDepth:d.bitDepth,colorType:d.colorType,interlace:d.interlace,alphaGt0Coverage:(total-transparent)/total,alphaGe128Coverage:opaque/total,fullyTransparentPixels:transparent,fullyOpaquePixels:opaque,distinctOpaqueishRgbColors:colors.size,fullImageBbox:opaque===total};
}
function decodeFinal(buf){
  if(buf.length<8||!buf.subarray(0,8).equals(PNG_SIG)) throw new Error('final invalid PNG signature');
  let off=8,ihdr=null;const idat=[];
  while(off+12<=buf.length){const len=buf.readUInt32BE(off);off+=4;const type=buf.toString('ascii',off,off+4);off+=4;const data=buf.subarray(off,off+len);off+=len+4;if(type==='IHDR')ihdr=Buffer.from(data);else if(type==='IDAT')idat.push(Buffer.from(data));else if(type==='IEND')break;}
  const width=ihdr.readUInt32BE(0),height=ihdr.readUInt32BE(4),bitDepth=ihdr[8],colorType=ihdr[9],interlace=ihdr[12];
  if(width!==OUT_W||height!==OUT_H||bitDepth!==8||colorType!==6||interlace!==0)throw new Error('final PNG structure mismatch');
  const rowBytes=OUT_W*4,raw=zlib.inflateSync(Buffer.concat(idat)),pixels=Buffer.alloc(OUT_W*OUT_H*4);let p=0;
  for(let y=0;y<OUT_H;y++){if(raw[p++]!==0)throw new Error('final PNG uses nonzero filter');raw.copy(pixels,y*rowBytes,p,p+rowBytes);p+=rowBytes;}
  return {width,height,bitDepth,colorType,interlace,pixels};
}

const inputArg=arg('--input'),outputArg=arg('--output'),reportArg=arg('--report'),skyTop=arg('--sky-top'),skyBottom=arg('--sky-bottom'),label=arg('--label')??'skyline';
if(!inputArg||!outputArg||!reportArg||!skyTop||!skyBottom){console.error('usage: normalize_skyline_v1.mjs --input source.png --output final.png --report report.json --sky-top #rrggbb --sky-bottom #rrggbb [--label name]');process.exit(64);}
const input=fs.readFileSync(inputArg); let decoded;
try{decoded=decodePng(input);}catch(e){fail(e.message,65);}
let pixels;try{pixels=normalize(decoded,skyTop,skyBottom);}catch(e){fail(e.message,65);}
const final=encodeRgba(pixels),inspection=inspectFinal(final);
if(inspection.alphaGt0Coverage!==1||inspection.alphaGe128Coverage!==1||inspection.fullyTransparentPixels!==0||!inspection.fullImageBbox||inspection.distinctOpaqueishRgbColors<2)fail('normalized skyline failed final structural/content QC',70);
fs.mkdirSync(path.dirname(path.resolve(outputArg)),{recursive:true});fs.mkdirSync(path.dirname(path.resolve(reportArg)),{recursive:true});
fs.writeFileSync(outputArg,final);
const report={schema:'trackcade-skyline-normalization-v1',specCommit:SPEC_COMMIT,label,input:{sha256:sha256(input),width:decoded.width,height:decoded.height,bitDepth:decoded.bitDepth,colorType:decoded.colorType},crop:{x:0,y:CROP_Y,width:CROP_W,height:CROP_H},background:{skyTop,skyBottom,blend:'straight alpha in 8-bit sRGB'},downsample:{algorithm:'non-overlapping 4x4 sRGB box average',rounding:'floor((sum+8)/16)',width:OUT_W,height:OUT_H},output:{sha256:sha256(final),byteLength:final.length,...inspection}};
fs.writeFileSync(reportArg,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));