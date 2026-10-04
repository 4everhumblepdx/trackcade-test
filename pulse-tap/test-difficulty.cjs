const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('./timing.js'),D=require('./difficulty.js'),E=require('./ending.js');
const m=require('./alldat-analyzer-test.json'),ending=E.detect(m),end=ending.playableEndTime,times=T.createTiming(m).times,energy=t=>T.energyAt(m,t,m.songLength);
const selected=D.select(times,end,energy,ending.releaseGap),summary=D.summary(times,end,energy,ending.releaseGap),stage=name=>summary.stages.find(s=>s.stage===name);
test('exact grid membership deterministic selection and no duplicate target',()=>{
 assert.equal(times.length,590);assert.ok(selected.length>282);assert.deepEqual(D.select(times,end,energy,ending.releaseGap),selected);assert.equal(new Set(selected.map(d=>d.targetTime)).size,selected.length);for(const d of selected)assert.equal(d.targetTime,times[d.originalBeatIndex]);
});
test('opening protects against demanding sequences even at peak energy',()=>{
 for(const e of [0,.5,1]){const first=D.select(times,end,()=>e,ending.releaseGap).filter(d=>d.targetTime<6);assert.ok(first[0].targetTime>1);for(let i=1;i<first.length;i++)assert.equal(first[i].originalBeatIndex-first[i-1].originalBeatIndex,4);}
});
test('Mid Hard Push is after midpoint and harder than Developing',()=>{
 const a=stage('mid-hard-push'),b=stage('developing');assert.ok(a.density>b.density&&a.targetsPerSecond>b.targetsPerSecond&&a.hitWindowRange[1]<b.hitWindowRange[0]&&a.radiusRange[1]<b.radiusRange[0]&&a.travelRange[0]>b.travelRange[1]);assert.ok(selected.filter(d=>d.name===a.stage).every(d=>d.progress>=.5&&d.progress<.63));
});
test('Relief eases first peak while staying harder than Opening and Build',()=>{
 const a=stage('relief'),b=stage('mid-hard-push'),c=stage('build');assert.ok(a.density<b.density&&a.hitWindowRange[0]>b.hitWindowRange[1]&&a.travelRange[1]<b.travelRange[0]);assert.ok(a.density>c.density&&a.density>stage('opening').density&&a.hitWindowRange[1]<c.hitWindowRange[0]&&a.radiusRange[1]<c.radiusRange[0]);
});
test('Final Build climbs after Relief and exceeds first peak by its end',()=>{
 assert.ok(stage('final-build').density>stage('relief').density);const a=D.profile(end*.72,end,.5),b=D.profile(end*.819999,end,.5),c=D.profile(end*.56,end,.5);assert.ok(b.window<a.window&&b.radius<a.radius&&b.travel>a.travel&&b.window<c.window&&b.radius<c.radius&&b.travel>c.travel);
});
test('Final Climax has highest action rate density and natural scoring opportunity',()=>{
 const a=stage('final-climax');for(const b of summary.stages.filter(s=>s!==a))assert.ok(a.density>b.density&&a.targetsPerSecond>b.targetsPerSecond&&a.hitWindowRange[1]<b.hitWindowRange[0]&&a.radiusRange[1]<b.radiusRange[0]&&a.travelRange[0]>b.travelRange[1]);assert.equal(a.hitWindowRange[0],.23);
 const late=selected.filter(d=>d.name===a.stage);let longest=1,run=1;for(let i=1;i<late.length;i++){run=late[i].originalBeatIndex===late[i-1].originalBeatIndex+1?run+1:1;longest=Math.max(longest,run);}assert.ok(longest>=3&&longest<=5);
});
test('Landing is easier than both peaks with no hardest play at ending',()=>{
 const a=stage('landing');for(const n of ['mid-hard-push','final-climax']){const b=stage(n);assert.ok(a.density<b.density&&a.hitWindowRange[0]>b.hitWindowRange[1]&&a.travelRange[1]<b.travelRange[0]);}assert.equal(D.profile(end,end,1).name,'landing');assert.ok(end-selected.at(-1).targetTime>=ending.releaseGap);assert.equal(selected.at(-1).name,'landing');
});
test('phone routes are deterministic reachable and obey travel caps',()=>{
 for(const [w,h,insets] of [[390,844,{top:47,bottom:34}],[375,667,{}],[360,740,{}]]){
  const route=()=>{let previous=null;const f=D.field(w,h,insets);return selected.map((d,i)=>{const p=D.position(i,d,w,h,previous,insets);assert.ok(p.x-d.radius>=0&&p.x+d.radius<=w&&p.y-d.radius>=0&&p.y+d.radius<=h&&p.x>=f.left&&p.x<=f.right&&p.y>=f.top&&p.y<=f.bottom);if(previous){const distance=Math.hypot(p.x-previous.x,p.y-previous.y);assert.ok(distance<=d.travel+1e-9);if(d.targetTime-previous.targetTime<.4)assert.ok(distance<=110+1e-9);}previous={...p,targetTime:d.targetTime};return p;});};assert.deepEqual(route(),route());
 }
});
test('bounded energy never bypasses the designed stage arc',()=>{
 for(const e of [0,1]){assert.equal(D.profile(3,end,e).window,.36);assert.equal(D.decision(12,3,end,e).density,.25);assert.equal(D.profile(end*.85,end,e).name,'final-climax');assert.equal(D.profile(end*.97,end,e).name,'landing');}
});
test('both full timelines select exactly once with bounded target load',()=>{
 for(const name of ['alldat','cvb']){
  const m=require(`./${name}-analyzer-test.json`),e=E.detect(m),energy=t=>T.energyAt(m,t,m.songLength),grid=T.createTiming(m),used=[],live=[];let peak=0;
  for(let i=0;i<Math.ceil(e.playableEndTime*60);i++){const now=i/60;if(!E.canPlay(now,e.playableEndTime))break;for(const b of grid.drain(now,e.playableEndTime,.36,(_i,t)=>D.profile(t,e.playableEndTime,energy(t)).lead)){const d=D.decision(b.index,b.targetTime,e.playableEndTime,energy(b.targetTime),e.releaseGap);if(d.selected){used.push(d.targetTime);live.push(d);}}while(live.length&&live[0].targetTime+live[0].window+.18<now)live.shift();peak=Math.max(peak,live.length);}
  assert.deepEqual(used,D.select(grid.times,e.playableEndTime,energy,e.releaseGap).map(d=>d.targetTime));assert.ok(peak<=5);assert.equal(grid.skippedExpired,0);
 }
});
test('BPM fallback retains its unchanged legal timing skeleton',()=>{
 const m={bpm:120,beatOffset:.1,songLength:40},e=E.detect(m),grid=T.createTiming(m),chosen=[];assert.equal(grid.source,'bpm-fallback');for(let t=0;t<40;t+=1/60)for(const b of grid.drain(t,e.playableEndTime,.36))if(D.decision(b.index,b.targetTime,e.playableEndTime,.5,e.releaseGap).selected)chosen.push(b);assert.ok(chosen.length>0);for(const b of chosen)assert.equal(b.targetTime,.6+b.index*.5);
});
