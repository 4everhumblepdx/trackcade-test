#!/usr/bin/env python3
from pathlib import Path
import sys
src=Path(sys.argv[1]); out=Path(sys.argv[2])
s=src.read_text()
insert=r'''
function debugPhaseStability(envelope, segment) {
    const bpm=segment.bpm,start=segment.start,end=segment.end,interval=60/bpm;
    const layerSpecs=[
      {name:'amplitude',values:envelope.amplitudeValues,frameOffset:envelope.frameOffsetSeconds,baseWeight:1.1},
      {name:'low',values:envelope.lowPulseValues,frameOffset:envelope.hopSeconds/2,baseWeight:1.4},
      {name:'mid',values:envelope.midPulseValues,frameOffset:envelope.hopSeconds/2,baseWeight:.9},
      {name:'hybrid',values:envelope.values,frameOffset:envelope.frameOffsetSeconds,baseWeight:.35},
      {name:'transient',values:envelope.transientValues,frameOffset:envelope.frameOffsetSeconds,baseWeight:.25},
      {name:'high',values:envelope.highPulseValues,frameOffset:envelope.hopSeconds/2,baseWeight:.2},
    ];
    const evidence=layerSpecs.map(l=>({...l,correlationSupport:normalizedCorrelationSupport(l.values,envelope.hopSeconds,bpm),phase:phaseAtBpmValues(l.values,envelope.hopSeconds,l.frameOffset,bpm,start,end)}));
    const candidates=[];
    const add=(phase,source)=>{
      while(phase-interval>=start-.001)phase-=interval; while(phase<start-.001)phase+=interval;
      const ex=candidates.find(c=>{const d=Math.abs(c.phase-phase);return Math.min(d,Math.abs(interval-d))<=.006;});
      if(ex){if(!ex.sources.includes(source))ex.sources.push(source);return;} candidates.push({phase,sources:[source]});
    };
    add(segment.beatOffset,'selected'); for(const l of evidence)add(l.phase,l.name); add(segment.beatOffset+interval*.5,'plus-half');
    const scoreWindow=(candidate,ws,we)=>{
      let sum=0,wt=0; const layers={};
      for(const l of evidence){
        if(l.correlationSupport<.5)continue;
        const ew=l.baseWeight*l.correlationSupport*l.correlationSupport;
        const q=gridSupportForLayerAtOffset(l.values,envelope.hopSeconds,l.frameOffset,bpm,ws,we,candidate.phase);
        sum+=ew*q.score;wt+=ew;layers[l.name]=Number(q.score.toFixed(4));
      }
      return {score:Number((wt?sum/wt:0).toFixed(4)),layers};
    };
    const rows=[];
    for(const c of candidates){
      const windows=[]; const nwin=4; const span=(end-start)/nwin;
      for(let wi=0;wi<nwin;wi++){const ws=start+wi*span;const we=wi===nwin-1?end:start+(wi+1)*span;windows.push(scoreWindow(c,ws,we));}
      const vals=windows.map(x=>x.score),mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const variance=vals.reduce((a,b)=>a+(b-mean)*(b-mean),0)/vals.length;
      const layerStats={};
      for(const name of ['low','amplitude','mid','hybrid','transient','high']){
        const lv=windows.map(w=>w.layers[name]).filter(v=>v!==undefined);
        if(!lv.length)continue;const lm=lv.reduce((a,b)=>a+b,0)/lv.length;const vv=lv.reduce((a,b)=>a+(b-lm)*(b-lm),0)/lv.length;
        layerStats[name]={mean:Number(lm.toFixed(4)),std:Number(Math.sqrt(vv).toFixed(4)),min:Number(Math.min(...lv).toFixed(4)),max:Number(Math.max(...lv).toFixed(4))};
      }
      rows.push({phase:Number(c.phase.toFixed(6)),phaseFraction:Number((((c.phase-start)%interval+interval)%interval/interval).toFixed(6)),sources:c.sources,windowMean:Number(mean.toFixed(4)),windowStd:Number(Math.sqrt(variance).toFixed(4)),windowMin:Number(Math.min(...vals).toFixed(4)),windowMax:Number(Math.max(...vals).toFixed(4)),windows,layerStats});
    }
    return {bpm:Number(bpm.toFixed(3)),start,end,currentBeatOffset:segment.beatOffset,candidates:rows};
}
'''
marker="const fs = require('fs');"
assert marker in s
s=s.replace(marker,insert+'\n'+marker,1)
old="    const result = analyzeDecodedTrackAudio({ decoded: { channelData, sampleRate }, mimeType: 'audio/raw', filename, sourceFingerprint, decoderContract });\n    const text = JSON.stringify(result, null, 2);"
new="    const result = analyzeDecodedTrackAudio({ decoded: { channelData, sampleRate }, mimeType: 'audio/raw', filename, sourceFingerprint, decoderContract });\n    if (process.env.TRACKCADE_PHASE_STABILITY === '1') { const e=onsetEnvelope(channelData,sampleRate); result.phaseStabilityDebug=result.tempoMap.map(segment=>debugPhaseStability(e,segment)); }\n    const text = JSON.stringify(result, null, 2);"
assert old in s
s=s.replace(old,new,1)
out.write_text(s)
