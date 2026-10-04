// Local fixture decode only. No external page, provider, npm install or model.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright');
(async()=>{
 const repo=path.resolve(__dirname,'../..'),out=process.argv[2];if(!out)throw Error('Explicit local scratch output required');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER});
 const page=await browser.newPage();await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname==='/decode-research')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local audio decode</title>'});return route.continue();});
 await page.goto('http://127.0.0.1:8765/decode-research');const records=[];
 for(const filename of ['ALLDAT_ruffmix.mp3','cvb-gemf-sample.mp3']){
  const data=await page.evaluate(async filename=>{const bytes=await(await fetch('/'+filename)).arrayBuffer(),ctx=new OfflineAudioContext(1,1,22050),decoded=await ctx.decodeAudioData(bytes),renderer=new OfflineAudioContext(1,decoded.length,22050),source=renderer.createBufferSource();source.buffer=decoded;source.connect(renderer.destination);source.start();const mono=await renderer.startRendering(),pcm=mono.getChannelData(0),u8=new Uint8Array(pcm.buffer);let encoded='';for(let i=0;i<u8.length;i+=32768)encoded+=String.fromCharCode(...u8.subarray(i,i+32768));return {duration:mono.duration,sampleRate:mono.sampleRate,samples:mono.length,base64:btoa(encoded)};},filename);
  const pcm=Buffer.from(data.base64,'base64'),target=filename+'.f32';fs.writeFileSync(path.join(out,target),pcm);records.push({filename,pcmFile:target,duration:data.duration,sampleRate:data.sampleRate,samples:data.samples,inputAudioSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,filename))).digest('hex'),decodedPcmSha256:crypto.createHash('sha256').update(pcm).digest('hex')});
 }
 const browserVersion=browser.version();await browser.close();const metadata={schema:'micro-motif-v1-local-decode',decoder:'Chrome WebAudio OfflineAudioContext; mono 22050Hz float32 little-endian, no trimming or beat alignment',browser:browserVersion,records};fs.writeFileSync(path.join(out,'decode.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(records));
})().catch(e=>{console.error(e);process.exit(1)});
