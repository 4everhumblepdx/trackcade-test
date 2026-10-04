/* Exact authored beat timestamps; presentation lead never changes a musical time. */
(function(root, factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.PulseTiming=api;
})(typeof globalThis!=='undefined'?globalThis:this, function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function createTiming(track){
    const authored=(Array.isArray(track.events)?track.events:[])
      .filter(e=>e && e.kind==='beat' && typeof e.t==='number' && Number.isFinite(e.t) && e.t>=0)
      .map(e=>e.t).sort((a,b)=>a-b);
    // Duplicate authored entries at the same instant represent one tap opportunity.
    const times=authored.filter((t,i)=>i===0 || t!==authored[i-1]);
    const explicit=authored.length>=2;
    const beat=60/clamp(Number(track.bpm)||120,40,240);
    const start=Math.max(Number(track.beatOffset)||0,0.6); // unchanged legacy grid start
    let nextIndex=0,skippedExpired=0;
    function timeAt(i){return i<0?null:explicit?(times[i]??null):start+i*beat;}
    function intervalAt(i){
      if(!explicit)return beat;
      if(times.length===1)return 0;
      const j=clamp(i,0,times.length-1);
      return j+1<times.length?times[j+1]-times[j]:times[j]-times[j-1];
    }
    function indexAt(t){
      if(!explicit)return t<start?-1:Math.floor((t-start)/beat);
      let lo=0,hi=times.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(times[mid]<=t)lo=mid+1;else hi=mid;}
      return lo-1;
    }
    const leadAt=i=>clamp(intervalAt(i)*0.82,0.08,0.62);
    return {
      source:explicit?'explicit-beat-grid':'bpm-fallback',times:explicit?times.slice():null,
      timeAt,intervalAt,indexAt,leadAt,
      get nextIndex(){return nextIndex;},get skippedExpired(){return skippedExpired;},
      drain(t,duration=Infinity,hitWindow=0.30,presentationLead=null){
        const due=[];
        for(;;){
          const targetTime=timeAt(nextIndex);
          if(targetTime===null || targetTime>duration)break;
          const spawnAhead=presentationLead?clamp(presentationLead(nextIndex,targetTime),.08,.9):leadAt(nextIndex);
          if(targetTime-spawnAhead>t)break;
          const index=nextIndex++; // consume exactly once, even after a delayed frame
          if(t>targetTime+hitWindow){skippedExpired++;continue;}
          due.push({index,targetTime,spawnAhead});
        }
        return due;
      }
    };
  }
  function energyAt(track,t,duration){
    const curve=Array.isArray(track.energyCurve)&&track.energyCurve.length?track.energyCurve:[0.55];
    const sampleTimes=track.generation?.energySampleTimes;
    let index;
    if(Array.isArray(sampleTimes)&&sampleTimes.length===curve.length){
      index=0;while(index+1<sampleTimes.length && sampleTimes[index+1]<=t)index++;
    }else index=clamp(Math.floor(t/Math.max(duration||1,1)*curve.length),0,curve.length-1);
    const value=Number(curve[index]);return Number.isFinite(value)?clamp(value,0,1):0.5;
  }
  function sectionAt(events,t){
    let current=null;for(const e of events){if(e.t>t)break;if(e.kind==='section')current=e;}return current;
  }
  return {createTiming,energyAt,sectionAt};
});
