#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const SPEC_COMMIT='14ec1c1ef541145dd4895c031291c2b6646add78';
const PNG_SIG=Buffer.from([137,80,78,71,13,10,26,10]);
const OUT_W=384,OUT_H=240;
function arg(n){const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:null;}
function fail(m,c=2){console.error(`REFUSE: ${m}`);process.exit(c);}
function sha256(b){return crypto.createHash('sha256').update(b).digest('hex');}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decode(buf){
 if(buf.length<8||!buf.subarray(0,8).equals(PNG_SIG))throw Error('invalid PNG signature');
 let off=8,ihdr=null,idat=[];
 while(off+12<=buf.length){const len=buf.readUInt32BE(off);off+=4;const type=buf.toString('ascii',off,off+4);off+=4;if(off+len+4>buf.length)throw Error(`truncated ${type}`);const d=buf.subarray(off,off+len);off+=len+4;if(type==='IHDR')ihdr=Buffer.from(d);else if(type==='IDAT')idat.push(Buffer.from(d));else if(type==='IEND')break;}
 if(!ihdr||!idat.length)throw Error('missing IHDR/IDAT');
 const width=ihdr.readUInt32BE(0),height=ihdr.readUInt32BE(4),bitDepth=ihdr[8],colorType=ihdr[9],compression=ihdr[10],filterMethod=ihdr[11],interlace=ihdr[12];
 if(width<768||height<480)throw Error(`candidate ${width}x${height} is below 768x480`);
 if(bitDepth!==8||![2,6].includes(colorType)||compression!==0||filterMethod!==0||interlace!==0)throw Error(`candidate must be non-interlaced 8-bit RGB/RGBA PNG; got bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
 const bpp=colorType===6?4:3,rowBytes=width*bpp,raw=zlib.inflateSync(Buffer.concat(idat)),expected=height*(rowBytes+1);if(raw.length!==expected)throw Error(`decompressed ${raw.length} != ${expected}`);
 const px=Buffer.alloc(width*height*4);let p=0,prev=Buffer.alloc(rowBytes);
 for(let y=0;y<height;y++){const f=raw[p++],src=raw.subarray(p,p+rowBytes);p+=rowBytes,row=Buffer.alloc(rowBytes);for(let x=0;x<rowBytes;x++){const a=x>=bpp?row[x-bpp]:0,b=prev[x]??0,c=x>=bpp?prev[x-bpp]:0;let v;if(f===0)v=src[x];else if(f===1)v=(src[x]+a)&255;else if(f===2)v=(src[x]+b)&255;else if(f===3)v=(src[x]+Math.floor((a+b)/2))&255;else if(f===4)v=(src[x]+paeth(a,b,c))&255;else throw Error(`unsupported filter ${f}`);row[x]=v;}for(let x=0;x<width;x++){const si=x*bpp,di=(y*width+x)*4;px[di]=row[si];px[di+1]=row[si+1];px[di+2]=row[si+2];px[di+3]=colorType===6?row[si+3]:255;}prev=row;}
 return{width,height,bitDepth,colorType,pixels:px};
}
function hex(s){if(!/^#[0-9a-fA-F]{6}$/.test(s))throw Error(`invalid color ${s}`);return[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));}
function normalize(d,topS,botS){
 const k=Math.min(Math.floor(d.width/OUT_W),Math.floor(d.height/OUT_H));if(k<2)throw Error(`integer reduction k=${k}; require >=2`);
 const cw=OUT_W*k,ch=OUT_H*k,cx=Math.floor((d.width-cw)/2),cy=Math.floor((d.height-ch)/2),top=hex(topS),bot=hex(botS),crop=Buffer.alloc(cw*ch*4);
 for(let y=0;y<ch;y++){const t=y/(ch-1),bg=[0,1,2].map(c=>Math.round(top[c]*(1-t)+bot[c]*t));for(let x=0;x<cw;x++){const si=((y+cy)*d.width+(x+cx))*4,di=(y*cw+x)*4,a=d.pixels[si+3];for(let c=0;c<3;c++)crop[di+c]=Math.round((d.pixels[si+c]*a+bg[c]*(255-a))/255);crop[di+3]=255;}}
 const out=Buffer.alloc(OUT_W*OUT_H*4),n=k*k,half=Math.floor(n/2);
 for(let oy=0;oy<OUT_H;oy++)for(let ox=0;ox<OUT_W;ox++){const sums=[0,0,0];for(let dy=0;dy<k;dy++)for(let dx=0;dx<k;dx++){const i=((oy*k+dy)*cw+(ox*k+dx))*4;sums[0]+=crop[i];sums[1]+=crop[i+1];sums[2]+=crop[i+2];}const o=(oy*OUT_W+ox)*4;out[o]=Math.floor((sums[0]+half)/n);out[o+1]=Math.floor((sums[1]+half)/n);out[o+2]=Math.floor((sums[2]+half)/n);out[o+3]=255;}
 return{pixels:out,k,crop:{x:cx,y:cy,width:cw,height:ch}};
}
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(t,d){const tb=Buffer.from(t,'ascii'),o=Buffer.alloc(12+d.length);o.writeUInt32BE(d.length,0);tb.copy(o,4);d.copy(o,8);o.writeUInt32BE(crc32(Buffer.concat([tb,d])),8+d.length);return o;}
function encode(px){const ih=Buffer.alloc(13);ih.writeUInt32BE(OUT_W,0);ih.writeUInt32BE(OUT_H,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc(OUT_H*(OUT_W*4+1));let p=0;for(let y=0;y<OUT_H;y++){raw[p++]=0;px.copy(raw,p,y*OUT_W*4,(y+1)*OUT_W*4);p+=OUT_W*4;}return Buffer.concat([PNG_SIG,chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function inspect(buf){const d=decodeFinal(buf);let colors=new Set(),opaque=0;for(let i=0;i<d.pixels.length;i+=4){if(d.pixels[i+3]===255)opaque++;colors.add(`${d.pixels[i]},${d.pixels[i+1]},${d.pixels[i+2]}`);}const total=OUT_W*OUT_H;return{width:OUT_W,height:OUT_H,bitDepth:8,colorType:6,interlace:0,alphaGt0Coverage:opaque/total,alphaGe128Coverage:opaque/total,fullyTransparentPixels:total-opaque,fullyOpaquePixels:opaque,distinctOpaqueishRgbColors:colors.size,fullImageBbox:opaque===total};}
function decodeFinal(buf){let off=8,ih,id=[];while(off+12<=buf.length){const n=buf.readUInt32BE(off);off+=4;const t=buf.toString('ascii',off,off+4);off+=4;const d=buf.subarray(off,off+n);off+=n+4;if(t==='IHDR')ih=Buffer.from(d);else if(t==='IDAT')id.push(Buffer.from(d));else if(t==='IEND')break;}if(ih.readUInt32BE(0)!==OUT_W||ih.readUInt32BE(4)!==OUT_H||ih[8]!==8||ih[9]!==6||ih[12]!==0)throw Error('final structure mismatch');const raw=zlib.inflateSync(Buffer.concat(id)),row=OUT_W*4,px=Buffer.alloc(OUT_W*OUT_H*4);let p=0;for(let y=0;y<OUT_H;y++){if(raw[p++]!==0)throw Error('final nonzero filter');raw.copy(px,y*row,p,p+row);p+=row;}return{pixels:px};}
const input=arg('--input'),output=arg('--output'),report=arg('--report'),top=arg('--sky-top'),bottom=arg('--sky-bottom'),label=arg('--label')??'skyline';if(!input||!output||!report||!top||!bottom){console.error('usage: normalize_skyline_v1_1.mjs --input source.png --output final.png --report report.json --sky-top #rrggbb --sky-bottom #rrggbb [--label name]');process.exit(64);}const ib=fs.readFileSync(input);let d,n;try{d=decode(ib);n=normalize(d,top,bottom);}catch(e){fail(e.message,65);}const ob=encode(n.pixels),q=inspect(ob);if(q.alphaGt0Coverage!==1||q.alphaGe128Coverage!==1||q.fullyTransparentPixels!==0||!q.fullImageBbox||q.distinctOpaqueishRgbColors<2)fail('final skyline QC failed',70);fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.mkdirSync(path.dirname(path.resolve(report)),{recursive:true});fs.writeFileSync(output,ob);const r={schema:'trackcade-skyline-normalization-v1.1',specCommit:SPEC_COMMIT,label,input:{sha256:sha256(ib),width:d.width,height:d.height,bitDepth:d.bitDepth,colorType:d.colorType},integerScale:n.k,crop:n.crop,background:{skyTop:top,skyBottom:bottom},downsample:{algorithm:'non-overlapping integer k×k sRGB box average',rounding:'floor((sum+floor(n/2))/n)',width:OUT_W,height:OUT_H},output:{sha256:sha256(ob),byteLength:ob.length,...q}};fs.writeFileSync(report,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));