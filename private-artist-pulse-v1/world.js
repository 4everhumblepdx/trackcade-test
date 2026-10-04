/* Original procedural cartoon architecture and abstract graffiti. No image assets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArtistWorld=api;})(globalThis,function(){
 'use strict';
 const ink='#101922',bone='#fff1d6';
 function poly(c,p,fill,stroke=ink,width=5){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
 function line(c,p,color,width){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
 function glyph(c,x,y,scale,color,variant=0,vertical=false){
  c.save();c.translate(x,y);c.scale(scale,scale);if(vertical)c.rotate(-Math.PI/2);
  // Shared spray grammar, distinct placement/scale/material per world.
  const shapes=[[[0,28],[18,0],[41,30],[58,4],[72,30]],[[0,6],[32,0],[12,38],[48,28],[66,4]],[[0,28],[20,8],[18,34],[54,0],[68,24]]];const p=shapes[variant%3];
  line(c,p,ink,22);line(c,p,color,15);line(c,p,bone,2);line(c,[[8,39],[28,35],[60,39]],color,6);
  c.fillStyle=color;c.globalAlpha=.5;for(let i=0;i<8;i++){c.beginPath();c.arc((i*29)%83-5,(i*13)%49-5,1+i%3,0,Math.PI*2);c.fill();}
  c.globalAlpha=.75;line(c,[[20,34],[19,52]],color,4);line(c,[[54,34],[52,45]],color,3);c.restore();
 }
 function terrace(c,p,v,t,e,section){
  const shift=Math.sin(t*.15)*8;
  c.fillStyle=p.primary;c.globalAlpha=.13;c.beginPath();c.ellipse(300,460,250,130,0,0,7);c.fill();c.globalAlpha=1;
  for(let i=0;i<3;i++){let y=260+i*72,dx=(i%2?1:-1)*shift;poly(c,[[40+dx,y],[420+dx,y-32],[490+dx,y+5],[110+dx,y+45]],i%2?p.panel:p.secondary,ink,4);poly(c,[[110+dx,y+45],[490+dx,y+5],[468+dx,y+27],[104+dx,y+71]],p.panel);glyph(c,80+dx,y+4,.75,p.primary,i);}
  poly(c,[[-40,615+shift],[165,554+shift],[220,595+shift],[20,670+shift]],p.primary);poly(c,[[-40,642+shift],[20,670+shift],[220,595+shift],[215,674+shift],[18,745+shift],[-40,702+shift]],p.panel);glyph(c,-15,668+shift,2,p.secondary,section%3);
  poly(c,[[370,710-shift],[635,652-shift],[650,740-shift],[387,795-shift]],p.secondary);poly(c,[[387,795-shift],[650,740-shift],[640,810-shift],[370,850-shift]],p.panel);glyph(c,395,748-shift,1.5,p.primary,2);
  line(c,[[0,510],[120,488+e*8],[300,514],[480,490],[600,510]],p.secondary,12);line(c,[[0,503],[120,481+e*8],[300,507],[480,483],[600,503]],bone,2);
  const x=(t*20+section*110)%850-125;line(c,[[x,550],[x+90,534],[x+140,546]],p.primary,4);
 }
 function atrium(c,p,v,t,e,section){
  const opening=16+e*40+Math.sin(t*.18)*5;
  // Huge beveled arch and diagonal shutters frame an empty center.
  poly(c,[[-30,175],[160,205],[208,325],[172,740],[-25,810]],p.panel);
  poly(c,[[630,175],[440,205],[392,325],[428,740],[625,810]],p.panel);
  poly(c,[[160,205],[300,152],[440,205],[392,265],[300,226],[208,265]],p.secondary);
  line(c,[[162,204],[300,152],[440,204]],bone,4);
  for(let i=0;i<3;i++){
   const y=290+i*130,k=opening*(i%2?-.25:1);
   poly(c,[[-30,y],[142+k,y-36],[153-k,y+65],[-30,y+104]],i%2?p.secondary:p.primary);
   glyph(c,12,y+10,.95,p.panel,i+section);
   poly(c,[[630,y+5],[458-k,y-30],[447+k,y+70],[630,y+110]],i%2?p.primary:p.secondary);
   glyph(c,488,y+22,.95,p.panel,2-i);
  }
  poly(c,[[65,830],[240,735],[440,800],[320,932]],p.secondary);poly(c,[[65,830],[320,932],[320,955],[65,858]],p.panel);glyph(c,175,802,1.45,p.primary,section);
  line(c,[[240,735],[440,800]],bone,5);
 }
 function towers(c,p,v,t,e,section){
  const positions=[[-20,680,105,285],[455,670,135,355],[55,360,70,155],[467,355,67,140]];
  for(let i=0;i<positions.length;i++){
   const [x,y,w,h]=positions[i],lift=Math.sin(t*.20+i)*5+e*(i<2?12:5);
   poly(c,[[x,y-lift],[x+w,y-25-lift],[x+w-6,y-h-lift],[x+8,y-h+22-lift]],i%2?p.secondary:p.primary);
   poly(c,[[x+w,y-25-lift],[x+w+25,y-8-lift],[x+w+18,y-h+16-lift],[x+w-6,y-h-lift]],p.panel);
   poly(c,[[x+8,y-h+22-lift],[x+w-6,y-h-lift],[x+w+18,y-h+16-lift],[x+30,y-h+36-lift]],bone);
   glyph(c,x+24,y-55-lift,i<2?1.15:.55,p.panel,i,true);
   c.globalAlpha=.45+.30*e;line(c,[[x+15,y-h+47-lift],[x+w-14,y-h+30-lift]],p.secondary,6);c.globalAlpha=1;
  }
  for(let i=0;i<4;i++){const y=792+i*31;poly(c,[[60+i*15,y],[470-i*15,y-45],[505-i*15,y-15],[92+i*15,y+27]],i%2?p.panel:p.primary,ink,3);}
  glyph(c,210,807,1.25,p.secondary,section);
 }
 function accent(c,style,x,y,r,color){
  c.save();c.translate(x,y);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=4;
  if(style==='ribbon-terraces'){for(const sign of [-1,1])line(c,[[sign*(r+11),-12],[sign*(r+16),0],[sign*(r+11),12]],color,4);}
  else if(style==='hinge-atrium'){for(let i=0;i<3;i++){c.save();c.rotate(i*2*Math.PI/3);poly(c,[[r+12,-6],[r+23,0],[r+12,6]],color,null);c.restore();}}
  else{for(let i=0;i<4;i++){c.save();c.rotate(i*Math.PI/2);line(c,[[r+12,-5],[r+12,5]],color,4);c.restore();}}
  c.restore();
 }
 function draw(canvas,v,t=0,e=.5,section=0,targets=[],marks=[],transitionAge=Infinity){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=v.palette;c.clearRect(0,0,w,h);c.save();c.scale(w/600,h/900);
  const bg=c.createLinearGradient(0,0,0,900);bg.addColorStop(0,p.panel);bg.addColorStop(.6,p.bg);bg.addColorStop(1,ink);c.fillStyle=bg;c.fillRect(0,0,600,900);
  c.globalAlpha=.16;c.fillStyle=bone;c.beginPath();c.arc(300,80,230,0,Math.PI*2);c.fill();c.globalAlpha=1;
  if(v.style==='ribbon-terraces')terrace(c,p,v,t,e,section);else if(v.style==='hinge-atrium')atrium(c,p,v,t,e,section);else towers(c,p,v,t,e,section);
  if(transitionAge>=0&&transitionAge<2.5){c.globalAlpha=.35*(1-transitionAge/2.5);const phase=transitionAge/2.5;
   if(v.style==='ribbon-terraces'){const x=phase*880-160;line(c,[[x,548],[x+90,530],[x+150,544]],p.primary,14);}
   else if(v.style==='hinge-atrium'){poly(c,[[0,300],[130*(1-phase),270],[150*(1-phase),600],[0,640]],p.white,null);poly(c,[[600,300],[600-130*(1-phase),270],[600-150*(1-phase),600],[600,640]],p.white,null);}
   else{const y=825-phase*430;line(c,[[15,y],[135,y-30]],p.white,12);line(c,[[450,y-45],[590,y-75]],p.white,12);}c.globalAlpha=1;
  }
  // A translucent playfield keeps architecture behind readable targets.
  const veil=c.createRadialGradient(300,510,40,300,510,240);veil.addColorStop(0,p.bg+'b0');veil.addColorStop(1,p.bg+'00');c.fillStyle=veil;c.fillRect(130,280,340,480);c.restore();
  for(const a of targets)if(!a.hit&&!a.missed)accent(c,v.style,a.x,a.y,a.profile?.radius||32,p.secondary);
  for(const m of marks){let age=t-m.t;if(age<0||age>.45)continue;c.save();c.globalAlpha=(1-age/.45)*.65;c.translate(m.x,m.y);c.fillStyle=p.primary;
   if(v.style==='ribbon-terraces'){c.rotate(-.15);c.fillRect(-25-age*22,-5,50+age*44,10);}
   else if(v.style==='hinge-atrium')poly(c,[[-18,-10],[15,-16],[25,10],[-10,15]],p.secondary,ink,2);
   else for(let i=0;i<5;i++){c.beginPath();c.arc((i-2)*8,-12-age*60+(i%2)*8,3+i%2,0,7);c.fill();}c.restore();
  }
 }
 function attach(scene,v){
  let canvas=document.getElementById('artist-world');if(!canvas){canvas=document.createElement('canvas');canvas.id='artist-world';Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'0'});document.body.prepend(canvas);}scene.artistCanvas=canvas;scene.artistMarks=[];
 }
 function render(scene,v,t,e){const canvas=scene.artistCanvas;if(!canvas)return;const w=scene.scale.width,h=scene.scale.height;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}scene.artistEnergy=scene.artistEnergy*.93+e*.07;if(scene.lastArtistSection!==scene.sectionNumber){scene.lastArtistSection=scene.sectionNumber;scene.artistTransitionAt=t;}scene.artistMarks=scene.artistMarks.filter(m=>t-m.t<.45);draw(canvas,v,t,scene.artistEnergy,scene.sectionNumber,scene.targets,scene.artistMarks,t-scene.artistTransitionAt);}
 return {draw,attach,render,accent};
});
