const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('./ending.js'),T=require('./timing.js'),D=require('./difficulty.js');
const fixture=name=>require(`./${name}-analyzer-test.json`);
const synthetic=()=>({songLength:200,bpm:60,events:Array.from({length:200},(_,i)=>({kind:'beat',t:i})),energyCurve:Array.from({length:200},(_,i)=>i>=180?.03:.7),generation:{energySampleTimes:Array.from({length:200},(_,i)=>i)}});
test('ALLDAT ending is deterministic with exact objective suffix provenance',()=>{
 const m=fixture('alldat'),e=E.detect(m);assert.deepEqual(E.detect(m),e);assert.equal(e.playableEndTime,190.357);assert.equal(e.rawDuration,196.075102);
 assert.equal(e.source,'frozen-energy-terminal-suffix');assert.equal(e.evidence.lowSampleCount,7);assert.equal(e.evidence.threshold,.1);assert.ok(e.evidence.observedLowSpan>4.9);
});
test('mid-song quiet followed by recovery never becomes an ending',()=>{
 const m=synthetic();m.energyCurve=m.energyCurve.map((_e,i)=>i>=80&&i<110?.02:.7);assert.equal(E.detect(m).playableEndTime,200);
});
test('earlier quiet is ignored when a distinct terminal collapse exists',()=>{
 const m=synthetic();for(let i=40;i<70;i++)m.energyCurve[i]=.01;assert.equal(E.detect(m).playableEndTime,180);
});
test('short terminal evidence falls back; CVB retains decoded duration',()=>{
 const m=synthetic();m.energyCurve=m.energyCurve.map((_e,i)=>i>=198?.01:.7);assert.equal(E.detect(m).playableEndTime,200);
 const cvb=E.detect(fixture('cvb'),309.420408);assert.equal(cvb.playableEndTime,309.420408);assert.equal(cvb.reason,'terminal-collapse-not-sufficiently-sustained');
});
test('missing invalid stale or all-quiet evidence falls back to actual duration',()=>{
 for(const mutate of [m=>delete m.generation,m=>m.energyCurve[190]='0.01',m=>m.generation.energySampleTimes[190]=0,m=>m.energyCurve.fill(.01),m=>{m.energyCurve=m.energyCurve.slice(0,190);m.generation.energySampleTimes=m.generation.energySampleTimes.slice(0,190);}]){
  const m=synthetic();mutate(m);assert.equal(E.detect(m,201).playableEndTime,201);assert.equal(E.detect(m,201).source,'duration-fallback');
 }
});
test('collapse candidate outside terminal 15 percent is rejected conservatively',()=>{
 const m=synthetic();m.energyCurve=m.energyCurve.map((_e,i)=>i>=100?.02:.7);assert.equal(E.detect(m).playableEndTime,200);
});
test('ending detector never mutates frozen musical fields',()=>{
 for(const name of ['alldat','cvb']){const m=fixture(name),before=JSON.stringify(m);E.detect(m);assert.equal(JSON.stringify(m),before);}
});
test('both fixtures select exact source times with complete windows and release gap',()=>{
 for(const name of ['alldat','cvb']){
  const m=fixture(name),e=E.detect(m),times=T.createTiming(m).times,chosen=D.select(times,e.playableEndTime,t=>T.energyAt(m,t,m.songLength),e.releaseGap);
  assert.ok(e.playableEndTime-chosen.at(-1).targetTime>=e.releaseGap);
  for(const d of chosen){assert.equal(d.targetTime,times[d.originalBeatIndex]);assert.ok(E.targetFits(d.targetTime,d.window,e));}
 }
});
test('no play at or after boundary and no crossing target window',()=>{
 const e=E.detect(fixture('alldat'));assert.ok(E.canPlay(e.playableEndTime-.001,e.playableEndTime));assert.equal(E.canPlay(e.playableEndTime,e.playableEndTime),false);assert.equal(E.canPlay(e.playableEndTime+1,e.playableEndTime),false);assert.equal(E.targetFits(e.playableEndTime-.1,.34,e),false);
});
