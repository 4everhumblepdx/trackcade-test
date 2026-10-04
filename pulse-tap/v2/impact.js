(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseImpact=api;})(globalThis,function(){
 'use strict';
 function visual(audioTime,impactTime,lead){
  const phase=Math.max(0,Math.min(1,(impactTime-audioTime)/lead));
  return {ringScale:(1+.75*phase)/1.75,coreAlpha:.12+.70*(1-phase),dotAlpha:.15+.85*(1-phase),atImpact:audioTime>=impactTime};
 }
 function judge(audioTime,impactTime,window){
  const delta=audioTime-impactTime,error=Math.abs(delta),ratio=error/window;
  if(ratio>1)return {delta,label:'EARLY / LATE',timingScore:0};
  const label=ratio<=.30?'PERFECT':ratio<=.65?'GREAT':'GOOD';
  const base=label==='PERFECT'?120:label==='GREAT'?80:45;
  const start=label==='PERFECT'?0:label==='GREAT'?.30:.65,end=label==='PERFECT'?.30:label==='GREAT'?.65:1;
  // A small attainable center tolerance avoids requiring literal zero error.
  // Source impact remains the center; normal hit windows are unchanged.
  const maximumTolerance=Math.min(.005,window*.10);
  const timingScore=label==='PERFECT'?120-25*Math.max(0,error-maximumTolerance)/(window*.30-maximumTolerance):base-15*(ratio-start)/(end-start);
  return {delta,label,timingScore,maximumTolerance,maximumTimingReward:error<=maximumTolerance};
 }
 return {visual,judge};
});
