/* Solarpunk parking lot: car models. Classic script, needs global THREE (r128).
   window.SolarpunkCars = { KINDS, RETRO_KINDS, PALETTE, build(kind, {style:"concept"|"retro", color, envMap}) => THREE.Group }
   style "retro" = the hand-built cars ported from 3-night-garage.html (copied, not rewritten). */
(function(){
function cvs(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); return c; }
function std(c,o){ return new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.5, metalness:0}, o||{})); }
const M = {
  chrome:std(0xe8eef6,{metalness:1,roughness:.1}), rubber:std(0x121317,{roughness:.9}), trim:std(0x17191f,{roughness:.55}),
  tan:std(0xc9a676,{roughness:.72}), grille:std(0x07080b,{roughness:.7}),
  steel:std(0xb4bdc9,{metalness:.85,roughness:.28}), white:std(0xe6e9e4,{metalness:.15,roughness:.3}), gray:std(0x4d5259,{roughness:.6}),
  vinyl:std(0x2a1119,{roughness:.85}),
  seam:std(0x040509,{roughness:.8}), gold:std(0xe0b85c,{metalness:.9,roughness:.3})
};
// tinted see-through glass so the interiors show
M.glass = new THREE.MeshPhysicalMaterial({color:0x2a3b5c, metalness:.1, roughness:.04, clearcoat:1, clearcoatRoughness:.03,
  transparent:true, opacity:.42, envMapIntensity:1.6, depthWrite:false});

/* ---------- procedural texture pack (canvas, cached, 64-512px) ---------- */
const TXC={}, MC={}, GEO={}, R_=Math.random;
const geo=(k,f)=>GEO[k]||(GEO[k]=f());
const mat=(k,f)=>MC[k]||(MC[k]=f());
function ctex(key,w,h,draw,o){ if(TXC[key]) return TXC[key]; o=o||{};
  const t=new THREE.CanvasTexture(cvs(w,h,draw));
  if(o.rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(o.rep[0],o.rep[1]); }
  if(!o.data) t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return TXC[key]=t; }
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function star(g,x,y,r,c){ g.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, q=i%2?r*.45:r; g.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q); }
  g.closePath(); g.fillStyle=c; g.fill(); g.lineJoin='round'; g.lineWidth=5; g.strokeStyle='rgba(30,24,60,.55)'; g.stroke(); }
function pix(w,h,f){ return (g)=>{ const d=g.createImageData(w,h); for(let i=0;i<w*h;i++) f(d.data,i*4); g.putImageData(d,0,0); }; }
const T = {
  // metallic flake: tiny random normals + roughness speckle
  flakeN:()=>ctex('fn',256,256,pix(256,256,(d,i)=>{ const a=R_()*6.283, m=R_()<.3?R_()*80:R_()*16;
    d[i]=128+Math.cos(a)*m; d[i+1]=128+Math.sin(a)*m; d[i+2]=255; d[i+3]=255; }),{rep:[4,4],data:1}),
  flakeR:()=>ctex('fr',256,256,pix(256,256,(d,i)=>{ const v=170+R_()*85; d[i]=d[i+1]=d[i+2]=v; d[i+3]=255; }),{rep:[3,3],data:1}),
  tread:()=>ctex('tr',512,64,(g,w,h)=>{ g.fillStyle='#0f1013'; g.fillRect(0,0,w,h); g.fillStyle='#25272d';
    for(let i=0;i<32;i++){ const x=i*16; g.beginPath(); g.moveTo(x,4); g.lineTo(x+10,4); g.lineTo(x+16,h/2-3); g.lineTo(x+6,h/2-3); g.fill();
      g.beginPath(); g.moveTo(x+6,h/2+3); g.lineTo(x+16,h/2+3); g.lineTo(x+10,h-4); g.lineTo(x,h-4); g.fill(); } }),
  wall:()=>ctex('wl',256,256,(g)=>{ g.fillStyle='#131418'; g.fillRect(0,0,256,256); g.translate(128,128);
    g.strokeStyle='#2b2d34'; g.lineWidth=3; [88,122].forEach(r=>{ g.beginPath(); g.arc(0,0,r,0,7); g.stroke(); });
    g.fillStyle='#7d828f'; g.font='700 15px DM Sans, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    const t='MOONGRIP ★ 185/70 R13 ★ ALL-NIGHT ★ ', n=t.length;
    for(let i=0;i<n;i++){ g.save(); g.rotate(i/n*6.2832); g.translate(0,-105); g.fillText(t[i],0,0); g.restore(); } }),
  // headlight reflector: soft rings, facets and a cute catchlight
  refl:()=>ctex('rf',128,128,(g)=>{ const gr=g.createRadialGradient(64,64,4,64,64,64);
    gr.addColorStop(0,'#ffffff'); gr.addColorStop(.45,'#e2ecff'); gr.addColorStop(.8,'#9aaccc'); gr.addColorStop(1,'#56658a'); g.fillStyle=gr; g.fillRect(0,0,128,128);
    g.strokeStyle='rgba(255,255,255,.4)'; g.lineWidth=2; for(let r=14;r<64;r+=10){ g.beginPath(); g.arc(64,64,r,0,7); g.stroke(); }
    g.strokeStyle='rgba(70,90,130,.25)'; for(let i=0;i<16;i++){ const a=i*Math.PI/8; g.beginPath(); g.moveTo(64,64); g.lineTo(64+Math.cos(a)*64,64+Math.sin(a)*64); g.stroke(); }
    g.fillStyle='#fff'; g.beginPath(); g.ellipse(42,40,11,8,-.5,0,7); g.fill(); }),
  lens:()=>ctex('ln',128,64,(g,w,h)=>{ g.fillStyle='#4a0610'; g.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=10) for(let x=(y/10%2)*6-6;x<w;x+=12){ const gr=g.createLinearGradient(x,y,x,y+9);
      gr.addColorStop(0,'#ff7486'); gr.addColorStop(.4,'#d01a34'); gr.addColorStop(1,'#6e0a18'); g.fillStyle=gr; g.fillRect(x+1,y+1,10,8); }
    g.fillStyle='rgba(255,220,220,.35)'; g.fillRect(0,h*.15,w,3); }),
  grille:()=>ctex('gr',64,64,(g)=>{ g.fillStyle='#06070a'; g.fillRect(0,0,64,64); g.strokeStyle='#3a404c'; g.lineWidth=2;
    for(let i=-64;i<128;i+=8){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+64,64); g.stroke(); g.beginPath(); g.moveTo(i,64); g.lineTo(i+64,0); g.stroke(); } },{rep:[6,2]}),
  glow:()=>ctex('gl',64,64,(g)=>{ const gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.3,'rgba(255,255,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); }),
  rim:(t)=>ctex('rim'+t,256,256,(g)=>{ g.translate(128,128);
    g.fillStyle={chrome:'#eef2f8',steel:'#bcc4cf',white:'#f0f0ea',gray:'#80868f'}[t]; g.beginPath(); g.arc(0,0,128,0,7); g.fill();
    g.strokeStyle='rgba(0,0,0,.3)'; g.lineWidth=7; g.beginPath(); g.arc(0,0,116,0,7); g.stroke();
    g.strokeStyle='rgba(255,255,255,.6)'; g.lineWidth=3; g.beginPath(); g.arc(0,0,124,3.6,5.4); g.stroke();
    g.fillStyle='#16181e';
    if(t==='chrome') for(let i=0;i<12;i++){ g.save(); g.rotate(i*Math.PI/6); g.beginPath(); g.ellipse(0,-78,9,28,0,0,7); g.fill(); g.restore(); }
    else if(t==='white') for(let i=0;i<5;i++){ g.save(); g.rotate(i*Math.PI*.4); rr(g,-15,-106,30,52,12); g.fill(); g.restore(); }
    else { const n=t==='steel'?5:4; for(let i=0;i<n;i++){ g.save(); g.rotate(i*6.2832/n+.3); g.beginPath(); g.arc(0,-74,17,0,7); g.fill(); g.restore(); } }
    g.fillStyle='rgba(0,0,0,.45)'; for(let i=0;i<5;i++){ const a=i*Math.PI*.4; g.beginPath(); g.arc(Math.cos(a)*36,Math.sin(a)*36,6,0,7); g.fill(); } }),
  plate:(txt)=>ctex('pl'+txt,256,64,(g,w,h)=>{ g.fillStyle='#1b2550'; rr(g,0,0,w,h,10); g.fill(); g.fillStyle='#ece6d2'; rr(g,4,4,w-8,h-8,8); g.fill();
    g.textAlign='center'; g.fillStyle='#4a58a0'; g.font='700 10px DM Sans, sans-serif'; g.fillText('★ NIGHT GARAGE ☾',w/2,16);
    g.fillStyle='#1b2550'; g.font='800 32px DM Sans, sans-serif'; g.fillText(txt,w/2,52); }),
  decal:(t)=>ctex('dc'+t,256,t==='stripes'?64:256,(g,w,h)=>{
    if(t==='stripes') ['#ff8a3d','#ffd24a','#ff5f7e'].forEach((c,i)=>{ g.fillStyle=c; g.beginPath(); g.moveTo(0,5+i*19); g.lineTo(w-34+i*10,5+i*19); g.lineTo(w-20+i*10,20+i*19); g.lineTo(0,20+i*19); g.fill(); });
    else if(t==='moon'){ g.fillStyle='#fff1b8'; g.beginPath(); g.arc(120,128,92,0,7); g.fill();
      g.globalCompositeOperation='destination-out'; g.beginPath(); g.arc(165,100,82,0,7); g.fill(); g.globalCompositeOperation='source-over';
      g.fillStyle='#3a2d4a'; g.beginPath(); g.arc(58,118,7,0,7); g.fill(); g.fillStyle='rgba(255,140,170,.7)'; g.beginPath(); g.arc(56,150,10,0,7); g.fill();
      star(g,200,196,26,'#ffd85a'); star(g,214,58,14,'#bff3ff'); }
    else { star(g,92,112,62,'#ffd85a'); star(g,192,70,34,'#ff9ad5'); star(g,186,186,26,'#bff3ff'); } })
};
const TM = {
  tread:()=>mat('tread',()=>std(0xffffff,{map:T.tread(),roughness:.92})), wall:()=>mat('wall',()=>std(0xffffff,{map:T.wall(),roughness:.85})),
  rim:t=>mat('rim'+t,()=>std(0xffffff,{map:T.rim(t),metalness:t==='chrome'?1:t==='steel'?.8:.3,roughness:t==='chrome'?.12:.3})),
  grille:()=>mat('grille',()=>std(0xffffff,{map:T.grille(),roughness:.6,metalness:.4})),
  plate:t=>mat('pl'+t,()=>std(0xffffff,{map:T.plate(t),roughness:.45,metalness:.15})),
  decal:t=>mat('dc'+t,()=>std(0xffffff,{map:T.decal(t),transparent:true,roughness:.35,metalness:.1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})),
  glow:c=>mat('gw'+c,()=>new THREE.MeshBasicMaterial({map:T.glow(),color:c,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false})),
  int:c=>c==='tan'?M.tan:mat('in'+c,()=>std(c,{roughness:.85})),
  ant:c=>mat('an'+c,()=>std(c,{emissive:c,emissiveIntensity:.35,roughness:.3}))
};
// clear-coated metallic paint (flake normals under a glossy coat). Holo = duochrome view-angle shift + sparkle.
// dust = faint grime fading in near the sills. Four shader variants in all, shared across cars.
function makePaint(s,dust){
  const kind=(s.holo?'h':'p')+(dust?'d':''), key=kind+(s.holo?s.holo.join():s.color)+(dust?s.yb:'');
  return mat(key,()=>{
    const m=new THREE.MeshPhysicalMaterial({color:s.holo?0xffffff:s.color, metalness:s.holo?.65:.5, roughness:s.holo?.24:.3,
      clearcoat:1, clearcoatRoughness:.06, normalMap:T.flakeN(), normalScale:new THREE.Vector2(.18,.18), roughnessMap:T.flakeR(), envMapIntensity:s.holo?1.4:1.1});
    const cA=s.holo&&new THREE.Color(s.holo[0]).convertSRGBToLinear(), cB=s.holo&&new THREE.Color(s.holo[1]).convertSRGBToLinear();
    let head='', code='';
    if(s.holo){ head+='uniform vec3 cA;\nuniform vec3 cB;\n'; code+=`
      vec3 hv = isOrthographic ? vec3(0.0,0.0,1.0) : normalize(vViewPosition);
      float hf = 1.0 - clamp(abs(dot(normal, hv)), 0.0, 1.0);
      float hk = smoothstep(0.05, 0.95, hf*1.3 + 0.22*normal.x - 0.12*normal.y + 0.1);
      diffuseColor.rgb = mix(cA, cB, hk);
      float hs = fract(sin(dot(floor(vUv*38.0)+floor(hk*6.0), vec2(12.9898,78.233)))*43758.5453);
      totalEmissiveRadiance += mix(cB, vec3(1.0), 0.5) * step(0.986, hs) * 0.8;`; }
    if(dust){ head+='uniform float dTop;\nvarying float vY;\n'; code+=`
      float dk = (1.0 - smoothstep(dTop-0.4, dTop, vY)) * (0.55 + 0.45*fract(sin(dot(floor(vUv*24.0), vec2(41.3,289.1)))*43758.5)) * 0.5;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.23,0.21,0.19), dk);
      roughnessFactor = mix(roughnessFactor, 0.85, dk);`; }
    m.onBeforeCompile=sh=>{
      if(s.holo){ sh.uniforms.cA={value:cA}; sh.uniforms.cB={value:cB}; }
      if(dust){ sh.uniforms.dTop={value:s.yb+.36};
        sh.vertexShader='varying float vY;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvY = position.y;'); }
      sh.fragmentShader=head+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+code);
    };
    m.customProgramCacheKey=()=>kind;
    return m;
  });
}
function B(g,w,h,d,m,x,y,z){ const o=new THREE.Mesh(geo(`b${w},${h},${d}`,()=>new THREE.BoxGeometry(w,h,d)),m); o.position.set(x,y,z); g.add(o); return o; }
function C(g,r,len,m,x,y,z,axis,seg){ const geom=geo(`c${r},${len},${axis},${seg}`,()=>{ const q=new THREE.CylinderGeometry(r,r,len,seg||20);
  if(axis==='x') q.rotateZ(Math.PI/2); if(axis==='z') q.rotateX(Math.PI/2); return q; });
  const o=new THREE.Mesh(geom,m); o.position.set(x,y,z); g.add(o); return o; }
function poly(p){ const s=new THREE.Shape(); s.moveTo(p[0][0],p[0][1]); p.slice(1).forEach(q=>s.lineTo(q[0],q[1])); s.closePath(); return s; }
// extrude a side profile (shape x = forward z, shape y = up) across the car's width
function ext(shape,W,m,bev){ const g=new THREE.ExtrudeGeometry(shape,{depth:W-2*bev,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:4,curveSegments:14});
  g.rotateY(-Math.PI/2); g.translate(W/2-bev,0,0); return new THREE.Mesh(g,m); }
// soft rounded lamp lens; UVs remapped 0..1 across the face so reflector/lens textures fit
function lampGeo(w,h,r){ return geo(`l${w},${h},${r}`,()=>{ const s=new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
  const q=new THREE.ExtrudeGeometry(s,{depth:.02,bevelEnabled:true,bevelThickness:.015,bevelSize:.012,bevelSegments:3,curveSegments:6});
  const p=q.attributes.position, uv=q.attributes.uv; for(let i=0;i<p.count;i++) uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/h+.5); return q; }); }
function wheel(g,R,tw,x,z,rim){
  const w=new THREE.Group(); w.position.set(x,R,z); g.add(w);
  w.add(new THREE.Mesh(geo(`t${R},${tw}`,()=>new THREE.CylinderGeometry(R,R,tw,32).rotateZ(Math.PI/2)),[TM.tread(),TM.wall(),TM.wall()]));
  const rf=TM.rim(rim); w.add(new THREE.Mesh(geo(`r${R},${tw}`,()=>new THREE.CylinderGeometry(R*.64,R*.64,tw+.014,28).rotateZ(Math.PI/2)),[M[rim],rf,rf]));
  C(w,R*.15,tw+.04,M.chrome,0,0,0,'x',12);
  return w;
}

/* ---------- car models (metres; scaled into the lot) ---------- */
const S = .4, KX=1.04, KY=1.1, KW=1.1, BEV=.07;   // chunky toy proportions: a bit taller/wider, oversized wheels, round edges
const SPEC = {
  olds:{name:'Oldsmobile Cutlass Supreme',L:5.1,W:1.83,H:1.37,R:.34,tw:.22,yb:.28,wb:[-1.3,1.57],color:0x4a1426,plate:'CUTLS 84',int:0x5c1b29,frame:'chrome',
    body:[[-2.55,.32],[-2.58,.62],[-2.52,.86],[-1.25,.9],[.6,.9],[2.45,.85],[2.55,.72],[2.55,.34]],
    gh:[[-1.25,.86],[-.88,1.35],[-.05,1.37],[.62,.86]],ghw:.88,roof:[-.95,0,1.35],roofM:'vinyl',bp:-.35,mir:[.45,1.04],
    bump:['chrome',.42,.16],grille:[.62,.3,.64,'chrome'],slots:9,hl:['quad',.64,.62,.36,.11],tl:[.66,.52,.62,.13],rim:'chrome',
    ex(b,{W,F}){ [-1,1].forEach(sd=>{ const x=sd*(W/2+.008); B(b,.02,.03,4.7,M.chrome,sd*(W/2+.012),.88,0); B(b,.02,.04,1.95,M.chrome,sd*(W/2+.012),.36,.13);
        B(b,.012,.014,4.3,M.gold,x,.74,.05); B(b,.012,.008,3.9,M.gold,x,.765,.05); });   // gold double pinstripe
      B(b,.05,.07,.12,M.chrome,0,.96,F-.15); }},
  volvo:{name:'Volvo 240',L:4.79,W:1.71,H:1.43,R:.32,tw:.2,yb:.28,wb:[-1.2,1.44],color:0xc6d0da,plate:'BRK 240',int:0x4a5566,doors:4,flaps:1,
    body:[[-2.39,.3],[-2.42,.62],[-2.36,.9],[-1.3,.93],[.55,.95],[2.3,.9],[2.4,.78],[2.4,.32]],
    gh:[[-1.3,.91],[-.98,1.4],[.12,1.42],[.6,.93]],ghw:.9,roof:[-.98,.12,1.415],bp:-.42,mir:[.5,1.08],
    bump:['trim',.44,.2],grille:[.7,.28,.68,'chrome'],slots:8,hl:['rect',.68,.6,.34,.16],tl:[.68,.6,.36,.24],rim:'steel',
    ex(b,{F,W}){ [F+.13,-F-.13].forEach(z=>B(b,W*.9,.03,.02,M.chrome,0,.47,z)); B(b,.6,.035,.02,M.chrome,0,.68,F+.1).rotation.z=.42;
      [-1,1].forEach(sd=>B(b,.02,.03,4.3,M.chrome,sd*(W/2+.012),.92,0)); }},
  sl:{name:'Mercedes 560 SL',L:4.39,W:1.79,H:1.12,R:.33,tw:.22,yb:.28,wb:[-1.15,1.31],color:0x0a0b0e,plate:'SL 560',int:'tan',zw:.55,bp:-.45,
    body:[[-2.2,.32],[-2.23,.6],[-2.16,.82],[-.85,.86],[.45,.87],[2.08,.8],[2.2,.68],[2.2,.34]],mir:[.5,1.02],
    bump:['chrome',.42,.12],grille:[.5,.32,.62,'chrome'],slots:0,hl:['stack',.62,.62,.26,.26],tl:[.62,.6,.42,.18],rim:'chrome',
    ex(b,{W,F}){ // top down: tan cabin, chrome-framed windscreen, three-pointed star on the hood
      B(b,W*.8,.03,1.3,M.tan,0,.95,-.2);
      const ws=new THREE.Group(); ws.position.set(0,.9,.55); ws.rotation.x=-.62; b.add(ws);
      B(ws,W*.82,.4,.025,M.glass,0,.22,0); B(ws,W*.84,.03,.04,M.chrome,0,.43,0); [-1,1].forEach(sd=>B(ws,.035,.44,.04,M.chrome,sd*W*.42,.22,0));
      C(b,.07,.03,M.chrome,0,.62,F+.1,'z');
      const orn=new THREE.Group(); orn.position.set(0,.92,F-.3); b.add(orn); C(orn,.025,.04,M.chrome,0,0,0);
      const ring=new THREE.Mesh(geo('orn',()=>new THREE.TorusGeometry(.055,.008,6,24)),M.chrome); ring.position.y=.07; orn.add(ring);
      for(let i=0;i<3;i++){ const sp=B(orn,.008,.055,.008,M.chrome,0,.07,0); sp.rotation.z=i*2.094; sp.translateY(.027); }
      [-1,1].forEach(sd=>B(b,.02,.03,4.0,M.chrome,sd*(W/2+.012),.76,0)); }},
  xj:{name:'Jeep Cherokee Sport',L:4.24,W:1.79,H:1.63,R:.36,tw:.24,yb:.34,wb:[-1.2,1.38],color:0x0b0c0f,plate:'XJ 4X4',int:0x2a2b30,doors:4,flaps:1,
    body:[[-2.12,.38],[-2.13,1.0],[.6,1.02],[1.98,.98],[2.12,.92],[2.12,.4]],
    gh:[[-2.08,.99],[-2.04,1.6],[0,1.62],[.62,1.0]],ghw:.9,roof:[-2.02,0,1.615],bp:-.75,mir:[.5,1.14],
    bump:['trim',.5,.2],grille:[.62,.24,.8,'trim'],slots:7,hl:['rect',.8,.6,.3,.17],tl:[.78,.78,.14,.32],rim:'steel',
    ex(b,{W}){ [-1,1].forEach(sd=>{ B(b,.05,.05,1.9,M.trim,sd*W*.36,1.7,-1.0); B(b,.03,.12,3.0,M.gray,sd*(W/2+.012),.86,-.1);
        [-1.9,-.1].forEach(z=>B(b,.07,.06,.1,M.trim,sd*W*.36,1.66,z)); });   // roof rack rails, feet, crossbars
      [-1.8,-1.05,-.3].forEach(z=>B(b,W*.78,.035,.05,M.trim,0,1.72,z)); }},
  bronco:{name:'Ford Bronco',L:3.86,W:1.75,H:1.8,R:.38,tw:.24,yb:.46,wb:[-1.1,1.24],color:0x6fa9a6,plate:'BRNC 79',int:0xb79d78,flaps:1,
    body:[[-1.93,.5],[-1.93,1.12],[.5,1.12],[1.86,1.1],[1.93,1.02],[1.93,.52]],
    gh:[[-1.9,1.1],[-1.9,1.77],[.28,1.77],[.5,1.12]],ghw:.92,roof:[-1.92,.3,1.78],roofM:'white',bp:-.6,mir:[.45,1.29],
    bump:['chrome',.55,.14],grille:[.9,.3,.92,'white'],slots:0,hl:['round',.92,.6,.2,0],tl:[.85,.82,.1,.18],rim:'white',
    ex(b,{W,F}){ B(b,W*.92+.02,.66,.62,M.white,0,1.44,-1.58);
      const sp=wheel(b,.36,.22,0,-F-.2,'white'); sp.position.y=1.0; sp.rotation.y=Math.PI/2; sp.scale.set(KW,KW/KY,KW/KX);
      [-1,1].forEach(sd=>B(b,.02,.07,3.0,M.white,sd*(W/2+.012),1.04,0)); }},
  van:{name:'VW Vanagon',L:4.57,W:1.84,H:1.95,R:.33,tw:.21,yb:.3,wb:[-1.18,1.28],color:0x5b7594,plate:'VAN GO',int:0x7a6450,flaps:1,ant:0xffd24a,
    seams:[1.25,.85,-.4],decals:[['stripes',.05,.95,4.2,.16],['moon',.05,.6,.38,.38],['stars',-.45,.6,.32,.32]],
    body:[[-2.28,.32],[-2.3,1.08],[2.22,1.1],[2.3,.96],[2.32,.34]],
    gh:[[-2.26,1.07],[-2.24,1.9],[1.86,1.93],[2.26,1.1]],ghw:.94,roof:[-2.22,1.84,1.93],roofM:'white',bp:.9,mir:[2.0,1.29],
    bump:['trim',.4,.18],grille:[1.3,.16,.86,'trim'],slots:0,hl:['rect',.86,.58,.3,.16],tl:[.7,.78,.16,.3],rim:'steel',
    ex(b,{W}){ B(b,W*.7,.18,2.4,M.white,0,2.03,-.4);
      [-1,1].forEach(sd=>{ B(b,.02,.12,4.4,M.white,sd*(W/2+.012),1.02,0); B(b,.02,.02,.9,M.trim,sd*(W/2+.012),.7,-.2);
        [.2,-.9].forEach(z=>B(b,.04,.8,.08,M.white,sd*(W*.47+.01),1.5,z)); }); }},
  panda:{name:'Fiat Panda',L:3.38,W:1.49,H:1.46,R:.29,tw:.17,yb:.26,wb:[-1.0,1.16],holo:[0x34e3d0,0x8a52ff],plate:'PANDA 4',int:0x3d4060,ant:0xff9ad5,
    decals:[['stripes',.08,.45,1.2,.25],['stars',.35,.74,.3,.3]],
    body:[[-1.69,.3],[-1.7,.9],[.55,.92],[1.55,.86],[1.69,.78],[1.69,.32]],
    gh:[[-1.67,.9],[-1.64,1.44],[.1,1.46],[.58,.92]],ghw:.92,roof:[-1.64,.1,1.45],bp:-.5,mir:[.5,1.04],
    bump:['gray',.4,.22],grille:[.9,.16,.72,'trim'],slots:0,hl:['rect',.72,.52,.26,.14],tl:[.62,.6,.2,.22],rim:'gray',
    ex(b,{W}){ [-1,1].forEach(sd=>B(b,.02,.16,1.45,M.gray,sd*(W/2+.012),.38,.08)); }},
  r5:{name:'Renault 5',L:3.5,W:1.52,H:1.4,R:.29,tw:.17,yb:.26,wb:[-1.05,1.2],holo:[0xff6fc8,0x5dffb0],plate:'CINQ 5',int:0x5c3150,ant:0x8ef0ff,
    decals:[['stripes',.07,.45,1.2,.25],['moon',.2,.73,.32,.32]],
    body:[[-1.75,.3],[-1.76,.88],[.5,.9],[1.5,.84],[1.75,.72],[1.75,.32]],
    gh:[[-1.73,.88],[-1.52,1.38],[.05,1.4],[.55,.9]],ghw:.9,roof:[-1.5,.05,1.39],bp:-.45,mir:[.48,1.02],
    bump:['gray',.4,.26],grille:[.5,.1,.68,'trim'],slots:0,hl:['rect',.68,.5,.3,.15],tl:[.82,.66,.12,.3],rim:'gray',
    ex(b,{W}){ [-1,1].forEach(sd=>B(b,.02,.14,1.5,M.gray,sd*(W/2+.012),.4,.07)); }},
  samurai:{name:'Suzuki Samurai Sport',L:3.43,W:1.53,H:1.69,R:.34,tw:.2,yb:.42,wb:[-.95,1.08],color:0x232f6c,plate:'SAM 413',int:0x34363f,flaps:1,ant:0xffd85a,
    decals:[['stars',.05,.75,.3,.3]],
    body:[[-1.6,.46],[-1.6,1.02],[.45,1.02],[1.55,.98],[1.66,.9],[1.66,.48]],
    gh:[[-1.58,1.0],[-1.58,1.66],[.2,1.67],[.48,1.02]],ghw:.92,roof:[-1.58,.22,1.67],roofM:'white',bp:-.4,mir:[.42,1.16],
    bump:['trim',.5,.16],grille:[.62,.22,.82,'trim'],slots:5,hl:['round',.82,.5,.2,0],tl:[.75,.66,.12,.2],rim:'steel',
    ex(b,{W,F}){ const sp=wheel(b,.32,.2,0,-F-.19,'steel'); sp.position.y=.95; sp.rotation.y=Math.PI/2; sp.scale.set(KW,KW/KY,KW/KX);
      [-1,1].forEach(sd=>{ B(b,.02,.05,2.6,M.white,sd*(W/2+.012),.86,0); B(b,.02,.03,2.6,M.white,sd*(W/2+.012),.94,0); }); }}
};
const BEAMG = new THREE.ConeGeometry(1.3,6,18,1,true); BEAMG.translate(0,-3,0); BEAMG.rotateX(-Math.PI/2);
const BLOBM = new THREE.MeshBasicMaterial({color:0x03060f,transparent:true,opacity:.5,depthWrite:false});
const BLOBG = new THREE.CircleGeometry(1,28);
const PLANE = new THREE.PlaneGeometry(1,1);

// seats, dash, steering wheel and carpet, sitting on the body top under the glass
function interior(b,s,W,ytop,zw){
  const IM=TM.int(s.int||0x2a2d35), sx=W*.22, zb=zw-.95;
  [-1,1].forEach(sd=>{ const x=sd*sx; B(b,.42,.1,.4,IM,x,ytop+.05,zb+.22); B(b,.42,.34,.1,IM,x,ytop+.2,zb).rotation.x=-.14;
    if(!s.gh) B(b,.24,.14,.08,IM,x,ytop+.45,zb-.04); });
  if(s.gh){ const zr2=Math.max(zb-.75,s.roof[0]+.14);
    if(zr2<zb-.45){ B(b,W*.7,.1,.36,IM,0,ytop+.05,zr2+.2); B(b,W*.7,.3,.1,IM,0,ytop+.17,zr2).rotation.x=-.12; }
    B(b,W*s.ghw-.08,.012,zw-s.gh[0][0]-.2,M.trim,0,ytop+.006,(zw+s.gh[0][0])/2); }
  B(b,W*.8,.1,.2,M.trim,0,ytop+.06,zw-.32);
  const sw=new THREE.Mesh(geo('sw',()=>new THREE.TorusGeometry(.13,.018,8,20)),M.trim); sw.position.set(sx,ytop+.2,zw-.6); sw.rotation.x=-.5; b.add(sw);
}

function buildCar(k,over){
  const s=Object.assign({},SPEC[k],over||{}), g=new THREE.Group(), b=new THREE.Group(), wg=new THREE.Group(); g.add(b,wg);
  b.scale.set(S*KX,S*KY,S); wg.scale.setScalar(S*KW);   // wheels live in a uniform group so they stay round
  const {L,W,R,tw}=s, F=L/2, FF=F+BEV, [zr,zf]=s.wb, a=R*KW+.05+BEV;
  const P=makePaint(s,true), P2=makePaint(s,false);
  const hlM=std(0xffffff,{map:T.refl(),emissive:0xe2f0ff,emissiveMap:T.refl(),emissiveIntensity:.12,roughness:.1,metalness:.2});
  const tlM=std(0xffffff,{map:T.lens(),emissive:0xff2a40,emissiveMap:T.lens(),emissiveIntensity:.3,roughness:.2});
  const rvM=std(0x8d96a1,{emissive:0xf2f8ff,emissiveIntensity:0});
  // body side profile with wheel arches, bevelled for soft toy edges
  const sh=new THREE.Shape(), p=s.body;
  sh.moveTo(p[0][0],p[0][1]); p.slice(1).forEach(q=>sh.lineTo(q[0],q[1]));
  sh.lineTo(zf+a,s.yb); sh.absarc(zf,R,a,0,Math.PI,false); sh.lineTo(zf-a,s.yb);
  sh.lineTo(zr+a,s.yb); sh.absarc(zr,R,a,0,Math.PI,false); sh.lineTo(zr-a,s.yb); sh.closePath();
  b.add(ext(sh,W,P,BEV));
  const ytop=Math.max(...p.map(q=>q[1]))+BEV, zw=s.gh?s.gh[s.gh.length-1][0]:s.zw;
  // tinted glass greenhouse, roof skin, pillars and window frames
  if(s.gh){ const gw=W*s.ghw, gh=s.gh, FR=M[s.frame||'trim']; b.add(ext(poly(gh),gw,M.glass,.02));
    const [z0,z1,y]=s.roof; B(b,gw+.04,.06,z1-z0+.04,s.roofM?M[s.roofM]:P2,0,y,(z0+z1)/2);
    const yl=Math.min(...gh.map(q=>q[1]));
    [-1,1].forEach(sd=>{ const x=sd*(gw/2+.01); B(b,.035,y-yl,.09,P2,x,(yl+y)/2,s.bp);
      for(let i=0;i<gh.length-1;i++){ const [za,ya]=gh[i], [zb,yb]=gh[i+1];
        B(b,.03,.05,Math.hypot(zb-za,yb-ya)+.04,FR,x,(ya+yb)/2,(za+zb)/2).rotation.x=-Math.atan2(yb-ya,zb-za); } });
    if(s.ant){ const ax=-gw*.3; C(b,.008,.5,M.chrome,ax,y+.27,z0+.25,0,6);
      const ball=new THREE.Mesh(geo('ball',()=>new THREE.SphereGeometry(.05,12,8)),TM.ant(s.ant)); ball.position.set(ax,y+.54,z0+.25); b.add(ball); } }
  interior(b,s,W,ytop,zw);
  // mirrors (rounded housing + glass), wipers
  [-1,1].forEach(sd=>{ const x=sd*(W/2+.11), [mz,my]=s.mir;
    B(b,.12,.03,.03,M.trim,sd*(W/2+.04),my-.04,mz);
    const h=new THREE.Mesh(geo('mirH',()=>new THREE.SphereGeometry(.08,14,10)),P2); h.scale.set(1.1,.75,.55); h.position.set(x,my,mz); b.add(h);
    const mg=new THREE.Mesh(geo('mirG',()=>new THREE.CircleGeometry(.066,16)),M.chrome); mg.scale.set(1.1,.7,1); mg.position.set(x,my,mz-.045); mg.rotation.y=Math.PI; b.add(mg);
    B(b,W*.3,.015,.025,M.trim,sd*W*.15-.05,ytop+.012,zw+.03).rotation.y=sd*.1; });
  // door seams + handles
  const seams=s.seams||[zw-.04,s.bp+.03].concat(s.doors===4?[s.bp-.95]:[]), inArch=z=>Math.abs(z-zf)<a||Math.abs(z-zr)<a;
  [-1,1].forEach(sd=>seams.forEach((z,i)=>{ const y0=inArch(z)?R+a-BEV+.03:s.yb+.06, y1=ytop-.06;
    B(b,.01,y1-y0,.012,M.seam,sd*(W/2+.002),(y0+y1)/2,z);
    if(i) B(b,.025,.028,.11,M.chrome,sd*(W/2+.012),ytop-.14,z+.1); }));
  // bumpers, plates, grille mesh
  const [bm,by,bh]=s.bump; [F+.05,-F-.05].forEach(z=>B(b,W+.03,bh,.14,M[bm],0,by,z));
  [[F+.123,0],[-F-.123,Math.PI]].forEach(([z,r])=>{ const pl=new THREE.Mesh(geo('plate',()=>new THREE.PlaneGeometry(.5,.13)),TM.plate(s.plate)); pl.position.set(0,by,z); pl.rotation.y=r; b.add(pl); });
  const [gw2,gh2,gy,gm]=s.grille; B(b,gw2,gh2,.04,gm==='white'?M.white:TM.grille(),0,gy,FF+.005);
  if(gm==='chrome') [1,-1].forEach(v=>B(b,gw2+.04,.025,.05,M.chrome,0,gy+v*gh2/2,FF+.01));
  for(let i=0;i<(s.slots||0);i++) B(b,.025,gh2*.8,.05,gm==='chrome'?M.chrome:M.gray,(i-(s.slots-1)/2)*gw2/s.slots,gy,FF+.015);
  // lamps: soft rounded lenses in chrome bezels, reflector + lens textures, faint glow
  const [ht,hy,hx,hw,hh]=s.hl, [ty,tx,tw2,th]=s.tl, glows=[];
  const lamp=(gm,m,x,y,z,back)=>{ const o=new THREE.Mesh(gm,m); o.position.set(x,y,z); o.scale.y=1/KY; if(back) o.rotation.y=Math.PI; b.add(o); };
  [-1,1].forEach(sd=>{ const x=sd*hx;
    const ls = ht==='round'?[[x,hy,hw*1.08,hw*1.08]] : ht==='quad'?[[x-hw*.26,hy,hw*.44,hh],[x+hw*.26,hy,hw*.44,hh]]
      : ht==='stack'?[[x,hy+hh*.27,hw,hh*.44],[x,hy-hh*.27,hw,hh*.44]] : [[x,hy,hw,hh]];
    ls.forEach(([lx,ly,lw,lh])=>{ const r=Math.min(lw,lh)*(ht==='round'?.49:.4);
      lamp(lampGeo(lw+.04,lh+.04,r+.02),M.chrome,lx,ly,FF-.005); lamp(lampGeo(lw,lh,r),hlM,lx,ly,FF+.01); glows.push([lx,ly,FF+.06,Math.max(lw,lh)*2.4,0xcfe4ff]); });
    lamp(lampGeo(tw2,th,Math.min(tw2,th)*.3),tlM,sd*tx,ty,-FF-.01,true);
    lamp(lampGeo(Math.min(.1,tw2*.4),Math.min(.08,th*.5),.015),rvM,sd*(tx-tw2/2+.06),ty,-FF-.03,true);
    glows.push([sd*tx,ty,-FF-.07,Math.max(tw2,th)*1.8,0xff3050]); });
  // wheels (slightly oversized), mudflaps, exhaust tip
  const wx=W/2-tw/2+.03, wheels=[];
  [zr,zf].forEach(z=>[-1,1].forEach(sd=>wheels.push(wheel(wg,R,tw,sd*wx*KX/KW,z/KW,s.rim))));
  if(s.flaps) [zr,zf].forEach(z=>[-1,1].forEach(sd=>B(b,tw*1.1,s.yb-.1,.02,M.rubber,sd*wx,(s.yb+.1)/2,z-R*KW-.02)));
  const ey=Math.max(.16,by-bh/2-.05); C(b,.04,.2,M.chrome,-W*.28,ey,-F-.1,'z',14); C(b,.028,.012,M.grille,-W*.28,ey,-F-.2,'z',12);
  const exO=new THREE.Object3D(); exO.position.set(-W*.28,ey,-F-.24); b.add(exO);
  if(s.ex) s.ex(b,{W,F,L,P:P2});
  b.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  // non-shadow extras: stickers and lamp glow
  (s.decals||[]).forEach(([t,z,y,w,h])=>[-1,1].forEach(sd=>{ const d=new THREE.Mesh(PLANE,TM.decal(t)); d.scale.set(w,h,1); d.position.set(sd*(W/2+.004),y,z); d.rotation.y=sd*Math.PI/2; b.add(d); }));
  glows.forEach(([x,y,z,sz,c])=>{ const q=new THREE.Mesh(PLANE,TM.glow(c)); q.scale.set(sz,sz/KY,1); q.position.set(x,y,z); if(z<0) q.rotation.y=Math.PI; q.raycast=()=>{}; b.add(q); });
  // headlight beams + contact shadow
  const beamM=new THREE.MeshBasicMaterial({color:0xdcefff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  const beams=[-1,1].map(sd=>{ const m=new THREE.Mesh(BEAMG,beamM); m.position.set(sd*hx,hy,FF); m.visible=false; b.add(m); return m; });
  const blob=new THREE.Mesh(BLOBG,BLOBM); blob.rotation.x=-Math.PI/2; blob.scale.set(W*.66,L*.58,1); blob.position.y=.03; b.add(blob);
  return {g,exO,hlM,tlM,rvM,beamM,beams,wheels,name:s.name,H:s.H*S*KY,R:R*S*KW,len:L*S};
}

/* =====================================================================
   CONCEPT CARS: sleek 1980s concept studies (metres, face +Z, sit on y=0)
   Wedge side profiles extruded with bevels, plan-view nose taper and
   tumblehome on the glass, flush tinted glass, slim light bars, aero
   wheel covers, panel seams, interiors you can see through the glass.
   ===================================================================== */
const CBEV = .05;
const CP = { white:0xf0efe9, silver:0xc3c8cc, sand:0xd6c39c, sage:0x9aa98a, clay:0xb57655, slate:0x5f6b75, khaki:0x8c8068, bone:0xe6e0d0 };
const CM = {
  gloss:std(0x0b0c0e,{roughness:.14,metalness:.3}), satin:std(0xb9bec4,{metalness:.9,roughness:.25}),
  dash:std(0x1d1f22,{roughness:.7}), rub:std(0x16171a,{roughness:.85})
};
CM.glass = new THREE.MeshPhysicalMaterial({color:0x26332f, metalness:.1, roughness:.03, clearcoat:1, clearcoatRoughness:.02,
  transparent:true, opacity:.38, envMapIntensity:1.6, depthWrite:false});
// clear-coated paint: light flake normals under a glossy coat; reflects the envMap
function paintC(c){ return mat('cp'+c,()=>{ const hsl={}; new THREE.Color(c).getHSL(hsl);
  return new THREE.MeshPhysicalMaterial({color:c, metalness:hsl.s<.08?.6:.25, roughness:.3, clearcoat:1, clearcoatRoughness:.04,
    normalMap:T.flakeN(), normalScale:new THREE.Vector2(.1,.1), envMapIntensity:1.25}); }); }
const cladM = c => mat('cl'+c,()=>new THREE.MeshPhysicalMaterial({color:c, roughness:.5, metalness:.1, clearcoat:.4, clearcoatRoughness:.3}));
const intM = c => mat('ci'+c,()=>std(c,{roughness:.85}));

/* concept textures (canvas, cached, <=512px) */
const CT = {
  cover:(t)=>ctex('cv'+t,256,256,(g)=>{ g.translate(128,128);
    const gr=g.createRadialGradient(-30,-40,10,0,0,128); gr.addColorStop(0,'#ffffff'); gr.addColorStop(.7,'#dfe1e2'); gr.addColorStop(1,'#a9adb1');
    g.fillStyle=gr; g.beginPath(); g.arc(0,0,128,0,7); g.fill();
    g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=4; g.beginPath(); g.arc(0,0,120,0,7); g.stroke();
    g.fillStyle='#1a1c20'; g.strokeStyle='#1a1c20';
    if(t==='turbine') for(let i=0;i<16;i++){ g.save(); g.rotate(i*Math.PI/8); g.beginPath(); g.moveTo(0,-42); g.quadraticCurveTo(34,-70,22,-108);
      g.lineTo(10,-108); g.quadraticCurveTo(20,-72,-6,-44); g.closePath(); g.fill(); g.restore(); }
    else if(t==='slots') for(let i=0;i<8;i++){ g.save(); g.rotate(i*Math.PI/4); rr(g,-9,-104,18,44,8); g.fill(); g.restore(); }
    else { g.lineWidth=3; g.beginPath(); g.arc(0,0,86,0,7); g.stroke();
      for(let i=0;i<3;i++){ g.save(); g.rotate(i*2.094+.4); g.beginPath(); g.ellipse(0,-100,22,6,0,0,7); g.fill(); g.restore(); } }
    const hub=g.createRadialGradient(-6,-6,2,0,0,30); hub.addColorStop(0,'#f4f5f6'); hub.addColorStop(1,'#7d8288');
    g.fillStyle=hub; g.beginPath(); g.arc(0,0,30,0,7); g.fill(); g.strokeStyle='rgba(0,0,0,.4)'; g.lineWidth=2; g.stroke(); }),
  bar:(red)=>ctex('lb'+red,256,32,(g,w,h)=>{ g.fillStyle=red?'#3a0508':'#14171b'; g.fillRect(0,0,w,h);
    for(let x=4;x<w;x+=red?6:16){ const gr=g.createLinearGradient(0,4,0,h-4);
      if(red){ gr.addColorStop(0,'#ff6a72'); gr.addColorStop(.5,'#d3182a'); gr.addColorStop(1,'#6a0812'); g.fillStyle=gr; g.fillRect(x,3,4,h-6); }
      else { gr.addColorStop(0,'#ffffff'); gr.addColorStop(1,'#bcd0e4'); g.fillStyle=gr; rr(g,x,7,12,h-14,3); g.fill(); } }
    g.fillStyle='rgba(255,255,255,.3)'; g.fillRect(0,2,w,2); }),
  solar:()=>ctex('so',256,256,(g)=>{ g.fillStyle='#c9ccd0'; g.fillRect(0,0,256,256);
    for(let y=0;y<4;y++) for(let x=0;x<4;x++){ const gr=g.createLinearGradient(x*64,y*64,x*64+64,y*64+64);
      gr.addColorStop(0,'#1d2d4a'); gr.addColorStop(1,'#0e1a2e'); g.fillStyle=gr; g.fillRect(x*64+2,y*64+2,60,60);
      g.fillStyle='rgba(190,205,225,.35)'; [20,42].forEach(q=>g.fillRect(x*64+q,y*64+2,1,60)); } },{rep:[2,1]}),
  vent:()=>ctex('vt',128,32,(g,w,h)=>{ g.fillStyle='#08090b'; g.fillRect(0,0,w,h); g.fillStyle='#3b4047'; for(let y=3;y<h;y+=6) g.fillRect(0,y,w,2); }),
  stripe:()=>ctex('st',512,32,(g,w)=>{ ['#b5603f','#d6a35a','#8fa07c'].forEach((c,i)=>{ g.fillStyle=c; g.fillRect(0,2+i*10,w,i===0?8:5); }); }),
  dash:()=>ctex('da',128,32,(g,w,h)=>{ g.fillStyle='#050807'; g.fillRect(0,0,w,h); g.fillStyle='#7dffc4';
    g.font='700 16px monospace'; g.fillText('88',8,22); for(let i=0;i<14;i++) g.fillRect(44+i*5,24-i,3,i+2); g.fillText('42',104,22); })
};
const CTM = {
  cover:(t,c)=>mat('cvm'+t+c,()=>std(c,{map:CT.cover(t),metalness:.55,roughness:.22})),
  vent:()=>mat('vent',()=>std(0xffffff,{map:CT.vent(),roughness:.6})),
  solar:()=>mat('solar',()=>new THREE.MeshPhysicalMaterial({map:CT.solar(),roughness:.15,metalness:.3,clearcoat:1,clearcoatRoughness:.03})),
  stripe:()=>mat('stripe',()=>std(0xffffff,{map:CT.stripe(),roughness:.3,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})),
  dash:()=>mat('dash',()=>new THREE.MeshBasicMaterial({map:CT.dash()}))
};

// extrude a side profile across the width (bevel grows the outline by bev on every side)
function extG(shape,W,bev,seg){ const g=new THREE.ExtrudeGeometry(shape,{depth:W-2*bev,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:seg||3,curveSegments:24});
  g.rotateY(-Math.PI/2); g.translate(W/2-bev,0,0); return g; }
// arch-clipped lower cladding: front bumper piece, side skirt, rear bumper piece
function bandShapes(s,F,a,clY){ const [zr,zf]=s.wb, R=s.R, y0=s.yb-.03, t1=Math.asin(Math.max(-1,Math.min(1,(clY-R)/a))), dz=a*Math.cos(t1), out=[];
  let q=new THREE.Shape(); q.moveTo(zf+a,y0); q.lineTo(F+.02,y0); q.lineTo(F+.02,clY); q.lineTo(zf+dz,clY); q.absarc(zf,R,a,t1,0,true); q.closePath(); out.push(q);
  q=new THREE.Shape(); q.moveTo(zr+a,y0); q.lineTo(zf-a,y0); q.lineTo(zf-a,R); q.absarc(zf,R,a,Math.PI,Math.PI-t1,true); q.lineTo(zr+dz,clY); q.absarc(zr,R,a,t1,0,true); q.closePath(); out.push(q);
  q=new THREE.Shape(); q.moveTo(-F-.02,y0); q.lineTo(zr-a,y0); q.lineTo(zr-a,R); q.absarc(zr,R,a,Math.PI,Math.PI-t1,true); q.lineTo(-F-.02,clY); q.closePath(); out.push(q);
  return out; }

const CSPEC = {
  wedge:{name:'Arrow Zero',L:4.2,W:1.9,R:.33,tw:.27,yb:.2,wb:[-1.3,1.25],c:CP.white,clad:0x4b545c,clY:.36,nose:.16,nt:1.0,
    body:[[-2.1,.22],[-2.12,.78],[-1.2,.86],[.2,.82],[2.05,.48],[2.12,.4],[2.1,.22]],
    gh:[[-1.3,.84],[-.9,1.12],[-.2,1.14],[.5,.77]],ghw:.8,tk:.22,roof:'paint',rf:[-.9,-.2],bp:-.55,seams:[.42,-.95],hood:[.62],
    hl:{t:'popup',pz:1.42,px:.58},fog:{y:.29,z:2.17,w:.42,x:.55},tl:{t:'bar',y:.64,z:-2.175,w:1.62,h:.09,tilt:.04},
    cover:'turbine',cc:0xe9e9e4,int:0x3b3f44,seats:2,stripe:[.5,-.95,.9,.05],
    ex(b,c){ for(let i=0;i<7;i++){ const z=-1.95+i*.09; B(b,1.18,.018,.06,CM.gloss,0,c.topAt(z)+.02,z).rotation.x=.35; }
      [-1,1].forEach(sd=>B(b,.012,.08,.36,CM.gloss,sd*(c.W/2+.004),.66,-.75)); B(b,1.2,.05,.012,CTM.vent(),0,.43,2.17); }},
  aero:{name:'Probe Eolienne',L:4.3,W:1.86,R:.32,tw:.25,yb:.2,wb:[-1.35,1.3],c:CP.silver,clad:0x8b9095,clY:.3,nose:.18,nt:.9,smooth:1,
    body:[[-2.12,.26],[-2.17,.6],[-1.95,.8],[-1.1,.88],[.2,.83],[1.3,.64],[2.02,.46],[2.15,.36],[2.14,.26]],
    gh:[[-1.92,.78],[-1.45,1.04],[-.7,1.19],[-.05,1.2],[.62,.74]],ghw:.84,tk:.2,roof:'glass',bp:-.6,seams:[.5,-.85],hood:[],
    hl:{t:'bar',y:.43,z:2.13,w:1.3,h:.05,tilt:-.6},tl:{t:'bar',y:.69,z:-2.14,w:1.5,h:.06,tilt:.5},
    cover:'disc',cc:0xf2f2ee,int:0x6f7378,seats:2,skirt:1},
  space:{name:'Megaspazio',L:4.25,W:1.88,R:.32,tw:.24,yb:.22,wb:[-1.25,1.35],c:CP.sand,clad:0x6d6250,clY:.4,nose:.1,nt:1.2,
    body:[[-2.1,.26],[-2.12,.96],[-1.95,1.01],[.6,1.0],[1.95,.74],[2.13,.62],[2.12,.26]],
    gh:[[-2.06,.99],[-2.0,1.62],[-.2,1.68],[.4,1.63],[1.7,.8]],ghw:.88,tk:.1,roof:'solar',rf:[-1.85,.15],bp:-.3,seams:[.55,-.45],hood:[],
    hl:{t:'bar',y:.56,z:2.19,w:1.5,h:.08,tilt:-.2},tl:{t:'pillars',y:.72,z:-2.175,w:.1,h:.42,x:.8},
    cover:'slots',cc:0xe6e2d8,int:0xc8b48c,seats:4,rack:1},
  sedan:{name:'Aerodyne 100',L:4.4,W:1.86,R:.32,tw:.24,yb:.22,wb:[-1.35,1.35],c:CP.sage,clad:0x56614d,clY:.38,nose:.1,nt:1.3,
    body:[[-2.18,.28],[-2.2,.82],[-2.02,.88],[-1.1,.9],[.5,.88],[2.05,.66],[2.2,.54],[2.18,.28]],
    gh:[[-1.75,.9],[-1.15,1.34],[.05,1.37],[.75,.86]],ghw:.86,tk:.16,roof:'paint',rf:[-1.1,.05],bp:-.5,seams:[.72,-.45,-1.4],hood:[.85],
    hl:{t:'split',y:.47,z:2.25,w:.55,h:.09,x:.52,tilt:-.15},tl:{t:'bar',y:.75,z:-2.255,w:1.7,h:.1,tilt:.08},
    cover:'turbine',cc:0xdcdcd4,int:0x8a6a4a,seats:4,stripe:[.56,-1.0,.95,.04]},
  kamm:{name:'Kamm GT',L:3.84,W:1.8,R:.31,tw:.23,yb:.2,wb:[-1.18,1.2],c:CP.clay,clad:0x3a3330,clY:.36,nose:.12,nt:1.0,
    body:[[-1.9,.26],[-1.93,.88],[-1.86,.92],[.4,.9],[1.8,.64],[1.94,.52],[1.92,.26]],
    gh:[[-1.85,.9],[-1.72,1.34],[-.2,1.42],[.55,.86]],ghw:.86,tk:.18,roof:'paint',rf:[-1.68,-.15],bp:-.62,seams:[.52,-.62],hood:[.7],
    hl:{t:'split',y:.46,z:1.99,w:.48,h:.1,x:.5,tilt:-.2},tl:{t:'bar',y:.74,z:-1.985,w:1.5,h:.1,tilt:.03},
    cover:'slots',cc:0xe9e9e4,int:0x2b2b2e,seats:4,stripe:[.5,-.75,.75,.05],
    ex(b,c){ const ws=c.W*c.s.ghw*(1-c.s.tk); B(b,ws+.08,.03,.3,CM.gloss,0,1.39,-1.68).rotation.x=-.12; }},
  pyramid:{name:'Karin Prisma',L:3.9,W:1.9,R:.32,tw:.25,yb:.22,wb:[-1.2,1.25],c:CP.slate,clad:0x2f3438,clY:.36,nose:.12,nt:1.0,
    body:[[-1.95,.26],[-1.97,.8],[-1.86,.86],[.2,.86],[1.85,.64],[1.97,.52],[1.95,.26]],
    gh:[[-1.75,.86],[-.6,1.38],[-.25,1.4],[.95,.8]],ghw:.88,tk:.5,roof:'paint',rf:[-.62,-.22],seams:[.9,-.5],hood:[1.0],
    hl:{t:'bar',y:.48,z:2.025,w:1.6,h:.07,tilt:-.2},tl:{t:'bar',y:.7,z:-2.025,w:1.6,h:.08,tilt:.05},
    cover:'disc',cc:0xd9dadc,int:0xb9a37a,seats:2},
  targa:{name:'Spyder Sole',L:4.0,W:1.84,R:.32,tw:.26,yb:.2,wb:[-1.22,1.25],c:CP.bone,clad:0xa4553a,clY:.34,nose:.15,nt:.9,
    body:[[-2.0,.26],[-2.02,.8],[-1.25,.84],[-.3,.8],[1.95,.52],[2.02,.42],[2.0,.26]],
    roof:'open',belt:.82,zw:.3,seams:[.25,-.9],hood:[.45],
    hl:{t:'popup',pz:1.3,px:.6},fog:{y:.28,z:2.07,w:.4,x:.55},tl:{t:'bar',y:.66,z:-2.075,w:1.5,h:.08,tilt:.05},
    cover:'turbine',cc:0xece8dc,int:0xa4553a,seats:2},
  rover:{name:'Terra Wedge',L:4.24,W:1.92,R:.38,tw:.3,yb:.44,wb:[-1.25,1.3],c:CP.khaki,clad:0x34322e,clY:.72,nose:.05,nt:1.4,
    body:[[-2.1,.48],[-2.12,1.08],[.5,1.1],[1.95,.92],[2.12,.84],[2.12,.48]],
    gh:[[-2.08,1.08],[-2.0,1.66],[-.1,1.7],[.62,1.06]],ghw:.88,tk:.1,roof:'solar',rf:[-1.9,-.25],bp:-.55,seams:[.55,-.55],hood:[.75],
    hl:{t:'split',y:.79,z:2.18,w:.5,h:.08,x:.55,tilt:0},tl:{t:'pillars',y:.9,z:-2.175,w:.1,h:.3,x:.82},
    cover:'slots',cc:0x8d9196,int:0x5a5146,seats:4,rack:1,flares:1}
};

function lampBox(b,w,h,m,x,y,z,tilt,back){ const q=new THREE.Group(); q.position.set(x,y,z); q.rotation.set(tilt||0,back?Math.PI:0,0); b.add(q);
  B(q,w+.03,h+.03,.025,CM.gloss,0,0,0); B(q,w,h,.02,m,0,0,.008); return q; }
function cwheel(g,R,tw,x,z,cover,cc){ const w=new THREE.Group(); w.position.set(x,R,z); g.add(w);
  w.add(new THREE.Mesh(geo(`t${R},${tw}`,()=>new THREE.CylinderGeometry(R,R,tw,32).rotateZ(Math.PI/2)),[TM.tread(),TM.wall(),TM.wall()]));
  C(w,R*.76,tw+.006,CM.gloss,0,0,0,'x',28);
  const cm=CTM.cover(cover,cc); w.add(new THREE.Mesh(geo(`cv${R},${tw}`,()=>new THREE.CylinderGeometry(R*.72,R*.72,tw+.014,32).rotateZ(Math.PI/2)),[CM.satin,cm,cm]));
  return w; }

function buildConcept(kind,color){
  const s=CSPEC[kind], g=new THREE.Group(), b=new THREE.Group(); g.add(b);
  const {L,W,R,tw,yb}=s, F=L/2, [zr,zf]=s.wb, a=R+.06, BV=CBEV, P=paintC(color==null?s.c:color);
  const p=s.body, top=p.slice(1,-1);
  const topAt=z=>{ for(let i=0;i<top.length-1;i++){ const [z0,y0]=top[i],[z1,y1]=top[i+1]; if((z-z0)*(z-z1)<=0) return y0+(y1-y0)*(z-z0)/((z1-z0)||1)+BV; }
    return Math.max(...top.map(q=>q[1]))+BV; };
  const tap=z=> z>s.nt ? 1-s.nose*Math.pow(Math.min(1,(z-s.nt)/(F-s.nt)),2) : z<-F+.5 ? 1-.05*Math.pow(Math.min(1,(-F+.5-z)/.5),2) : 1;
  const taper=(gm,y0,y1,tk)=>{ const pa=gm.attributes.position; for(let i=0;i<pa.count;i++){ let k=tap(pa.getZ(i));
    if(tk) k*=1-tk*Math.max(0,Math.min(1,(pa.getY(i)-y0)/(y1-y0))); pa.setX(i,pa.getX(i)*k); } return gm; };
  const halfAt=z=>W/2*tap(z);
  const hlM=std(0xffffff,{map:CT.bar(0),emissive:0xeef6ff,emissiveMap:CT.bar(0),emissiveIntensity:.15,roughness:.1,metalness:.2});
  const tlM=std(0xffffff,{map:CT.bar(1),emissive:0xff2a3c,emissiveMap:CT.bar(1),emissiveIntensity:.3,roughness:.15});
  // body: wedge side profile with wheel arches
  b.add(new THREE.Mesh(geo('cb'+kind,()=>{ const sh=new THREE.Shape(); sh.moveTo(p[0][0],p[0][1]);
    if(s.smooth) sh.splineThru(top.map(q=>new THREE.Vector2(q[0],q[1]))); else top.forEach(q=>sh.lineTo(q[0],q[1]));
    const e=p[p.length-1]; sh.lineTo(e[0],e[1]); sh.lineTo(zf+a,yb); sh.absarc(zf,R,a,0,Math.PI,false); sh.lineTo(zr+a,yb); sh.absarc(zr,R,a,0,Math.PI,false);
    sh.lineTo(zr-a,yb); sh.closePath(); return taper(extG(sh,W,BV,4)); }),P));
  // two-tone lower cladding wrapping the bumpers and sills
  const CL=cladM(s.clad);
  bandShapes(s,F,a,s.clY).forEach((q,i)=>b.add(new THREE.Mesh(geo('cc'+kind+i,()=>taper(extG(q,W+.03,.035))),CL)));
  // flush tinted glass with tumblehome, roof skin, blacked-out B-pillar
  let belt, zw;
  if(s.gh){ const gw=W*s.ghw, ys=s.gh.map(q=>q[1]), yl=Math.min(...ys), yt=Math.max(...ys); belt=yl; zw=s.gh[s.gh.length-1][0];
    b.add(new THREE.Mesh(geo('cg'+kind,()=>taper(extG(poly(s.gh),gw,.03),yl,yt,s.tk)),CM.glass));
    const rw=gw*(1-s.tk)+.03, ry=yt+.045;
    if(s.roof!=='glass'){ const [z0,z1]=s.rf; B(b,rw,.03,z1-z0,P,0,ry,(z0+z1)/2);
      if(s.roof==='solar') B(b,rw-.12,.012,z1-z0-.12,CTM.solar(),0,ry+.02,(z0+z1)/2); }
    else B(b,rw*.3,.012,1.2,CM.gloss,0,ry-.01,-.7);
    if(s.bp!=null) [-1,1].forEach(sd=>{ const h=yt-yl, o=B(b,.02,h,.12,CM.gloss,sd*(gw/2*(1-s.tk/2)+.032),(yl+yt)/2+.02,s.bp); o.rotation.z=sd*Math.atan(s.tk*gw/2/h); });
    if(s.rack){ [-1,1].forEach(sd=>B(b,.04,.05,(s.rf[1]-s.rf[0])+.3,CM.satin,sd*(rw/2-.04),ry+.07,(s.rf[0]+s.rf[1])/2));
      [s.rf[0]+.05,s.rf[1]-.05].forEach(z=>B(b,rw-.06,.025,.05,CM.satin,0,ry+.1,z)); }
    // monowiper at the windscreen base
    B(b,W*.42,.015,.03,CM.gloss,-.1,topAt(zw+.12)+.01,zw+.12).rotation.y=.12;
  } else { // open cockpit: raked screen + roll hoop
    belt=s.belt; zw=s.zw; const ws=new THREE.Group(); ws.position.set(0,belt,zw); ws.rotation.x=-.95; b.add(ws);
    B(ws,W*.8,.42,.02,CM.glass,0,.21,0); B(ws,W*.82,.03,.035,CM.gloss,0,.43,0); [-1,1].forEach(sd=>B(ws,.035,.44,.035,CM.gloss,sd*W*.41,.22,0));
    const hoop=new THREE.Mesh(geo('hoop',()=>new THREE.TorusGeometry(.66,.045,8,24,Math.PI)),P); hoop.position.set(0,belt-.05,-.85); hoop.scale.y=.62; b.add(hoop);
    B(b,W*.78,.008,1.3,intM(0x2a2522),0,belt-.005,-.35); }
  // interior: low-slung seats with headrests, digital dash, single-spoke wheel, console
  const IM=intM(s.int), sx=W*.22, zs=zw-1.0;
  const rows=s.seats===4&&s.gh&&zs-.8>s.gh[0][0]+.1?[zs,zs-.8]:[zs];
  rows.forEach((z,r)=>[-1,1].forEach(sd=>{ const x=sd*sx;
    B(b,.44,.1,.44,IM,x,belt-.02,z); B(b,.44,.5,.1,IM,x,belt+.2,z-.25).rotation.x=-.22; B(b,.26,.14,.08,IM,x,belt+.52,z-.31).rotation.x=-.22; }));
  B(b,.16,.1,.8,CM.dash,0,belt+.01,zs+.15);
  B(b,W*.76,.12,.28,CM.dash,0,belt+.06,zw-.32);
  const gp=new THREE.Mesh(PLANE,CTM.dash()); gp.scale.set(.34,.085,1); gp.position.set(sx,belt+.15,zw-.47); gp.rotation.set(-.3,Math.PI,0); b.add(gp);
  const sw=new THREE.Mesh(geo('csw',()=>new THREE.TorusGeometry(.15,.016,8,24)),CM.dash); sw.position.set(sx,belt+.2,zw-.62); sw.rotation.x=-.45; b.add(sw);
  B(sw,.016,.15,.016,CM.dash,0,-.075,0);
  // panel seams, flush door handles, hood shut line, fuel flap
  const inArch=z=>Math.abs(z-zf)<a||Math.abs(z-zr)<a;
  [-1,1].forEach(sd=>{ s.seams.forEach((z,i)=>{ const y0=inArch(z)?R+a+.03:s.clY+.02, y1=belt-.03, x=sd*(halfAt(z)+.002);
      if(y1>y0) B(b,.008,y1-y0,.01,M.seam,x,(y0+y1)/2,z); if(i===1) B(b,.012,.025,.14,CM.gloss,sd*(halfAt(z)+.004),belt-.1,z+.12); });
    if(sd<0) C(b,.06,.008,M.seam,-halfAt(zr)-.002,belt-.12,zr,'x',16); });
  (s.hood||[]).forEach(z=>B(b,2*halfAt(z)*.92,.006,.012,M.seam,0,topAt(z)+.001,z));
  // mirrors
  [-1,1].forEach(sd=>{ const x=sd*(halfAt(zw)+.07), my=belt+.1;
    B(b,.1,.025,.04,CM.gloss,sd*(halfAt(zw)+.02),my-.02,zw-.15);
    const h=new THREE.Mesh(geo('cmir',()=>new THREE.SphereGeometry(.07,14,8)),P); h.scale.set(1.3,.6,.7); h.position.set(x,my,zw-.16); b.add(h); });
  // lamps
  const ud={headlights:[hlM],taillights:[tlM],popups:[]}, hl=s.hl, tl=s.tl;
  if(hl.t==='popup'){ const slope=Math.atan2(topAt(hl.pz-.05)-topAt(hl.pz+.05),.1);
    [-1,1].forEach(sd=>{ const pod=new THREE.Group(), d=.3; pod.position.set(sd*hl.px,topAt(hl.pz)-.004,hl.pz); pod.rotation.x=slope; b.add(pod);
      B(pod,.46,.002,d+.02,CM.gloss,0,.006,d/2); B(pod,.44,.1,d,P,0,-.042,d/2); B(pod,.38,.055,.012,hlM,0,-.04,d+.004);
      ud.popups.push({obj:pod,closed:slope,open:slope-.8}); });
    const f=s.fog; [-1,1].forEach(sd=>lampBox(b,f.w,.05,hlM,sd*f.x,f.y,f.z,0)); }
  else if(hl.t==='split'){ [-1,1].forEach(sd=>lampBox(b,hl.w,hl.h,hlM,sd*hl.x,hl.y,hl.z,hl.tilt)); B(b,2*hl.x-hl.w-.06,hl.h*.7,.02,CTM.vent(),0,hl.y,hl.z-.005).rotation.x=hl.tilt; }
  else lampBox(b,hl.w,hl.h,hlM,0,hl.y,hl.z,hl.tilt);
  if(tl.t==='pillars') [-1,1].forEach(sd=>lampBox(b,tl.w,tl.h,tlM,sd*tl.x,tl.y,tl.z,0,1));
  else lampBox(b,tl.w,tl.h,tlM,0,tl.y,tl.z,tl.tilt,1);
  // wheels with aero covers; rear skirts on the teardrop
  const wheels=[], wx=W/2-tw/2-.01;
  [zr,zf].forEach(z=>[-1,1].forEach(sd=>wheels.push(cwheel(b,R,tw,sd*wx*tap(z),z,s.cover,s.cc))));
  if(s.skirt) [-1,1].forEach(sd=>{ const m=new THREE.Mesh(geo('skirt'+kind,()=>{ const q=new THREE.Shape(); q.moveTo(zr-a,yb); q.lineTo(zr+a,yb); q.lineTo(zr+a,R);
      q.absarc(zr,R,a,0,Math.PI,false); q.closePath(); return extG(q,.04,.012).translate(0,0,0); }),P); m.position.x=sd*(W/2-.012); b.add(m); });
  if(s.flares) [zr,zf].forEach(z=>[-1,1].forEach(sd=>{ const f=new THREE.Mesh(geo('flare',()=>new THREE.TorusGeometry(a+.02,.05,6,18,Math.PI)),CL);
    f.rotation.y=Math.PI/2; f.scale.z=1.6; f.position.set(sd*(W/2+.01),R,z); b.add(f); }));
  // rear diffuser + exhaust point (for particles)
  for(let i=-2;i<=2;i++) B(b,.012,.08,.22,CM.gloss,i*.22,yb+.02,-F-.02);
  const exO=new THREE.Object3D(); exO.position.set(-W*.28,yb+.08,-F-.15); b.add(exO);
  // side stripe graphics
  if(s.stripe){ const [y,z0,z1,h]=s.stripe; [-1,1].forEach(sd=>{ const d=new THREE.Mesh(PLANE,CTM.stripe()); d.scale.set(z1-z0,h,1);
    d.position.set(sd*(W/2+.004),y,(z0+z1)/2); d.rotation.y=sd*Math.PI/2; b.add(d); }); }
  if(s.ex) s.ex(b,{W,F,L,s,topAt,P});
  b.traverse(o=>{ if(o.isMesh&&o.material!==CM.glass){ o.castShadow=true; o.receiveShadow=true; } });
  ud.setPopups=t=>ud.popups.forEach(q=>q.obj.rotation.x=q.closed+(q.open-q.closed)*t);
  return Object.assign(ud,{g,exO,wheels,name:s.name,len:L+.1,wid:W});
}

/* =====================================================================
   PUBLIC API
   ===================================================================== */
const KINDS = Object.keys(CSPEC), RETRO_KINDS = Object.keys(SPEC);
const RETRO_K = 1/S*.9;   // retro models are built at lot scale S; bring them to ~real metres
function applyEnv(root,env){ if(!env) return; root.traverse(o=>{ if(!o.isMesh) return; (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
  if(m && m.isMeshStandardMaterial && m.envMap!==env){ m.envMap=env; m.needsUpdate=true; } }); }); }
function build(kind,opts){
  opts=opts||{}; const style=opts.style==='retro'?'retro':'concept', G=new THREE.Group();
  let ud;
  if(style==='retro'){
    const rk=SPEC[kind]?kind:RETRO_KINDS[Math.max(0,KINDS.indexOf(kind))%RETRO_KINDS.length];
    const c=buildCar(rk,opts.color!=null?{color:opts.color,holo:null}:null);
    c.g.scale.setScalar(RETRO_K); G.add(c.g);
    ud={headlights:[c.hlM],taillights:[c.tlM],reverse:[c.rvM],beams:c.beams,beamMaterial:c.beamM,exhaust:c.exO,wheels:c.wheels,
      length:c.len*RETRO_K,width:SPEC[rk].W*S*KX*RETRO_K,kind:rk,name:c.name,style,popups:[],setPopups(){}};
  } else {
    const k=CSPEC[kind]?kind:KINDS[Math.max(0,RETRO_KINDS.indexOf(kind))%KINDS.length], c=buildConcept(k,opts.color);
    G.add(c.g);
    ud={headlights:c.headlights,taillights:c.taillights,exhaust:c.exO,wheels:c.wheels,length:c.len,width:c.wid,kind:k,name:c.name,style,
      popups:c.popups,setPopups:c.setPopups};
  }
  G.userData=ud; G.name=ud.name;
  applyEnv(G,opts.envMap);
  return G;
}
window.SolarpunkCars = { KINDS, RETRO_KINDS, PALETTE:CP, build };
})();
