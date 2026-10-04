const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const T=require('./timing.js'),D=require('./difficulty.js');
const base=process.env.PULSE_BASE_URL||'http://127.0.0.1:8765/pulse-tap/';
const out=process.env.PULSE_SMOKE_OUTPUT||path.join(require('node:os').tmpdir(),'trackcade-pulse-smoke');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER||undefined,args:['--autoplay-policy=no-user-gesture-required']});
 const results=[];
 for(const name of ['cvb','alldat']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,`${name}-analyzer-test.json`)));
  const expected=D.select(T.createTiming(manifest).times,manifest.songLength,t=>T.energyAt(manifest,t,manifest.songLength)).length;
  const url=`${base}?track=./${name}-analyzer-test.json&debug=1`;
  await page.goto(url);await page.waitForFunction(()=>window.pulseTapDebug?.audio.readyState>=2,null,{timeout:60000});
  await page.mouse.click(195,607);await page.waitForFunction(()=>window.pulseTapDebug.audio.currentTime>2);
  const start=await page.evaluate(()=>window.pulseTapDebug.snapshot());
  await page.evaluate(()=>window.pulseTapDebug.scene.togglePause());
  const paused=await page.evaluate(()=>({paused:window.pulseTapDebug.audio.paused,time:window.pulseTapDebug.audio.currentTime}));
  await page.waitForTimeout(300);
  const pauseStable=await page.evaluate(t=>Math.abs(window.pulseTapDebug.audio.currentTime-t)<.02,paused.time);
  await page.evaluate(()=>window.pulseTapDebug.scene.togglePause());
  await page.waitForFunction(t=>window.pulseTapDebug.audio.currentTime>t+.2,paused.time);
  await page.screenshot({path:path.join(out,`${name}-debug.png`)});
  const duration=await page.evaluate(()=>window.pulseTapDebug.audio.duration);
  await page.evaluate(()=>{window.pulseTapDebug.audio.currentTime=window.pulseTapDebug.audio.duration-.1;});
  await page.waitForFunction(()=>window.pulseTapDebug.scene.finished);
  const end=await page.evaluate(()=>window.pulseTapDebug.snapshot());
  await page.mouse.click(195,607);await page.waitForFunction(()=>!window.pulseTapDebug.scene.finished&&!window.pulseTapDebug.scene.started);
  const replay=await page.evaluate(()=>window.pulseTapDebug.snapshot());
  const fullRuntime=await page.evaluate(()=>{
    const {audio,scene}=window.pulseTapDebug;audio.pause();scene.sys.game.loop.stop();
    scene.targets.forEach(t=>scene.destroyTarget(t));scene.resetRun();scene.started=true;
    const getDelta=scene.tweens.getDelta;scene.tweens.getDelta=()=>1000/60;
    let clock=0;Object.defineProperty(audio,'currentTime',{configurable:true,get:()=>clock});
    for(let i=0;i<=Math.ceil(audio.duration*60);i++){
      clock=Math.min(i/60,audio.duration);scene.update();scene.tweens.update(i*1000/60,1000/60);
    }
    const result=scene.debugSnapshot();delete audio.currentTime;scene.tweens.getDelta=getDelta;
    return result;
  });
  if(fullRuntime.spawnedTargets!==expected||!fullRuntime.finished||fullRuntime.maxTargets>8||fullRuntime.activeTargets!==0)throw Error(JSON.stringify(fullRuntime));
  if(errors.length||!paused.paused||!pauseStable||start.timingSource!=='explicit-beat-grid'||!end.finished||end.activeTargets!==0||replay.spawnedTargets!==0)throw Error(JSON.stringify({errors,start,end,replay,paused,pauseStable}));
  results.push({name,url,duration,start,fullRuntime,end,replay,pauseStable,errors});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let defaultAudio=false;page.on('request',r=>{if(r.url().includes('ALLDAT_ruffmix.mp3'))defaultAudio=true;});
 await page.goto(base);
 await page.waitForFunction(()=>!!document.querySelector('canvas'));
 const normal=await page.evaluate(()=>({debugExposed:!!window.pulseTapDebug,error:document.getElementById('error').style.display==='block'}));
 if(normal.debugExposed||normal.error||!defaultAudio)throw Error('normal default ALLDAT mode failed');
 await page.screenshot({path:path.join(out,'alldat-normal.png')});await page.close();
 const phones=[];
 for(const viewport of [{width:375,height:667},{width:360,height:740}]){
  const phone=await browser.newPage({viewport,isMobile:true,hasTouch:true});const errors=[];phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(`${base}?debug=1`);await phone.waitForFunction(()=>window.pulseTapDebug?.audio.readyState>=2);
  await phone.touchscreen.tap(viewport.width/2,viewport.height*.72);
  await phone.waitForFunction(()=>window.pulseTapDebug.scene.targets.some(t=>!t.missed&&!t.hit));
  const target=await phone.evaluate(()=>{const t=window.pulseTapDebug.scene.targets.find(t=>!t.missed&&!t.hit);return {x:t.x,y:t.y,time:t.targetTime};});
  await phone.waitForFunction(t=>window.pulseTapDebug.audio.currentTime>=t-.05,target.time);
  await phone.touchscreen.tap(target.x,target.y);
  const hit=await phone.evaluate(()=>({score:window.pulseTapDebug.scene.score,delta:window.pulseTapDebug.scene.lastHitDelta,paused:window.pulseTapDebug.scene.paused}));
  const pause=await phone.evaluate(()=>({x:window.pulseTapDebug.scene.pauseHit.x,y:window.pulseTapDebug.scene.pauseHit.y,size:window.pulseTapDebug.scene.pauseHit.width}));
  await phone.touchscreen.tap(pause.x,pause.y);await phone.waitForFunction(()=>window.pulseTapDebug.scene.paused&&window.pulseTapDebug.audio.paused);
  await phone.touchscreen.tap(pause.x,pause.y);await phone.waitForFunction(()=>!window.pulseTapDebug.scene.paused&&!window.pulseTapDebug.audio.paused);
  if(hit.score<=0||Math.abs(hit.delta)>.36||pause.size<44||errors.length)throw Error(JSON.stringify({viewport,hit,pause,errors}));
  await phone.screenshot({path:path.join(out,`mobile-${viewport.width}.png`)});phones.push({viewport,hit,pause,errors});await phone.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,normal,defaultAudio,phones,method:'Real MP3 playback, pause/resume, natural endings after seek, replay reset, two portrait touch emulations with successful hits, normal ALLDAT default. Complete Phaser timelines simulated at 60fps with test-only audio clock and tween delta. Not a physical Safari/Android test or subjective musical judgment.'},null,2));
 console.log(JSON.stringify({pass:5,fail:0,results,normal,defaultAudio,phones}));
})().catch(e=>{console.error(e);process.exit(1)});
