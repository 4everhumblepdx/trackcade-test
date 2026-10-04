/* Inspect interchangeable on-grid choices without labels or source inference. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseChoice=api;})(globalThis,function(){
 'use strict';
 const protectedStage=r=>['opening','landing'].includes(r.name);
 const legal=r=>r.originalBeatIndex>=4&&r.targetTime+r.window<=r.playableEnd&&r.targetTime<=r.playableEnd-r.releaseGap;
 function annotate(rows){
  for(const r of rows){
   const i=r.originalBeatIndex,near=rows.slice(Math.max(0,i-2),i+3).filter(x=>x.name===r.name),others=near.filter(x=>x!==r),s=r.actionSalience;
   const rank=1+near.filter(x=>x.actionSalience.total>s.total+1e-12||(Math.abs(x.actionSalience.total-s.total)<=1e-12&&x.originalBeatIndex<i)).length;
   const mean=others.length?others.reduce((v,x)=>v+x.actionSalience.total,0)/others.length:s.total;
   const advantage=key=>s.components[key]-Math.max(0,...others.map(x=>x.actionSalience.components[key]));
   r.localPreference={absolute:s.total,previousSalience:rows[i-1]?.actionSalience.total??null,nextSalience:rows[i+1]?.actionSalience.total??null,previousDifference:rows[i-1]?s.total-rows[i-1].actionSalience.total:null,nextDifference:rows[i+1]?s.total-rows[i+1].actionSalience.total:null,rank,neighborhoodSize:near.length,localPeak:others.every(x=>s.total>=x.actionSalience.total),meanAdvantage:s.total-mean,beatAttackAdvantage:advantage('beatAttack'),onsetAdvantage:advantage('onset'),landmarkAdvantage:advantage('landmark'),energyRiseAdvantage:advantage('energyRise'),contrastAdvantage:advantage('contrast')};
   r.localActionPreference=s.total+.15*(s.total-mean)+.02*(near.length-rank)/Math.max(1,near.length-1);
  }
  return rows;
 }
 function safeSelection(rows,indices){
  let last=null,run=0;
  for(const i of [...indices].sort((a,b)=>a-b)){
   const r=rows[i];if(!legal(r))return false;
   if(last!==null&&r.targetTime-rows[last].targetTime<.18)return false;
   run=i===last+1?run+1:1;if(run>(r.maxBurstLength??5))return false;last=i;
  }
  return true;
 }
 function replacements(rows,r,indices){
  if(!r.selected||protectedStage(r))return [];
  return rows.slice(Math.max(0,r.originalBeatIndex-2),r.originalBeatIndex+3).filter(b=>!indices.has(b.originalBeatIndex)&&legal(b)&&b.name===r.name&&Math.floor(b.originalBeatIndex/4)===Math.floor(r.originalBeatIndex/4)&&!protectedStage(b)).filter(b=>{
   const swapped=new Set(indices);swapped.delete(r.originalBeatIndex);swapped.add(b.originalBeatIndex);return safeSelection(rows,swapped);
  });
 }
 function inversions(rows,threshold=.025){
  const indices=new Set(rows.filter(r=>r.selected).map(r=>r.originalBeatIndex)),selected=rows.filter(r=>r.selected&&!protectedStage(r));
  const records=[];
  for(const r of selected){const best=replacements(rows,r,indices).sort((a,b)=>b.actionSalience.total-a.actionSalience.total||a.originalBeatIndex-b.originalBeatIndex)[0];
   if(best&&best.actionSalience.total-r.actionSalience.total>=threshold)records.push({selectedIndex:r.originalBeatIndex,selectedTime:r.targetTime,skippedIndex:best.originalBeatIndex,skippedTime:best.targetTime,selectedSalience:r.actionSalience.total,skippedSalience:best.actionSalience.total,loss:best.actionSalience.total-r.actionSalience.total,selectedReason:r.selectionReason,stage:r.name});
  }
  return {threshold,eligibleSelected:selected.length,count:records.length,rate:selected.length?records.length/selected.length:0,meanSalienceLoss:records.length?records.reduce((s,r)=>s+r.loss,0)/records.length:0,records};
 }
 function improve(rows,threshold=.025){
  // Each correction strictly raises total absolute salience while preserving the
  // local quota and bounded burst constraints, so this finite search terminates.
  const corrections=[];
  for(;;){const candidates=inversions(rows,threshold).records.sort((a,b)=>b.loss-a.loss||a.selectedIndex-b.selectedIndex);if(!candidates.length)break;
   const c=candidates[0];rows[c.selectedIndex].selected=false;rows[c.selectedIndex].selectionReason='not selected';rows[c.selectedIndex].skippedReason='stronger interchangeable local candidate';rows[c.skippedIndex].selected=true;rows[c.skippedIndex].selectionReason='local musical preference';rows[c.skippedIndex].skippedReason=null;corrections.push(c);
  }
  return corrections;
 }
 function annotateSelection(rows){
  const indices=new Set(rows.filter(r=>r.selected).map(r=>r.originalBeatIndex)),inv=inversions(rows),byIndex=new Map(inv.records.map(r=>[r.selectedIndex,r]));
  let previous=null,run=[];const finish=()=>{for(let i=0;i<run.length;i++){run[i].runPosition=i+1;run[i].consecutiveRunLength=run.length;}run=[];};
  for(const r of rows.filter(r=>r.selected)){
   if(previous===null||r.originalBeatIndex!==previous+1)finish();run.push(r);previous=r.originalBeatIndex;
   const strongest=replacements(rows,r,indices).sort((a,b)=>b.actionSalience.total-a.actionSalience.total||a.originalBeatIndex-b.originalBeatIndex)[0];
   r.strongestNearbySkipped=strongest?{index:strongest.originalBeatIndex,time:strongest.targetTime,salience:strongest.actionSalience.total}:null;
   r.differenceVsStrongestSkipped=strongest?r.actionSalience.total-strongest.actionSalience.total:null;r.localChoiceInversion=byIndex.get(r.originalBeatIndex)||null;
  }finish();return rows;
 }
 return {annotate,annotateSelection,inversions,improve,safeSelection,replacements};
});
