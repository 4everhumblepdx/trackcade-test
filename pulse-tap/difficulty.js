/* Gameplay selection only: source timestamps remain legal, immutable music positions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseDifficulty=api;})(globalThis,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const stages=[
    {name:'opening',end:.12,window:.36,radius:44,travel:86,spread:.45,lead:.82},
    {name:'early',end:.30,window:.34,radius:42,travel:122,spread:.60,lead:.75},
    {name:'developing',end:.55,window:.30,radius:38,travel:165,spread:.74,lead:.65},
    {name:'hard',end:.80,window:.27,radius:34,travel:210,spread:.82,lead:.60},
    {name:'finale',end:1,window:.24,radius:30,travel:245,spread:.90,lead:.55}
  ];
  function profile(t,duration,energy=.5){
    const progress=clamp(t/Math.max(duration,1),0,1);
    const stage=stages.find(s=>progress<s.end)||stages[stages.length-1];
    return {...stage,progress,energy:clamp(energy,0,1),hitRadius:stage.radius+10};
  }
  function pattern(p,index){
    const variant=Math.floor(index/16)%3,hot=p.energy>=.65,cool=p.energy<.25;
    if(p.name==='opening')return [0,4,8,12];
    if(p.name==='early')return variant===1&&!cool?[0,4,8,10,12,14]:[0,4,8,12];
    if(p.name==='developing')return hot&&variant===2?[0,2,4,6,7,8,10,12,14]:[0,2,4,6,8,10,12,14];
    if(p.name==='hard')return cool?[0,2,4,6,8,10,12,14]:variant===0?[0,2,3,4,6,8,10,11,12,14]:[0,2,4,6,7,8,10,12,14,15];
    if(cool)return [0,1,2,4,6,8,9,10,12,14];
    return variant===1?[0,1,2,3,6,7,8,10,11,12,14]:[0,1,2,4,5,6,8,9,10,12,13,14];
  }
  function decision(index,t,duration,energy){
    const p=profile(t,duration,energy),beats=pattern(p,index);
    return {...p,selected:index>=4&&beats.includes(index%16),density:beats.length/16,originalBeatIndex:index,targetTime:t};
  }
  function select(times,duration,energyAt){
    return times.map((t,i)=>decision(i,t,duration,energyAt(t))).filter(d=>d.selected);
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
  function summary(times,duration,energyAt){
    const targets=select(times,duration,energyAt);
    return {sourceBeats:times.length,selectedTargets:targets.length,stages:stages.map(s=>{
      const chosen=targets.filter(d=>d.name===s.name),intervals=chosen.slice(1).map((d,i)=>d.targetTime-chosen[i].targetTime);
      const sourceCount=times.filter(t=>profile(t,duration).name===s.name).length;
      return {stage:s.name,sourceBeats:sourceCount,targets:chosen.length,density:chosen.length/sourceCount,averageInterval:intervals.length?intervals.reduce((a,b)=>a+b,0)/intervals.length:null,minimumInterval:intervals.length?Math.min(...intervals):null,hitWindow:s.window,radius:s.radius,hitRadius:s.radius+10,maxTravel:s.travel};
    }),hitWindowRange:[.24,.36]};
  }
  return {stages,profile,decision,select,position,field,summary};
});
