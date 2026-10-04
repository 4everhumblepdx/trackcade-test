/* Artist-authored direction only. No inference from genre, audio or semantics. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseVisual=api;})(globalThis,function(){
 'use strict';
 const defaults={bg:'#050714',panel:'#11162f',primary:'#19e3ff',secondary:'#ff2fb0',gold:'#ffd147',danger:'#ff4d6d',white:'#ffffff',muted:'#a7b0d8'};
 const legacy={bg:'skyTop',panel:'roadAlt',primary:'primary',secondary:'secondary',gold:'collectible',danger:'hazard'};
 function resolve(track){
  const authored=track.pulseVisual||{},palette={...defaults};
  for(const key of Object.keys(defaults)){
   const color=authored.palette?.[key]??track.palette?.[legacy[key]]??defaults[key];
   if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Invalid artist palette color: '+key);palette[key]=color;
  }
  const number=(key,fallback,min,max)=>{const value=authored[key]??fallback;if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid visual setting: '+key);return value;};
  return {schema:'pulse-tap-artist-visual-config-v1',palette,themeDirection:typeof authored.themeDirection==='string'?authored.themeDirection:'',assets:{cover:authored.assets?.cover??track.coverUrl??'',logo:authored.assets?.logo??track.logoUrl??''},backgroundIntensityScale:number('backgroundIntensityScale',1,0,2),pulseIntensityScale:number('pulseIntensityScale',1,0,2),artistDirectionOnly:true,renderedTreatments:{background:'grid',target:'circle',impact:'ring-close',ambient:'beat-pulse',sectionTransition:'alternate-grid'},futureTreatments:authored.treatments||null,architectureStatus:'partial: palette and restrained intensity are configurable; art and alternate treatments need later renderer work'};
 }
 return {resolve,defaults};
});
