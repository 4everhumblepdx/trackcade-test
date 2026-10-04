const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const T=require('./timing.js'),D=require('./difficulty.js');
const m=JSON.parse(fs.readFileSync(path.join(__dirname,'alldat-analyzer-test.json')));
const times=m.events.filter(e=>e.kind==='beat').map(e=>e.t),energy=t=>T.energyAt(m,t,m.songLength);
const selected=D.select(times,m.songLength,energy),summary=D.summary(times,m.songLength,energy);
test('all selected times and original indices are exact frozen grid members; no duplicates',()=>{
 assert.equal(times.length,590);assert.ok(selected.length>200&&selected.length<400);
 assert.equal(new Set(selected.map(d=>d.targetTime)).size,selected.length);
 for(const d of selected)assert.equal(d.targetTime,times[d.originalBeatIndex]);
});
test('selection and routes are deterministic across repeated runs',()=>{
 assert.deepEqual(D.select(times,m.songLength,energy),selected);
 const route=()=>{let previous=null;return selected.map((d,i)=>{const p=D.position(i,d,390,844,previous);previous={...p,targetTime:d.targetTime};return p;});};
 assert.deepEqual(route(),route());
});
test('opening density is lower than middle; finale density is higher',()=>{
 const [opening,early,middle,hard,finale]=summary.stages;
 assert.ok(opening.density<early.density&&early.density<middle.density&&middle.density<=hard.density&&hard.density<=finale.density);
});
test('first 10 percent teaches quarter-rate taps with no adjacent sequences, even at peak energy',()=>{
 for(const e of [0,.5,1]){
  const opening=D.select(times,m.songLength,()=>e).filter(d=>d.progress<.1);
  assert.ok(opening[0].targetTime>1); // intentional lead-in, using a later original beat
  for(let i=1;i<opening.length;i++)assert.equal(opening[i].originalBeatIndex-opening[i-1].originalBeatIndex,4);
 }
});
test('finale permits adjacent beats and short bursts without sustained every-beat overload',()=>{
 const late=selected.filter(d=>d.name==='finale');let longest=1,run=1;
 for(let i=1;i<late.length;i++){run=late[i].originalBeatIndex===late[i-1].originalBeatIndex+1?run+1:1;longest=Math.max(longest,run);}
 assert.ok(longest>=3&&longest<=5);
});
test('phone routes, visible circles, touch radii, and travel obey stage limits',()=>{
 for(const [w,h,insets] of [[390,844,{top:47,bottom:34}],[375,667,{}],[360,740,{}]]){
  let previous=null;const f=D.field(w,h,insets);
  selected.forEach((d,i)=>{
   const p=D.position(i,d,w,h,previous,insets);
   assert.ok(p.x-d.radius>=0&&p.x+d.radius<=w&&p.y-d.radius>=0&&p.y+d.radius<=h);
   assert.ok(p.x>=f.left&&p.x<=f.right&&p.y>=f.top&&p.y<=f.bottom);
   if(previous){const travel=Math.hypot(p.x-previous.x,p.y-previous.y);assert.ok(travel<=d.travel+1e-9);if(d.targetTime-previous.targetTime<.4)assert.ok(travel<=110+1e-9);}
   previous={...p,targetTime:d.targetTime};
  });
 }
});
test('windows, sizes, travel, and visual lead progress within bounded mobile ranges',()=>{
 assert.deepEqual(D.stages.map(s=>s.window),[.36,.34,.30,.27,.24]);
 assert.ok(D.stages.every(s=>s.radius>=30&&s.radius<=44&&s.lead>=.55&&s.lead<=.82));
 for(let i=1;i<D.stages.length;i++){assert.ok(D.stages[i].radius<=D.stages[i-1].radius);assert.ok(D.stages[i].travel>=D.stages[i-1].travel);}
});
test('energy cannot override progress bands or alter target timestamps',()=>{
 for(const e of [0,1]){
  const choices=D.select(times,m.songLength,()=>e);
  assert.ok(choices.every(d=>d.targetTime===times[d.originalBeatIndex]));
  assert.equal(D.profile(0,m.songLength,e).window,.36);
  assert.equal(D.decision(12,1,m.songLength,e).density,.25);
 }
});
test('full-song scheduler plus selection has bounded load and exact one-time opportunities',()=>{
 const grid=T.createTiming(m),used=[],live=[];let peak=0;
 for(let i=0;i<=Math.ceil(m.songLength*60);i++){
  const t=i/60;
  for(const next of grid.drain(t,m.songLength,.36,(_index,time)=>D.profile(time,m.songLength,energy(time)).lead)){
   const d=D.decision(next.index,next.targetTime,m.songLength,energy(next.targetTime));
   if(d.selected){used.push(d.targetTime);live.push(d);}
  }
  while(live.length&&live[0].targetTime+live[0].window+.18<t)live.shift();peak=Math.max(peak,live.length);
 }
 assert.deepEqual(used,selected.map(d=>d.targetTime));assert.ok(peak<=5);assert.equal(grid.skippedExpired,0);
});
test('BPM fallback remains available through gameplay selection',()=>{
 const t=T.createTiming({bpm:120,beatOffset:.1});assert.equal(t.source,'bpm-fallback');
 const chosen=[];for(let now=0;now<=20;now+=1/60)for(const beat of t.drain(now,20,.36))if(D.decision(beat.index,beat.targetTime,20,.5).selected)chosen.push(beat);
 assert.ok(chosen.length>0);for(const d of chosen)assert.equal(d.targetTime,.6+d.index*.5);
});
