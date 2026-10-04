const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=process.env.PULSE_SMOKE_OUTPUT||path.join(require('node:os').tmpdir(),'trackcade-pulse-smoke');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER||undefined,args:['--autoplay-policy=no-user-gesture-required']});
 const results=[];
 for(const name of ['cvb','alldat']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:8765/pulse-tap/?track=./${name}-analyzer-test.json&debug=1`;
  await page.goto(url);await page.waitForFunction(()=>window.pulseTapDebug?.audio.readyState>=2,{timeout:30000});
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
  if(fullRuntime.spawnedTargets!==(name==='cvb'?812:590)||!fullRuntime.finished||fullRuntime.maxTargets>8||fullRuntime.activeTargets!==0)throw Error(JSON.stringify(fullRuntime));
  if(errors.length||!paused.paused||!pauseStable||start.timingSource!=='explicit-beat-grid'||!end.finished||end.activeTargets!==0||replay.spawnedTargets!==0)throw Error(JSON.stringify({errors,start,end,replay,paused,pauseStable}));
  results.push({name,url,duration,start,fullRuntime,end,replay,pauseStable,errors});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://127.0.0.1:8765/pulse-tap/?track=./cvb-analyzer-test.json');
 await page.waitForFunction(()=>!!document.querySelector('canvas'));
 const normal=await page.evaluate(()=>({debugExposed:!!window.pulseTapDebug,error:document.getElementById('error').style.display==='block'}));
 if(normal.debugExposed||normal.error)throw Error('normal mode failed');
 await page.screenshot({path:path.join(out,'cvb-normal.png')});
 await browser.close();fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,normal,method:'Real MP3 loading, initial playback, pause/resume, seek to natural ending, replay reset. Both complete Phaser runtime timelines additionally simulated at 60fps with a test-only audio clock and tween updates; no subjective listening claim.'},null,2));
 console.log(JSON.stringify({pass:3,fail:0,results,normal}));
})().catch(e=>{console.error(e);process.exit(1)});
