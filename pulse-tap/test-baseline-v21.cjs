/* Gameplay selection only: source timestamps remain legal, immutable music positions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseDifficulty=api;})(globalThis,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const stages=[
    {name:'opening',start:0,end:.12,window:.36,radius:44,travel:86,spread:.45,lead:.82},
    {name:'build',start:.12,end:.32,window:.34,radius:42,travel:110,spread:.60,lead:.75,to:{window:.32,radius:40,travel:145,lead:.70}},
    {name:'developing',start:.32,end:.50,window:.31,radius:38,travel:160,spread:.74,lead:.65,to:{window:.29,radius:36,travel:190,lead:.62}},
    {name:'mid-hard-push',start:.50,end:.63,window:.27,radius:34,travel:210,spread:.82,lead:.60},
    {name:'relief',start:.63,end:.72,window:.30,radius:38,travel:170,spread:.74,lead:.66},
    {name:'final-build',start:.72,end:.82,window:.28,radius:35,travel:205,spread:.84,lead:.60,to:{window:.25,radius:31,travel:240,lead:.56}},
    {name:'final-climax',start:.82,end:.94,window:.23,radius:29,travel:250,spread:.90,lead:.54},
    {name:'landing',start:.94,end:1,window:.34,radius:42,travel:110,spread:.55,lead:.78}
  ];
  function profile(t,duration,energy=.5){
    const progress=clamp(t/Math.max(duration,1),0,1);
    const stage=stages.find(s=>progress<s.end)||stages[stages.length-1];
    const phase=clamp((progress-stage.start)/(stage.end-stage.start),0,1);
    const p={...stage,progress,phase,energy:clamp(energy,0,1)};
    for(const [key,value] of Object.entries(stage.to||{}))p[key]=stage[key]+(value-stage[key])*phase;
    p.hitRadius=p.radius+10;return p;
  }
  function pattern(p,index){
    const variant=Math.floor(index/16)%3,hot=p.energy>=.65,cool=p.energy<.25;
    if(p.name==='opening'||p.name==='landing')return [0,4,8,12];
    if(p.name==='build')return p.phase>.5&&variant!==0?[0,4,6,8,12,14]:[0,4,8,12];
    if(p.name==='developing')return hot&&variant===2?[0,2,4,6,7,8,10,12,14]:[0,2,4,6,8,10,12,14];
    if(p.name==='mid-hard-push'){
      const base=variant===1?[0,2,3,4,6,8,9,10,12,14]:[0,1,2,4,6,7,8,10,12,14];
      return hot?[...base,13]:base;
    }
    if(p.name==='relief')return cool?[0,2,4,8,10,12,14]:[0,2,4,6,8,10,12,14];
    if(p.name==='final-build')return p.phase>.5?[0,1,2,4,5,6,8,9,10,12,13,14]:[0,1,2,4,6,7,8,10,11,12,14];
    // Final maximum: bounded five-beat bursts with a gap at every block boundary.
    return hot&&variant===1?[0,1,2,3,5,6,7,8,9,11,12,13,14]:[0,1,2,3,4,6,7,8,9,11,12,13,14];
  }
  function decision(index,t,duration,energy,releaseGap=1.25){
    const p=profile(t,duration,energy),beats=pattern(p,index);
    return {...p,selected:index>=4&&t+p.window<=duration&&t<=duration-releaseGap&&beats.includes(index%16),density:beats.length/16,originalBeatIndex:index,targetTime:t};
  }
  function select(times,duration,energyAt,releaseGap=1.25){
    return times.map((t,i)=>decision(i,t,duration,energyAt(t),releaseGap)).filter(d=>d.selected);
  }
  function field(w,h,insets={}){
    const left=Math.max(60,(insets.left||0)+54),right=Math.max(left,w-Math.max(60,(insets.right||0)+54));
    const top=Math.max(225,(insets.top||0)+210),bottom=Math.max(top,h-Math.max(130,(insets.bottom||0)+112));
    return {left,right,top,bottom};
  }
  function position(serial,p,w,h,previous=null,insets={}){
    const f=field(w,h,insets),cx=(f.left+f.right)/2,cy=(f.top+f.bottom)/2;
    // Fixed bounded routes; no RNG, handedness assumptions, or opposite-screen jumps.
    const angle=serial*2.399963229728653;
    let x=cx+Math.sin(angle)*(f.right-f.left)*p.spread*.5;
    let y=cy+Math.cos(angle*.7)*(f.bottom-f.top)*p.spread*.38;
    if(previous){
      const limit=p.targetTime-previous.targetTime<.4?Math.min(110,p.travel):p.travel;
      const dx=x-previous.x,dy=y-previous.y,d=Math.hypot(dx,dy);
      if(d>limit){x=previous.x+dx/d*limit;y=previous.y+dy/d*limit;}
    }
    return {x:clamp(x,f.left,f.right),y:clamp(y,f.top,f.bottom)};
  }
  function summary(times,duration,energyAt,releaseGap=1.25){
    const targets=select(times,duration,energyAt,releaseGap);
    return {sourceBeats:times.length,playableEndTime:duration,selectedTargets:targets.length,finalTarget:targets.at(-1)?.targetTime??null,releaseGap:targets.length?duration-targets.at(-1).targetTime:null,stages:stages.map(s=>{
      const chosen=targets.filter(d=>d.name===s.name),intervals=chosen.slice(1).map((d,i)=>d.targetTime-chosen[i].targetTime);
      const sourceCount=times.filter(t=>t<duration&&profile(t,duration).name===s.name).length;
      const range=key=>[Math.min(s[key],s.to?.[key]??s[key]),Math.max(s[key],s.to?.[key]??s[key])];
      return {stage:s.name,progress:[s.start,s.end],sourceBeats:sourceCount,targets:chosen.length,density:sourceCount?chosen.length/sourceCount:0,targetsPerSecond:chosen.length/((s.end-s.start)*duration),averageInterval:intervals.length?intervals.reduce((a,b)=>a+b,0)/intervals.length:null,minimumInterval:intervals.length?Math.min(...intervals):null,hitWindowRange:range('window'),radiusRange:range('radius'),travelRange:range('travel'),basePerfectPoints:chosen.length*120};
    }),hitWindowRange:[.23,.36]};
  }
  return {stages,profile,decision,select,position,field,summary};
});
