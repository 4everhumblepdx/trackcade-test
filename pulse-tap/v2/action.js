/* Objective evidence ranks immutable legal beats; no semantic command mapping. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./choice.js'):root.PulseChoice);if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseAction=api;})(globalThis,function(Choice){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n));
 const nearest=(rows,t)=>rows.reduce((best,row)=>!best||Math.abs(row.time-t)<Math.abs(best.time-t)?row:best,null);
 function validate(e,times,duration){
  if(!e||e.schema!=='pulse-tap-frozen-action-evidence-v22'||e.duration!==duration||!Array.isArray(e.beatTimes)||e.beatTimes.length!==times.length||!times.every((t,i)=>t===e.beatTimes[i]&&e.beatEvidence[i]?.time===t))throw Error('Frozen action evidence does not match this timing grid.');
  for(const key of ['beatEvidence','onsets','landmarks','boundaries']){
   if(!Array.isArray(e[key])||e[key].some(r=>!Number.isFinite(r.time)||r.time<0||r.time>duration))throw Error('Invalid frozen evidence timestamps.');
  }
  for(const key of ['beatEvidence','onsets'])if(e[key].some(r=>!Number.isFinite(r.strength)||!Number.isFinite(r.confidence)||r.strength<0||r.strength>1||r.confidence<0||r.confidence>1))throw Error('Invalid frozen attack evidence.');
  if(e.landmarks.some(r=>!Number.isFinite(r.intensity)||r.intensity<0||r.intensity>1)||!Array.isArray(e.lowDemandWindows)||e.lowDemandWindows.some(r=>!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>duration))throw Error('Invalid frozen structural evidence.');
  if(e.vocalEvidence!==null)throw Error('This frozen evidence adapter has no vocal-specific detector.');
  return e;
 }
 function salience(index,t,track,e,energyAt){
  const beat=e?.beatEvidence[index]||null;
  const onset=nearest(e?.onsets||[],t),landmark=nearest(e?.landmarks||[],t);
  const boundary=nearest(e?.boundaries||(track.events||[]).filter(x=>x.kind==='section').map(x=>({time:x.t})),t);
  const dt=index>0?t-(e?.beatTimes[index-1]??t-.4):.4;
  const proximity=(row,span)=>row?clamp(1-Math.abs(row.time-t)/span):0;
  const energy=energyAt(t),before=energyAt(Math.max(0,t-1.5)),after=energyAt(t+1.5);
  const energyDelta=energy-before,contrast=Math.abs(after-before);
  const lowDemand=(e?.lowDemandWindows||[]).some(r=>t>=r.start&&t<r.end);
  const components={beatAttack:.30*clamp(beat?.strength||0)*clamp(beat?.confidence||0),onset:.30*clamp(onset?.strength||0)*clamp(onset?.confidence||0)*proximity(onset,Math.min(.18,dt*.45)),landmark:.15*clamp(landmark?.intensity||0)*proximity(landmark,Math.max(.4,dt*2)),energy:.08*clamp(energy),energyRise:.06*clamp(Math.max(0,energyDelta)),contrast:.06*clamp(contrast),sectionBoundary:.05*proximity(boundary,Math.max(.4,dt*2)),lowDemand:lowDemand?-.20:0};
  return {total:clamp(Object.values(components).reduce((a,b)=>a+b,0)),components,energy,energyDelta,contrast,lowDemand,nearestLandmark:landmark?{...landmark,distance:Math.abs(t-landmark.time)}:null,nearestOnset:onset?{...onset,distance:Math.abs(t-onset.time)}:null,sectionBoundary:boundary?{...boundary,distance:Math.abs(t-boundary.time)}:null,beatAttack:beat,vocalEvidence:null};
 }
 function plan(times,duration,track,e,D,energyAt,releaseGap){
  const rows=times.map((t,i)=>({...D.decision(i,t,duration,energyAt(t),releaseGap),musicalImpactTime:t,presentationStartTime:t-D.profile(t,duration,energyAt(t)).lead,presentationLead:D.profile(t,duration,energyAt(t)).lead,actionSalience:salience(i,t,track,e,energyAt),playableEnd:duration,releaseGap,selectionReason:'not selected',skippedReason:'difficulty quota'}));
  Choice.annotate(rows);
  // Each quota is local to four source beats, split at stage boundaries.
  // Dynamic programming carries only the trailing burst length across windows.
  // It prevents greedy choices from forcing an unreadable later burst; it never
  // moves actions between local windows or globally sorts musical evidence.
  let states=new Map([[0,{value:0,path:[]}]]),start=0;
  while(start<rows.length){
   let end=start+1;while(end<rows.length&&Math.floor(end/4)===Math.floor(start/4)&&rows[end].name===rows[start].name)end++;
   const group=rows.slice(start,end),original=group.filter(r=>r.selected),protectedStage=['opening','landing'].includes(group[0].name);
   const eligible=group.filter(r=>r.originalBeatIndex>=4&&r.targetTime+r.window<=duration&&r.targetTime<=duration-releaseGap);
   const low=group.every(r=>r.actionSalience.lowDemand);
   const quota=protectedStage?original.length:Math.min(original.length,low?2:original.length);
   for(const r of group){r.actionQuota=quota;r.localWindow={startIndex:start,endIndex:end-1};}
   const options=[];
   if(protectedStage)options.push(original);
   else for(let mask=0;mask<(1<<eligible.length);mask++){const subset=eligible.filter((_,j)=>mask&(1<<j));if(subset.length===quota)options.push(subset);}
   const nextStates=new Map();
   for(const [tail,state] of states)for(const subset of options){
    let run=tail,valid=true;
    for(const r of group){run=subset.includes(r)?run+1:0;if(run>(r.maxBurstLength??5))valid=false;}
    if(!valid)continue;
    const value=state.value+subset.reduce((v,r)=>v+r.localActionPreference-.000001*Math.min(...original.map(o=>Math.abs(o.originalBeatIndex-r.originalBeatIndex)),4),0);
    if(!nextStates.has(run)||value>nextStates.get(run).value+1e-12)nextStates.set(run,{value,path:[...state.path,{group,subset,original,protectedStage,low}]});
   }
   if(!nextStates.size)throw Error('No readable selection can satisfy local quota at '+start+' '+group[0].name);
   states=nextStates;start=end;
  }
  const best=[...states.values()].reduce((a,b)=>b.value>a.value+1e-12?b:a);
  for(const {group,subset,original,protectedStage,low} of best.path)for(const r of group){
   r.selected=subset.includes(r);
   r.selectionReason=r.selected?(protectedStage?'rhythmic continuity':original.includes(r)?'both':'local musical preference'):'not selected';
   r.skippedReason=r.selected?null:r.originalBeatIndex<4?'beginner safety':r.targetTime+r.window>duration||r.targetTime>duration-releaseGap?'ending safety':protectedStage?'preserved tutorial/landing pattern':low?'low-demand quota':'local salience / continuity quota';
  }
  const corrected=Choice.improve(rows);
  Choice.annotateSelection(rows);
  for(const r of rows)r.continuityReplacement=corrected.find(c=>c.skippedIndex===r.originalBeatIndex)||null;
  return rows;
 }
 return {validate,salience,plan};
});
