const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const T=require('../pulse-tap/timing.js'),D=require('../pulse-tap/difficulty.js'),E=require('../pulse-tap/ending.js'),A=require('./private-plan.js');
const base=process.env.PULSE_BASE_URL||'http://127.0.0.1:8768/play.html';
const out=process.env.PULSE_SMOKE_OUTPUT||path.join(require('node:os').tmpdir(),'trackcade-private-artist-smoke');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER||undefined,args:['--autoplay-policy=no-user-gesture-required']});
 const results=[];
 for(const name of ['laid-back','wanna-get-lit','need-a-bag']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,`tracks/${name}.json`)));
  const ending=E.detect(manifest),plan=A.plan(T.createTiming(manifest).times,ending.playableEndTime,manifest,null,D,t=>T.energyAt(manifest,t,manifest.songLength),ending.releaseGap).filter(r=>r.selected);
  const expected=plan.length;
  const url=`${base}?song=${name}&debug=1`;
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
  await page.evaluate(()=>{window.pulseTapDebug.audio.currentTime=window.pulseTapDebug.scene.ending.playableEndTime-.1;});
  await page.waitForFunction(()=>window.pulseTapDebug.scene.finished);
  const end=await page.evaluate(()=>window.pulseTapDebug.snapshot());
  const postEnding=await page.evaluate(()=>({score:window.pulseTapDebug.scene.score,combo:window.pulseTapDebug.scene.combo,spawned:window.pulseTapDebug.scene.spawnedCount}));
  await page.mouse.click(195,400);await page.waitForTimeout(100);
  const afterTap=await page.evaluate(()=>({score:window.pulseTapDebug.scene.score,combo:window.pulseTapDebug.scene.combo,spawned:window.pulseTapDebug.scene.spawnedCount}));
  if(JSON.stringify(postEnding)!==JSON.stringify(afterTap))throw Error('Post-ending ordinary tap changed gameplay');
  const replayButton=await page.evaluate(()=>({x:window.pulseTapDebug.scene.replayHit.x,y:window.pulseTapDebug.scene.replayHit.y}));
  await page.mouse.click(replayButton.x,replayButton.y);await page.waitForFunction(()=>!window.pulseTapDebug.scene.finished&&!window.pulseTapDebug.scene.started);
  const replay=await page.evaluate(()=>window.pulseTapDebug.snapshot());
  const fullRuntime=await page.evaluate(finishBonus=>{
    const {audio,scene}=window.pulseTapDebug;const drawWorld=scene.drawBackdrop;scene.drawBackdrop=()=>{};audio.pause();scene.sys.game.loop.stop();
    scene.targets.forEach(t=>scene.destroyTarget(t));scene.resetRun();scene.started=true;
    const getDelta=scene.tweens.getDelta;scene.tweens.getDelta=()=>1000/60;
    let clock=0;Object.defineProperty(audio,'currentTime',{configurable:true,get:()=>clock});
    const impactTime=scene.timing.timeAt(4);
    clock=impactTime-.05;scene.update();clock=impactTime;scene.update();
    const impactTarget=scene.targets.find(t=>t.beatIndex===4);
    const impactProbe={geometry:impactTarget.ring.radius*impactTarget.ring.scaleX/impactTarget.core.radius,impactTime:impactTarget.musicalImpactTime,appearanceTime:impactTarget.presentationStartTime,actualFrame:impactTarget.impactFrameTime};
    scene.tryHit(impactTarget.x,impactTarget.y);impactProbe.hit=scene.lastHit;impactProbe.score=scene.score;
    if(Math.abs(impactProbe.geometry-1)>1e-9||impactProbe.hit.hitDelta!==0||impactProbe.hit.timingScore!==120||impactProbe.score!==120||impactProbe.appearanceTime>=impactProbe.impactTime)throw Error(JSON.stringify(impactProbe));
    scene.targets.forEach(t=>scene.destroyTarget(t));scene.resetRun();scene.started=true;clock=0;
    // Boundary probe: clear a live target and prohibit input even before the finish frame runs.
    const firstTime=scene.timing.timeAt(4),first=PulseDifficulty.decision(4,firstTime,scene.ending.playableEndTime,scene.energyAt(firstTime),scene.ending.releaseGap);
    scene.spawnTarget(firstTime,false,.82,4,first);
    const activeBefore=scene.targets.length;clock=scene.ending.playableEndTime;
    scene.tryHit(scene.targets[0].x,scene.targets[0].y);
    const preFrameInputBlocked=scene.score===0&&scene.combo===0&&scene.presentation.length===0;
    scene.update();const score=scene.score,combo=scene.combo,spawned=scene.spawnedCount;
    scene.tryHit(0,0);scene.flashText('MISS',0xffffff);scene.spawnTarget(firstTime,false,.82,4,first);
    const boundaryProbe={activeBefore,cleared:scene.targets.length===0,preFrameInputBlocked,postEndingInputBlocked:scene.score===score&&scene.combo===combo&&scene.spawnedCount===spawned&&scene.presentation.length===0};
    if(activeBefore!==1||!boundaryProbe.cleared||!preFrameInputBlocked||!boundaryProbe.postEndingInputBlocked)throw Error(JSON.stringify(boundaryProbe));
    scene.resetRun();scene.started=true;clock=0;
    const selectedTimes=[],sourceIndices=[];let firstFinishedTime=null,lastSpawnAudioTime=null;
    const spawn=scene.spawnTarget;scene.spawnTarget=function(...args){const count=this.spawnedCount;spawn.apply(this,args);if(this.spawnedCount>count){selectedTimes.push(args[0]);sourceIndices.push(args[3]);lastSpawnAudioTime=clock;}};
    for(let i=0;i<=Math.ceil(audio.duration*60);i++){
      clock=Math.min(i/60,audio.duration);scene.update();scene.tweens.update(i*1000/60,1000/60);
      if(scene.finished&&firstFinishedTime===null)firstFinishedTime=clock;
    }
    const result=scene.debugSnapshot();scene.spawnTarget=spawn;
    scene.resetRun();scene.started=true;clock=0;let expectedMaximum=0,perfectCombo=0;
    for(const row of scene.actionPlan.filter(r=>r.selected)){
      clock=row.presentationStartTime;scene.update();clock=row.musicalImpactTime+.003;scene.update();
      const target=scene.targets.find(t=>t.beatIndex===row.originalBeatIndex&&!t.hit&&!t.missed);
      if(!target)throw Error('Maximum-run target missing: '+row.originalBeatIndex);
      scene.tryHit(target.x,target.y);perfectCombo++;expectedMaximum+=Math.round(120*Math.min(3,1+Math.floor(perfectCombo/10)*.25));
      if(scene.combo!==perfectCombo||scene.lastHit.timingScore!==120)throw Error('Maximum run cannot preserve perfectCombo');
      scene.tweens.update(clock*1000,1000);scene.targets=scene.targets.filter(t=>t.core.active);
    }
    clock=scene.ending.playableEndTime;scene.update();expectedMaximum+=Math.round(finishBonus*Math.min(1.5,1+perfectCombo/100));
    const maximumRun={hits:perfectCombo,score:scene.score,expectedScore:expectedMaximum,bestCombo:scene.bestCombo,finished:scene.finished,toleranceSeconds:.005,testHitErrorSeconds:.003};
    if(maximumRun.score!==expectedMaximum||maximumRun.bestCombo!==perfectCombo||!maximumRun.finished)throw Error(JSON.stringify(maximumRun));
    result.maximumRun=maximumRun;delete audio.currentTime;scene.drawBackdrop=drawWorld;scene.tweens.getDelta=getDelta;scene.spawnTarget=spawn;
    return {...result,impactProbe,boundaryProbe,firstFinishedTime,lastSpawnAudioTime,selectedTimes,sourceIndices};
  },Number(manifest.finishBonus)||500);
  if(fullRuntime.spawnedTargets!==expected||!fullRuntime.finished||fullRuntime.maxTargets>8||fullRuntime.activeTargets!==0)throw Error(JSON.stringify(fullRuntime));
  if(JSON.stringify(fullRuntime.selectedTimes)!==JSON.stringify(plan.map(d=>d.targetTime))||JSON.stringify(fullRuntime.sourceIndices)!==JSON.stringify(plan.map(d=>d.originalBeatIndex)))throw Error('Runtime selected grid differs from exact plan');
  if(fullRuntime.firstFinishedTime<ending.playableEndTime||fullRuntime.firstFinishedTime-ending.playableEndTime>1/60+.00001||fullRuntime.lastSpawnAudioTime>=ending.playableEndTime)throw Error('Ending boundary violated');
  if(errors.length||!paused.paused||!pauseStable||start.timingSource!=='explicit-beat-grid'||!end.finished||end.activeTargets!==0||replay.spawnedTargets!==0)throw Error(JSON.stringify({errors,start,end,replay,paused,pauseStable}));
  results.push({name,url,duration,ending,start,fullRuntime,end,replay,postEndingTapUnchanged:true,pauseStable,errors});await page.close();
 }

 const previewChecks=[];
 for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:8768/preview.html');await page.waitForFunction(()=>window.artistPreview?.items.length===3);await page.waitForTimeout(300);
 const check=await page.evaluate(()=>({cards:document.querySelectorAll('article').length,originals:[...document.querySelectorAll('article')].map(a=>a.textContent.includes('Cartoonish Fortnite type vibe.')&&a.textContent.includes('zesty')&&a.textContent.includes('graffiti')),noOverflow:document.documentElement.scrollWidth<=innerWidth+2,canvasDistinct:new Set([...document.querySelectorAll('canvas')].map(c=>c.toDataURL())).size}));
 if(check.cards!==3||!check.originals.every(Boolean)||!check.noOverflow||check.canvasDistinct!==3||errors.length)throw Error(JSON.stringify({check,errors}));await page.screenshot({path:path.join(out,'previews-'+viewport.width+'.png'),fullPage:true});previewChecks.push({viewport,...check,errors});await page.close();
 }
 const page=await browser.newPage();const rejected=await page.request.get('http://127.0.0.1:8768/.git/config');if(rejected.status()!==404)throw Error('Private route isolation failed');await page.close();
 await browser.close();const report={results,previewChecks,scopeIsolation:true,method:'Real local MP3 load/play/pause/resume/ending/replay; test-only clock full timelines and exact maximum scoring; desktop/phone previews. Simulated full-timeline timing tests bypass decorative background drawing. No musical phase truth or physical-device latency validation.'};fs.writeFileSync(path.join(__dirname,'BROWSER_VERIFICATION.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({playtestGroupsPassed:3,previewGroupsPassed:2,scopeIsolation:true,failed:0,results:results.map(r=>({name:r.name,ending:r.ending,selected:r.fullRuntime.spawnedTargets,maximumRun:r.fullRuntime.maximumRun,boundary:r.fullRuntime.boundaryProbe,errors:r.errors}))}));
})().catch(e=>{console.error(e);process.exit(1)});
