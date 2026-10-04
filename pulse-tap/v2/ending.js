/* Presentation/playability boundary from frozen objective evidence; no music timestamps change. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseEnding=api;})(globalThis,function(){
  'use strict';
  const median=values=>{const v=values.slice().sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
  function beatTimes(track){return [...new Set((Array.isArray(track.events)?track.events:[]).filter(e=>e&&e.kind==='beat'&&Number.isFinite(e.t)&&e.t>=0).map(e=>e.t))].sort((a,b)=>a-b);}
  function detect(track,actualDuration){
    const rawDuration=Number.isFinite(actualDuration)&&actualDuration>0?actualDuration:Number(track.songLength)>0?Number(track.songLength):Infinity;
    const beats=beatTimes(track),interval=median(beats.slice(1).map((t,i)=>t-beats[i]))||60/Math.max(40,Math.min(240,Number(track.bpm)||120));
    const releaseGap=Math.max(1.25,Math.min(2.5,interval*4));
    const fallback=reason=>({rawDuration,playableEndTime:rawDuration,releaseGap,source:'duration-fallback',reason,evidence:null});
    const times=track.generation?.energySampleTimes,energy=track.energyCurve;
    if(!Number.isFinite(rawDuration)||!Array.isArray(times)||!Array.isArray(energy)||times.length!==energy.length||times.length<8||beats.length<2)return fallback('missing-frozen-terminal-evidence');
    if(!times.every((t,i)=>Number.isFinite(t)&&t>=0&&t<=rawDuration&&(!i||t>times[i-1]))||!energy.every(e=>Number.isFinite(e)&&e>=0&&e<=1))return fallback('invalid-frozen-energy-evidence');
    const step=median(times.slice(1).map((t,i)=>t-times[i]));
    if(rawDuration-times[times.length-1]>step*1.5)return fallback('energy-does-not-cover-terminal-tail');
    const ranked=energy.slice().sort((a,b)=>a-b),activeLevel=ranked[Math.floor((ranked.length-1)*.9)];
    if(activeLevel<.3)return fallback('insufficient-active-to-quiet-contrast');
    const threshold=Math.min(.10,activeLevel*.15);
    let first=energy.length;while(first>0&&energy[first-1]<=threshold)first--;
    if(first===energy.length)return fallback('no-terminal-low-energy-suffix');
    const start=times[first],count=energy.length-first,span=times[times.length-1]-start;
    if(count<4||span<Math.max(2.5,step*2)||start<rawDuration*.85)return fallback('terminal-collapse-not-sufficiently-sustained');
    const preceding=energy.filter((_e,i)=>times[i]>=start-8&&times[i]<start);
    if(preceding.filter(e=>e>=threshold*3).length<2)return fallback('terminal-collapse-lacks-local-contrast');
    if(beats[beats.length-1]<times[times.length-1]-step||!beats.some(t=>t<start-releaseGap))return fallback('beat-grid-does-not-support-terminal-boundary');
    return {rawDuration,playableEndTime:start,releaseGap,source:'frozen-energy-terminal-suffix',reason:'sustained-terminal-collapse',evidence:{firstLowSampleIndex:first,firstLowSampleTime:start,lowSampleCount:count,observedLowSpan:span,lastSampleTime:times[times.length-1],threshold,activeLevel,precedingContrastingSamples:preceding.filter(e=>e>=threshold*3).length,medianEnergyInterval:step,medianBeatInterval:interval,policy:'terminal suffix only; >=4 samples; >=max(2.5s,2 sample intervals); final 15%; complete tail coverage; local contrast'}};
  }
  const canPlay=(t,end)=>Number.isFinite(t)&&t>=0&&t<end;
  const targetFits=(t,window,ending)=>Number.isFinite(t)&&t>=0&&t+window<=ending.playableEndTime&&t<=ending.playableEndTime-ending.releaseGap;
  return {detect,beatTimes,canPlay,targetFits};
});
