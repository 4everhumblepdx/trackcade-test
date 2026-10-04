// Explicit local paths, scratch PCM, once-only locks. No audio copied into repository.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),{chromium}=require('playwright');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const [manifestPath,out,freezeCommit]=process.argv.slice(2);if(!manifestPath||!out)throw Error('Explicit input manifest and scratch output required');
 const root=path.resolve(__dirname,'../..'),scratch=path.resolve(out);if(scratch.toLowerCase().startsWith(root.toLowerCase()+path.sep))throw Error('PCM must remain outside repository');
 const inputs=JSON.parse(fs.readFileSync(manifestPath,'utf8'));fs.mkdirSync(scratch,{recursive:true});
 if(inputs.records.some(r=>r.role==='blind-external')){
  if(!freezeCommit)throw Error('External decode requires committed preflight');const f=JSON.parse(fs.readFileSync(path.join(__dirname,'PREFLIGHT.json'),'utf8'));
  for(const [name,h]of Object.entries(f.codeSha256))if(hash(fs.readFileSync(path.join(__dirname,name)))!==h)throw Error('Frozen code changed');
  const bytes=cp.execFileSync('git',['show',freezeCommit+':research/micro-motif-v2/PREFLIGHT.json'],{cwd:root});if(!bytes.equals(fs.readFileSync(path.join(__dirname,'PREFLIGHT.json'))))throw Error('Invalid freeze commit');
 }
 const routes=new Map();const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname;if(p==='/decode'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Private local decode</title>');}const file=routes.get(p);if(!file){res.statusCode=404;return res.end();}res.setHeader('Content-Type','audio/mpeg');fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER}),page=await browser.newPage();await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await page.goto(base+'/decode');const records=[];
 try{for(const record of inputs.records){
  if(!path.isAbsolute(record.audioPath))throw Error('Absolute explicit input required');
  const lock=path.join(scratch,record.id+'.decode-attempt.json');fs.writeFileSync(lock,JSON.stringify({id:record.id,freezeCommit:freezeCommit||null,retries:0}),{flag:'wx'});
  routes.set('/audio/'+record.id,record.audioPath);const inputSha=hash(fs.readFileSync(record.audioPath));
  const data=await page.evaluate(async id=>{const bytes=await(await fetch('/audio/'+id)).arrayBuffer(),ctx=new OfflineAudioContext(1,1,22050),decoded=await ctx.decodeAudioData(bytes),renderer=new OfflineAudioContext(1,decoded.length,22050),source=renderer.createBufferSource();source.buffer=decoded;source.connect(renderer.destination);source.start();const mono=await renderer.startRendering(),pcm=mono.getChannelData(0),u8=new Uint8Array(pcm.buffer);let encoded='';for(let i=0;i<u8.length;i+=32768)encoded+=String.fromCharCode(...u8.subarray(i,i+32768));return {duration:mono.duration,sampleRate:mono.sampleRate,samples:mono.length,base64:btoa(encoded)};},record.id);
  const pcm=Buffer.from(data.base64,'base64'),pcmPath=path.join(scratch,record.id+'.f32');fs.writeFileSync(pcmPath,pcm,{flag:'wx'});delete data.base64;records.push({id:record.id,role:record.role,filename:path.basename(record.audioPath),inputAudioSha256:inputSha,decodedPcmSha256:hash(pcm),pcmPath,...data,decodeAttemptLock:hash(fs.readFileSync(lock)),freezeCommit:freezeCommit||null});routes.delete('/audio/'+record.id);
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(scratch,'decoded.json'),JSON.stringify({decoder:'Chrome WebAudio mono float32 22050Hz; no trimming',browser:browser.version(),records},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(records));
})().catch(e=>{console.error(e);process.exit(1)});
