const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createTiming,energyAt,sectionAt}=require('./timing.js');
for(const [name,count,sections] of [['cvb',812,8],['alldat',590,14]]){
 const m=JSON.parse(fs.readFileSync(path.join(__dirname,`${name}-analyzer-test.json`)));
 test(`${name}: exact safe grid and no semantic commands`,()=>{
  const times=m.events.filter(e=>e.kind==='beat').map(e=>e.t);
  assert.equal(times.length,count);assert.equal(m.events.filter(e=>e.kind==='section').length,sections);
  assert.equal(m.energyCurve.length,240);assert.equal(m.generation.timingTier,'loose');
  assert.ok(m.events.every(e=>e.kind==='beat'||e.kind==='section'));
  assert.ok(times.every((t,i)=>t>=0&&t<=m.songLength&&(!i||t>times[i-1])));
  assert.deepEqual(createTiming({...m,bpm:41,beatOffset:123}).times,times);
 });
 test(`${name}: whole-song frames schedule every exact source beat once`,()=>{
  const s=createTiming(m),used=[],live=[];let peak=0;
  for(let frame=0;frame<=Math.ceil(m.songLength*60);frame++){
   const now=frame/60;for(const e of s.drain(now,m.songLength)){used.push(e);live.push(e);}
   while(live.length && live[0].targetTime+0.30+0.18<now)live.shift();peak=Math.max(peak,live.length);
   assert.equal(s.drain(now,m.songLength).length,0,'same audio time cannot duplicate targets');
  }
  assert.deepEqual(used.map(e=>e.targetTime),m.events.filter(e=>e.kind==='beat').map(e=>e.t));
  assert.equal(new Set(used.map(e=>e.index)).size,count);assert.equal(s.skippedExpired,0);assert.ok(peak<8);
 });
 test(`${name}: long frame stalls do not accumulate expired targets`,()=>{
  const s=createTiming(m);s.drain(0,m.songLength);
  const due=s.drain(90,m.songLength);assert.ok(s.skippedExpired>0);assert.ok(due.length<8);
  assert.ok(due.every(e=>e.targetTime+0.30>=90));
 });
}
test('nonuniform spacing controls presentation lead but preserves musical timestamps',()=>{
 const s=createTiming({bpm:120,events:[{kind:'beat',t:.05},{kind:'beat',t:.35},{kind:'beat',t:1.25},{kind:'beat',t:1.5}]});
 assert.equal(s.source,'explicit-beat-grid');assert.equal(s.timeAt(0),.05);assert.equal(s.intervalAt(1),.9);
 const all=[];for(let i=0;i<150;i++)all.push(...s.drain(i/60,2));
 assert.deepEqual(all.map(x=>x.targetTime),[.05,.35,1.25,1.5]);assert.ok(new Set(all.map(x=>x.spawnAhead)).size>1);
});
test('unsorted duplicate events preserve distinct timestamps without double-spawning',()=>{
 const s=createTiming({events:[{kind:'beat',t:1},{kind:'beat',t:0},{kind:'beat',t:1},{kind:'beat',t:NaN},{kind:'beat',t:-1}]});
 assert.deepEqual(s.times,[0,1]);assert.deepEqual(s.drain(0,2).map(e=>e.targetTime),[0]);
 assert.deepEqual(s.drain(.5,2).map(e=>e.targetTime),[1]);assert.equal(s.drain(.5,2).length,0);
});
test('two valid coincident beat entries still select explicit timing and spawn once',()=>{
  const t=createTiming({bpm:118,events:[{kind:'beat',t:.221},{kind:'beat',t:.221}]});
  assert.equal(t.source,'explicit-beat-grid');
  assert.deepEqual(t.drain(.2).map(x=>x.targetTime),[.221]);
  assert.deepEqual(t.drain(.2),[]);
});

test('fallback retains clamped BPM and legacy initial offset behavior',()=>{
 for(const events of [[],[{kind:'beat',t:1}],[{kind:'beat',t:'1'}]]){
  const s=createTiming({bpm:120,beatOffset:.1,events});assert.equal(s.source,'bpm-fallback');
  const used=[];for(let i=0;i<=120;i++)used.push(...s.drain(i/60,2));
  assert.deepEqual(used.map(e=>e.targetTime),[.6,1.1,1.6]);
 }
 assert.equal(createTiming({bpm:120,beatOffset:1.2}).timeAt(0),1.2);
});
test('track end bounds scheduling and beat-driven backdrop lookup',()=>{
 const s=createTiming({events:[{kind:'beat',t:.1},{kind:'beat',t:.8},{kind:'beat',t:2}]});
 assert.equal(s.indexAt(0),-1);assert.equal(s.indexAt(.8),1);
 assert.deepEqual(s.drain(.6,1).map(e=>e.targetTime),[.8]); // .1 is expired after a frame jump
 assert.equal(s.drain(3,1).length,0);
});
test('zero energy remains zero; frozen sample times and generic sections drive presentation only',()=>{
 const m={energyCurve:[0,.9],generation:{energySampleTimes:[0,5]}};
 assert.equal(energyAt(m,0,10),0);assert.equal(energyAt(m,4.99,10),0);assert.equal(energyAt(m,5,10),.9);
 assert.deepEqual(sectionAt([{t:0,kind:'section'},{t:1,kind:'beat'},{t:5,kind:'section'}],2),{t:0,kind:'section'});
});
