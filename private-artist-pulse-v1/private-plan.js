/* Reuse v2.3 selector; one universal handoff recovery pulse prevents infeasible
 * cross-stage quotas on new grids. No timestamp movement or song-specific rule. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../pulse-tap/action.js'):root.PulseAction);if(typeof module==='object'&&module.exports)module.exports=api;else root.PrivatePulsePlan=api;})(globalThis,function(A){
 function plan(times,duration,track,e,D,energyAt,releaseGap){
  const adapter={...D,decision(index,t,...args){const row=D.decision(index,t,...args),previous=index>0?D.profile(times[index-1],duration,energyAt(times[index-1])):null;if(previous&&previous.name!==row.name){row.selected=false;row.handoffRecovery=true;}return row;}};
  return A.plan(times,duration,track,e,adapter,energyAt,releaseGap);
 }
 return {plan};
});
