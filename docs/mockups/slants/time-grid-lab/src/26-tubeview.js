<script>
/* ===== Tube view: draws the particles, owns the animation loop and the pointer handling ===== */
const SIMS=new Map();
const hex2=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
class TubeView{
  constructor(spec){
    this.spec=spec;const ca=spec.mat==='sand'&&spec.d<2.6&&!spec.timeline&&!spec.zg;this.ph=ca?new SandCA(spec):new TubePhysics(spec);if(this.ph.tl&&S.hg.clock>0)this.ph.clock=S.hg.clock;
    const sc=spec.tw>50?2:1.5;this.sc=sc;this.cw=ca?this.ph.gw:Math.ceil(spec.tw*sc);this.ch=ca?this.ph.gh:Math.ceil(spec.H*sc);
    const c=document.createElement('canvas');c.width=this.cw;c.height=this.ch;
    c.style.cssText='position:absolute;inset:0;width:100%;height:100%';
    this.canvas=c;this.ctx=c.getContext('2d');this.rgb=spec.layers.map(l=>hex2(l.c));
    if(ca){this.pal=spec.layers.map(l=>{const b=hex2(l.c);return Array.from({length:8},(_,k)=>{const t=(k-3.5)/3.5*.16;return b.map(x=>Math.max(0,Math.min(255,x+(t>0?(255-x)*t:x*t))))})});this.img=this.ctx.createImageData(this.cw,this.ch)}
    else if(spec.mat==='sand'){this.vars=spec.layers.map(l=>[-.1,-.05,0,.06,.11].map(t=>{const b=hex2(l.c).map(v=>Math.max(0,Math.min(255,v+(t>0?(255-v)*t:v*t))));return `rgb(${b.map(Math.round)})`}))}
    else{const n=this.cw*this.ch;this.A=new Float32Array(n);this.R=new Float32Array(n);this.G=new Float32Array(n);this.B=new Float32Array(n);this.img=this.ctx.createImageData(this.cw,this.ch)}
    if(this.ph.tl&&this.ph.clock>0){for(let i=0;i<900&&this.ph.n<this.ph.N&&this.ph.mins[this.ph.spawnK]<=this.ph.clock;i++)this.ph.frame(1/60);for(let i=0;i<120;i++)this.ph.frame(1/60)}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.ph.fast=true;for(let i=0;i<300&&!this.ph.asleep;i++)this.ph.frame(1/60)}
  }
  applyBody(){if(this.body)this.body.style.transform=`translateY(${this.ph.ty.toFixed(2)}px) rotate(${this.ph.th.toFixed(4)}rad)`}
  render(){const v2=this.spec.ver==='v2';this.ph.ca?this.renderCA(v2):this.spec.mat==='sand'?this.renderSand(v2):v2?this.renderLiquid2():this.renderLiquid()}
  renderCA(v2){
    const ph=this.ph,d=this.img.data,n=ph.gw*ph.gh,pal=this.pal,t=performance.now()/1000;
    for(let k=0;k<n;k++){const c=ph.cell[k],o=k*4;if(!c){d[o+3]=0;continue}const p=pal[c-1][ph.vr[k]];
      if(v2){const dp=ph.depth?ph.depth[k]:0,f=1-Math.min(.38,dp*.012),sp=(ph.vr[k]===7&&((k*2654435761>>>0)%97+Math.floor(t*3))%11===0)?70:0;d[o]=p[0]*f+sp;d[o+1]=p[1]*f+sp;d[o+2]=p[2]*f+sp;d[o+3]=255}
      else{d[o]=p[0];d[o+1]=p[1];d[o+2]=p[2];d[o+3]=255}}
    this.ctx.putImageData(this.img,0,0);
  }
  renderSand(v2){
    const {ctx,ph,sc,vars}=this,n=ph.n;ctx.clearRect(0,0,this.cw,this.ch);const R=ph.pr*sc;
    if(v2&&ph.rad){this.renderSand2();return}
    ctx.fillStyle='rgba(20,12,6,.35)';ctx.beginPath();
    for(let i=0;i<n;i++){const x=ph.x[i]*sc,y=ph.y[i]*sc;ctx.moveTo(x+R*1.12,y);ctx.arc(x,y,R*1.12,0,6.2832)}
    if(ph.tl)for(let k=ph.spawnK;k<ph.N;k++){const x=ph.hx[k]*sc,y=ph.hy[k]*sc;ctx.moveTo(x+R*1.12,y);ctx.arc(x,y,R*1.12,0,6.2832)}ctx.fill();
    for(let l=0;l<vars.length;l++)for(let v=0;v<5;v++){
      ctx.fillStyle=vars[l][v];ctx.beginPath();let any=false;
      for(let i=0;i<n;i++)if(ph.layer[i]===l&&ph.var[i]===v){const x=ph.x[i]*sc,y=ph.y[i]*sc;ctx.moveTo(x+R*.92,y);ctx.arc(x,y,R*.92,0,6.2832);any=true}
      if(ph.tl)for(let k=ph.spawnK;k<ph.N;k++)if(ph.queue[k]===l&&k%5===v){const x=ph.hx[k]*sc,y=ph.hy[k]*sc;ctx.moveTo(x+R*.92,y);ctx.arc(x,y,R*.92,0,6.2832);any=true}
      if(any)ctx.fill();
    }
  }
  /* v2 sand: grains of different sizes, a lit top-left edge, darker bulk, and sparkle on the grains that tumble */
  renderSand2(){
    const {ctx,ph,sc,vars}=this,n=ph.n,t=performance.now()/1000;
    ctx.fillStyle='rgba(18,10,4,.38)';ctx.beginPath();
    for(let i=0;i<n;i++){const x=ph.x[i]*sc,y=ph.y[i]*sc,r=ph.rad[i]*sc*1.12;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,6.2832)}
    if(ph.tl)for(let k=ph.spawnK;k<ph.N;k++){const x=ph.hx[k]*sc,y=ph.hy[k]*sc,r=ph.pr*sc*1.12;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,6.2832)}ctx.fill();
    for(let l=0;l<vars.length;l++)for(let v=0;v<5;v++){
      ctx.fillStyle=vars[l][v];ctx.beginPath();let any=false;
      for(let i=0;i<n;i++)if(ph.layer[i]===l&&ph.var[i]===v){const x=ph.x[i]*sc,y=ph.y[i]*sc,r=ph.rad[i]*sc*.94;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,6.2832);any=true}
      if(ph.tl)for(let k=ph.spawnK;k<ph.N;k++)if(ph.queue[k]===l&&k%5===v){const x=ph.hx[k]*sc,y=ph.hy[k]*sc,r=ph.pr*sc*.94;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,6.2832);any=true}
      if(any)ctx.fill();
    }
    ctx.fillStyle='rgba(0,0,0,.14)';ctx.beginPath();let dk=false;
    for(let i=0;i<n;i++)if(ph.nc[i]>=10){const x=ph.x[i]*sc,y=ph.y[i]*sc,r=ph.rad[i]*sc*.94;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,6.2832);dk=true}
    if(dk)ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.beginPath();
    for(let i=0;i<n;i++){const x=ph.x[i]*sc,y=ph.y[i]*sc,r=ph.rad[i]*sc;ctx.moveTo(x-.28*r+.5*r,y-.28*r);ctx.arc(x-.28*r,y-.28*r,r*.5,0,6.2832)}ctx.fill();
    ctx.beginPath();let sp=false;
    for(let i=0;i<n;i++)if(ph.sh[i]>.9){const s=Math.pow(Math.max(0,Math.cos(ph.ang[i]*1.3+ph.sh[i]*40-.8+t*.4)),14);if(s>.12){const x=ph.x[i]*sc,y=ph.y[i]*sc,r=ph.rad[i]*sc;ctx.moveTo(x-.3*r+.3*r,y-.3*r);ctx.arc(x-.3*r,y-.3*r,r*.3,0,6.2832);sp=true}}
    if(sp){ctx.fillStyle='rgba(255,255,255,.85)';ctx.fill()}
  }
  /* v2 liquid: colours come from each particle's diffusing colour field; thickness darkens and saturates, a specular glint follows the thickness gradient */
  renderLiquid2(){
    const {ph,sc,cw,ch,A,R,G,B,img}=this,n=ph.n;A.fill(0);R.fill(0);G.fill(0);B.fill(0);
    const rk=2.8*ph.d*sc,rk2=rk*rk,pc=ph.pcol;
    /* neon: the picked ink colour glows wherever it currently is */
    let tg=null;if(S.ink){const c0=(PAL[this.spec.view||S.view]||{})[S.ink],L=c0&&this.spec.layers.find(l=>l.n===c0[0]);if(L)tg=[parseInt(L.c.slice(1,3),16),parseInt(L.c.slice(3,5),16),parseInt(L.c.slice(5,7),16)]}
    const GL=tg?(this.GL||(this.GL=new Float32Array(cw*ch))):null;if(GL)GL.fill(0);
    for(let i=0;i<n;i++){
      const cx=ph.x[i]*sc,cy=ph.y[i]*sc,r0=pc[i*3],g0=pc[i*3+1],b0=pc[i*3+2];let gi=0;if(tg){const dr=r0-tg[0],dg=g0-tg[1],db=b0-tg[2];gi=Math.max(0,1-Math.sqrt(dr*dr+dg*dg+db*db)/70)}
      const x0=Math.max(0,Math.floor(cx-rk)),x1=Math.min(cw-1,Math.ceil(cx+rk)),y0=Math.max(0,Math.floor(cy-rk)),y1=Math.min(ch-1,Math.ceil(cy+rk));
      for(let yy=y0;yy<=y1;yy++){const dy=yy+.5-cy;for(let xx=x0;xx<=x1;xx++){const dx=xx+.5-cx,q=(dx*dx+dy*dy)/rk2;if(q<1){const w=(1-q)*(1-q),k=yy*cw+xx;A[k]+=w;R[k]+=w*r0;G[k]+=w*g0;B[k]+=w*b0;if(gi)GL[k]+=w*gi}}}
    }
    let HB=null;if(GL){const hb=Math.max(3,Math.round(3.2*ph.d*sc)),T1=this.GT||(this.GT=new Float32Array(cw*ch));HB=this.GH||(this.GH=new Float32Array(cw*ch));
      for(let y=0;y<ch;y++){let q=0;const o=y*cw;for(let x=-hb;x<=hb;x++)if(x>=0&&x<cw)q+=GL[o+x];for(let x=0;x<cw;x++){T1[o+x]=q;const a=x+hb+1,b=x-hb;if(a<cw)q+=GL[o+a];if(b>=0)q-=GL[o+b]}}
      for(let x=0;x<cw;x++){let q=0;for(let y=-hb;y<=hb;y++)if(y>=0&&y<ch)q+=T1[y*cw+x];for(let y=0;y<ch;y++){HB[y*cw+x]=q/((2*hb+1)*(2*hb+1));const a=y+hb+1,b=y-hb;if(a<ch)q+=T1[a*cw+x];if(b>=0)q-=T1[b*cw+x]}}}
    let nr=0,ng=0,nb=0;if(tg){const m3=(tg[0]+tg[1]+tg[2])/3,sat=c=>Math.max(0,m3+(c-m3)*2.6),a0=sat(tg[0]),a1=sat(tg[1]),a2=sat(tg[2]),mx=Math.max(a0,a1,a2,1);nr=a0*255/mx;ng=a1*255/mx;nb=a2*255/mx}
    /* shade from a blurred copy of the density so single particles do not make blotches */
    const A2=this.A2||(this.A2=new Float32Array(cw*ch)),A3=this.A3||(this.A3=new Float32Array(cw*ch)),br=Math.max(2,Math.round(1.4*ph.d*sc));
    for(let y=0;y<ch;y++){let s=0;const o=y*cw;for(let x=-br;x<=br;x++)if(x>=0&&x<cw)s+=A[o+x];for(let x=0;x<cw;x++){A3[o+x]=s;const a=x+br+1,b=x-br;if(a<cw)s+=A[o+a];if(b>=0)s-=A[o+b]}}
    for(let x=0;x<cw;x++){let s=0;for(let y=-br;y<=br;y++)if(y>=0&&y<ch)s+=A3[y*cw+x];for(let y=0;y<ch;y++){A2[y*cw+x]=s/((2*br+1)*(2*br+1));const a=y+br+1,b=y-br;if(a<ch)s+=A3[a*cw+x];if(b>=0)s-=A3[b*cw+x]}}
    const d=img.data,Hx=-.28,Hy=-.48,Hz=.83;
    for(let k=0,m=cw*ch;k<m;k++){
      const a=A[k],o=k*4,hl=HB?Math.min(1,HB[k]*.8):0;if(a<1.8){if(hl>.02){d[o]=nr;d[o+1]=ng;d[o+2]=nb;d[o+3]=hl*210}else d[o+3]=0;continue}
      let t=(a-1.8)/.8;t=t>1?1:t;t=t*t*(3-2*t);const inv=1/a;let r=R[k]*inv,g=G[k]*inv,b=B[k]*inv;
      const thick=Math.exp(-.07*Math.max(0,A2[k]-2.2)),sh=.78+.22*thick;r*=sh;g*=sh;b*=sh;
      const gx=k>3&&k<m-4?A2[k+3]-A2[k-3]:0,gy=k>3*cw&&k<m-3*cw?A2[k+3*cw]-A2[k-3*cw]:0,nx=-gx*.9,ny=-gy*.9,nl=Math.sqrt(nx*nx+ny*ny+1),dt=(nx*Hx+ny*Hy+Hz)/nl,sp=dt>0?Math.pow(dt,22)*.1:0;
      const e=a<4.2?(1-(a-1.8)/2.4)*.1:0;r+=(255-r)*(e+sp);g+=(255-g)*(e+sp);b+=(255-b)*(e+sp);
      if(GL){const gl=Math.min(1,GL[k]*inv*1.1);r+=(nr-r)*gl*.92;g+=(ng-g)*gl*.92;b+=(nb-b)*gl*.92;const wc=gl*.38;r+=(255-r)*wc;g+=(255-g)*wc;b+=(255-b)*wc;
        const al=Math.min(255,205*t+hl*90*gl);d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=Math.max(al,hl*190);continue}
      d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=205*t;
    }
    this.ctx.putImageData(img,0,0);
  }
  renderLiquid(){
    const {ph,sc,cw,ch,A,R,G,B,img,rgb}=this,n=ph.n;A.fill(0);R.fill(0);G.fill(0);B.fill(0);
    const rk=2.3*ph.d*sc,rk2=rk*rk;
    for(let i=0;i<n;i++){
      const cx=ph.x[i]*sc,cy=ph.y[i]*sc,col=rgb[ph.layer[i]];
      const x0=Math.max(0,Math.floor(cx-rk)),x1=Math.min(cw-1,Math.ceil(cx+rk)),y0=Math.max(0,Math.floor(cy-rk)),y1=Math.min(ch-1,Math.ceil(cy+rk));
      for(let yy=y0;yy<=y1;yy++){const dy=yy+.5-cy;for(let xx=x0;xx<=x1;xx++){const dx=xx+.5-cx,q=(dx*dx+dy*dy)/rk2;if(q<1){const w=(1-q)*(1-q),k=yy*cw+xx;A[k]+=w;R[k]+=w*col[0];G[k]+=w*col[1];B[k]+=w*col[2]}}}
    }
    const d=img.data;
    for(let k=0,m=cw*ch;k<m;k++){
      const a=A[k],o=k*4;
      if(a<1.8){d[o+3]=0;continue}
      let t=(a-1.8)/.8;t=t>1?1:t;t=t*t*(3-2*t);const inv=1/a;let r=R[k]*inv,g=G[k]*inv,b=B[k]*inv;
      const e=a<4.2?(1-(a-1.8)/2.4)*.4:0;r+=(255-r)*e;g+=(255-g)*e;b+=(255-b)*e;
      d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=235*t;
    }
    this.ctx.putImageData(img,0,0);
  }
}
function mountTubes(){
  document.querySelectorAll('canvas[data-sim]').forEach(c=>{
    const key=c.dataset.sim;let v=SIMS.get(key);
    if(!v){v=new TubeView(JSON.parse(key));SIMS.set(key,v)}
    const box=c.closest('.tb3d');v.body=c.closest('.tubebody');if(box){(box._sims=box._sims||[]).push(v);box._sim=v}
    v.canvas.style.clipPath=c.style.clipPath;c.replaceWith(v.canvas);v.applyBody();v.render();
  });
  if(SIMS.size>20)for(const[k,v]of SIMS){if(SIMS.size<=14)break;if(!v.canvas.isConnected)SIMS.delete(k)}
}
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.grain!==undefined){const o=t.parentElement.querySelector('.gv');if(o)o.textContent=(+t.value).toFixed(1)+' px'}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.grain!==undefined){S.grain=+t.value;renderAll()}if(t.dataset&&t.dataset.mix!==undefined){S.mix=+t.value;renderAll()}});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.mix!==undefined){const o=t.parentElement.querySelector('.mv');if(o)o.textContent=(+t.value)+'%'}});
new MutationObserver(mountTubes).observe(document.body,{childList:true,subtree:true});
(function(){
  let last=0,acc=0;
  const loop=ts=>{
    acc+=Math.min(50,ts-last);last=ts;let steps=0;
    while(acc>=16.67&&steps<2){acc-=16.67;steps++;
      const tls=[];SIMS.forEach(v=>{if(v.ph.tl&&v.canvas.isConnected)tls.push(v)});
      if(tls.length&&S.hg.playing){   /* one clock for every hourglass; it waits while any of them still has a grain due */
        const T=tls[0].ph.T;
        if(S.hg.clock<T&&!tls.some(v=>v.ph.spawnK<v.ph.N&&v.ph.mins[v.ph.spawnK]<=S.hg.clock))S.hg.clock=Math.min(T,S.hg.clock+S.hg.speed*(T/1440)/60);
        const m=Math.floor(Math.min(T-1,S.hg.clock));
        if(m!==S.hg._lm){S.hg._lm=m;const el=document.getElementById('hgclock');if(el){const big=el.firstElementChild&&el.querySelector('svg')?+el.querySelector('svg').getAttribute('height')>40:true;el.innerHTML=seg7(hhmm(m%1440),big?{w:26,h:44,gap:9,sw:4,on:'#0b5a4a',off:'#0b5a4a18'}:{w:18,h:32,gap:7,sw:3,on:'#0b5a4a',off:'#0b5a4a18'})}
          const dl=document.getElementById('hgday');if(dl&&T>1440)dl.textContent=clockLabel(T,m).replace(/ \d\d:\d\d$/,'');
          const hp=document.getElementById('hgph');if(hp)hp.style.left=(m/T*hp.parentElement.clientWidth).toFixed(1)+'px';const sc=document.getElementById('hgscrub');if(sc&&document.activeElement!==sc)sc.value=m}
      }
      SIMS.forEach(v=>{const ph=v.ph;if(!v.canvas.isConnected)return;
        if(ph.tl){if(!S.hg.playing)return;ph.clock=S.hg.clock;if(S.hg.clock<ph.T||ph.spawnK<ph.N){ph.asleep=false;ph.rest=0}}
        if(!ph.asleep)ph.frame(1/60)})}
    if(steps)SIMS.forEach(v=>{if(v.canvas.isConnected&&(!v.ph.asleep||v.settling)){v.render();v.applyBody();v.settling=!v.ph.asleep}});
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  /* pointer: hover turns the tube about its axis, drag tilts and shakes it, tap nudges it */
  let drag=null;const cl=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));
  /* the tilt and the light strip ease toward a target each frame, so leaving the tube or a fast flick never snaps */
  const DEF={rx:0,hx:36,si:.9,rs:1},TG=new Set();let tgRun=0;
  const tgStep=()=>{TG.forEach(t=>{if(!t.isConnected){TG.delete(t);return}const c=t._cu,g=t._tg;let m=0;for(const k in DEF){const d=g[k]-c[k];c[k]+=d*.14;m=Math.max(m,Math.abs(d))}
    if(m<.02)Object.assign(c,g);t.style.transform=c.rx?`rotateX(${c.rx.toFixed(2)}deg)`:'none';t.style.setProperty('--hx',c.hx.toFixed(1)+'%');t.style.setProperty('--si',c.si.toFixed(3));t.style.setProperty('--rs',c.rs.toFixed(3));if(m<.02)TG.delete(t)});
    TG.size?requestAnimationFrame(tgStep):tgRun=0};
  const aim=(t,g)=>{t._cu=t._cu||{...DEF};t._tg=g;TG.add(t);if(!tgRun){tgRun=1;requestAnimationFrame(tgStep)}};
  const reset=t=>aim(t,DEF);
  document.addEventListener('pointermove',e=>{
    const t=drag?drag.t:(e.target.closest&&e.target.closest('.tb3d'));if(!t)return;
    const b=t.getBoundingClientRect(),nx=cl(((e.clientX-b.left)/b.width-.5)*2,-1,1),ny=cl(((e.clientY-b.top)/b.height-.5)*2,-1,1);
    /* the light catches a different strip of the glass as you move; looking from above opens the rim */
    aim(t,{rx:-ny*8,hx:50+nx*32,si:1-Math.abs(nx)*.35,rs:1+ny*.9});
    if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));(t._sims||[]).forEach(v=>{v.ph.tth=cl(dx/70,-9.4,9.4);v.ph.tty=cl(dy*.3,-16,16);v.ph.wake();v.settling=true})}
  });
  document.addEventListener('pointerdown',e=>{const t=e.target.closest&&e.target.closest('.tb3d');if(!t)return;drag={t,x:e.clientX,y:e.clientY,moved:0};t.style.cursor='grabbing';
    const col=t.closest('div[style*="position:absolute"]');if(col)col.style.zIndex=30;try{t.setPointerCapture(e.pointerId)}catch(_){}});
  const up=e=>{if(!drag)return;const t=drag.t,v=t._sim,mv=drag.moved;t.style.cursor='grab';
    if(v){const T=2*Math.PI,kick=(Math.random()<.5?-1:1)*(3+Math.random()*2);
      if(mv<5&&S.tool==='point'&&e&&e.clientX!==undefined)inspect(t,e);
      (t._sims||[]).forEach(s=>{s.ph.th=((s.ph.th+Math.PI)%T+T)%T-Math.PI;s.ph.tth=0;s.ph.tty=0;if(mv<5&&S.tool!=='point'){s.ph.w+=kick;s.ph.vyf-=40}s.ph.wake();s.settling=true})}drag=null};
  document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
  document.addEventListener('pointerout',e=>{const t=e.target.closest&&e.target.closest('.tb3d');if(t&&!drag&&!t.contains(e.relatedTarget)){reset(t);const col=t.closest('div[style*="position:absolute"]');if(col)col.style.zIndex=''}});
})();

/* ===== ink: make one colour denser (or lighter) and let diffusion and gravity spread it ===== */
function inkApply(pen,delta){
  const P=PAL[S.view]||{},c0=P[pen];if(!c0)return;let any=false;
  SIMS.forEach(v=>{const ph=v.ph;if(!v.canvas.isConnected||v.spec.mat!=='liquid'||v.spec.ver!=='v2'||!ph.pcol)return;
    const L=v.spec.layers.find(l=>l.n===c0[0]);if(!L)return;const t=[parseInt(L.c.slice(1,3),16),parseInt(L.c.slice(3,5),16),parseInt(L.c.slice(5,7),16)];
    const ph0=Math.random()*6.28;for(let i=0;i<ph.n;i++){const dr=ph.pcol[i*3]-t[0],dg=ph.pcol[i*3+1]-t[1],db=ph.pcol[i*3+2]-t[2],w=Math.max(0,1-Math.sqrt(dr*dr+dg*dg+db*db)/45);
      if(w>0){ph.hv[i]=Math.max(-2.2,Math.min(7,ph.hv[i]+delta*w));ph.vy[i]+=delta*w*0+Math.sin(ph.x[i]/ph.tw*9.4+ph0)*22*w;ph.vx[i]+=(Math.random()-.5)*6;any=true}}
    ph.inkK=22;ph.wake();v.settling=true});
  return any;
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ink]');if(!b)return;
  const P=PAL[S.view]||{},k=S.ink&&P[S.ink]?S.ink:Object.keys(P)[0];
  if(!inkApply(k,b.dataset.ink==='dense'?5:-2.2)&&typeof toast==='function')toast('No liquid with that colour yet. Pick a colour that is in a tube.')});
/* ===== reset, day replay controls ===== */
function resetTubes(){SIMS.clear();if(typeof S!=='undefined'){S.hg.playing=true;S.hg.clock=S.hg.start||0}}
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.hgspeed!==undefined){S.hg.speed=[10,30,60,120][+t.value];const o=document.getElementById('hgsv');if(o)o.textContent=Math.round(1440/S.hg.speed)+' s per period'}if(t.dataset&&t.dataset.hgscrub!==undefined){const hp=document.getElementById('hgph');if(hp)hp.style.left=(+t.value/(+t.max+1)*hp.parentElement.clientWidth).toFixed(1)+'px'}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.hgscrub!==undefined){S.hg.start=+t.value;resetTubes();renderAll()}});
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-hg]');if(!t)return;
  const[k,v]=t.dataset.hg.split(':');
  if(k==='play')S.hg.playing=!S.hg.playing;else if(k==='restart'){S.hg.start=0;resetTubes()}
  if(typeof renderAll==='function')renderAll();
});
/* ===== pointer mode: click a grain for its time block, click a liquid to take a sample ===== */
const reduceMo=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function stageScale(t){if(t.closest('#fs'))return 1;const w=t.closest('.stagewrap');return w?w.clientWidth/1040:1}
function localPt(v,cx,cy,t){const b=v.body.getBoundingClientRect(),sc=stageScale(t),th=v.ph.th,dx=(cx-b.left-b.width/2)/sc,dy=(cy-b.top-b.height/2)/sc,c=Math.cos(th),s=Math.sin(th);return[dx*c+dy*s+v.spec.tw/2,-dx*s+dy*c+v.spec.H/2]}
function floatCard(id,html,x,y){
  let c=document.getElementById(id);if(!c){c=document.createElement('div');c.id=id;c.style.cssText='position:fixed;z-index:90;background:#f5f7f9;color:#17202a;border:1px solid #8794a2;box-shadow:0 10px 30px #0006;padding:14px 18px 16px 16px;font:500 12.5px/1.5 var(--sans),Archivo,system-ui,sans-serif;width:250px;box-sizing:border-box;max-height:calc(100vh - 16px);overflow:auto;overflow-wrap:anywhere;border-radius:3px';document.body.appendChild(c)}
  c.innerHTML=html+'<button data-close="'+id+'" style="position:absolute;right:6px;top:4px;border:0;background:none;font:600 14px monospace;cursor:pointer;color:#17202a" aria-label="Close">×</button>';
  c.style.left=Math.max(8,Math.min(x,innerWidth-266))+'px';c.style.top=Math.max(8,Math.min(y,innerHeight-c.offsetHeight-8))+'px';return c;
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-close]');if(b){const c=document.getElementById(b.dataset.close);if(c)c.remove()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')['blk','slide'].forEach(i=>{const c=document.getElementById(i);if(c)c.remove()})});
function inspect(t,e){const v=t._sim;if(!v||!v.spec||!v.body)return;const[lx,ly]=localPt(v,e.clientX,e.clientY,t);v.spec.mat==='sand'?inspectGrain(v,lx,ly,e):pipette(v,lx,ly,e,t)}
function inspectGrain(v,lx,ly,e){
  const ph=v.ph,sp=v.spec;let layer=-1,minute=-1,count=0;
  if(ph.ca){const gx=Math.floor(lx/ph.c),gy=Math.floor(ly/ph.c);let found=false;
    for(let r=0;r<=3&&!found;r++)for(let oy=-r;oy<=r&&!found;oy++)for(let ox=-r;ox<=r&&!found;ox++){const x=gx+ox,y=gy+oy;if(x<0||y<0||x>=ph.gw||y>=ph.gh)continue;const c=ph.cell[y*ph.gw+x];if(!c)continue;found=true;layer=c-1;
      const bl=sp.layers[layer].blocks||[],tot=bl.reduce((a,q)=>a+q.e-q.s,0);let u=((x*73856093^y*19349663)>>>0)%Math.max(1,tot);for(const q of bl){const w=q.e-q.s;if(u<w){minute=q.s+u;break}u-=w}}
    if(layer>=0)for(let k=0;k<ph.cell.length;k++)if(ph.cell[k]===layer+1)count++;
  }else{let best=-1,bd=1e9;for(let i=0;i<ph.n;i++){const d=Math.hypot(ph.x[i]-lx,ph.y[i]-ly);if(d<bd){bd=d;best=i}}
    if(best>=0&&bd<ph.d*1.4){layer=ph.layer[best];minute=ph.minute[best];for(let i=0;i<ph.n;i++)if(ph.layer[i]===layer)count++}
    if(ph.tl)for(let k=ph.spawnK;k<ph.N;k++){const d=Math.hypot(ph.hx[k]-lx,ph.hy[k]-ly);if(d<bd&&d<ph.d*1.4){bd=d;layer=ph.queue[k];minute=ph.mins[k];count=0;for(let q=0;q<ph.N;q++)if(ph.queue[q]===layer)count++}}}
  if(layer<0){floatCard('blk','<b>No grain there.</b><br>Click on the sand.',e.clientX+14,e.clientY+10);return}
  const L=sp.layers[layer],bl=(L.blocks||[]).find(q=>q.a!==undefined?minute>=q.a&&minute<q.a+q.e-q.s:minute>=q.s&&minute<q.e)||(L.blocks||[])[0]||{s:0,e:0},col=L.c;
  const exact=!!ph.tl,per=count?Math.round(L.m/count*10)/10:0;
  floatCard('blk',`<div style="display:flex;gap:8px;align-items:center"><i style="width:14px;height:14px;background:${col};border:1px solid #0006"></i><b style="font-size:14px">${esc(L.n)}</b></div>
    <div style="margin-top:6px"><span style="opacity:.65">Block</span> ${fmtT(bl.s)} – ${fmtT(bl.e)}</div><div><span style="opacity:.65">Length</span> ${fmtDur(bl.e-bl.s)}</div><div><span style="opacity:.65">View</span> ${esc(VNAME[S.view]||S.view)} · ${sp.day>=0?DAYS[sp.day][0]+', '+DAYS[sp.day][1]:esc(bl.dl||sp.lab||'')}</div>
    <div style="margin-top:6px;opacity:.8">${exact?`This grain is ${sp.timeline?clockLabel(sp.timeline.T,minute):fmtT(minute)}${sp.timeline&&sp.timeline.gm>1?' (one of about '+sp.timeline.gm+' minutes it stands for)':''}.`:`This grain stands for about ${per} min of ${esc(L.n)}, one of ${count} grains (${fmtDur(L.m)} in all).`}</div>`,e.clientX+14,e.clientY+10);
}
async function pipette(v,lx,ly,e,t){
  const ph=v.ph,sp=v.spec,rad=ph.d*4.2,cnt={};let n=0,sr=0,sg=0,sb=0;
  for(let i=0;i<ph.n;i++)if(Math.hypot(ph.x[i]-lx,ph.y[i]-ly)<=rad){const l=ph.layer[i];cnt[l]=(cnt[l]||0)+1;n++;const c=v.rgb[l];sr+=c[0];sg+=c[1];sb+=c[2]}
  if(!n){floatCard('blk','<b>No liquid there.</b><br>Click inside the liquid.',e.clientX+14,e.clientY+10);return}
  const mean=`rgb(${Math.round(sr/n)},${Math.round(sg/n)},${Math.round(sb/n)})`,rm=reduceMo(),tb=t.getBoundingClientRect();
  const sx=Math.min(innerWidth-270,tb.right+40),sy=Math.max(12,tb.top+30);
  const pip=document.createElement('div');pip.style.cssText=`position:fixed;z-index:95;left:${e.clientX-20}px;top:${e.clientY-310}px;width:40px;height:310px;pointer-events:none;filter:drop-shadow(3px 5px 4px #0005)`;
  const ticks=Array.from({length:14},(_,k)=>`<line x1="${k%5===0?19:21}" x2="25" y1="${96+k*13}" y2="${96+k*13}" stroke="#2a3a46" stroke-opacity=".7" stroke-width=".8"/>`).join('');
  pip.innerHTML='<div style="position:absolute;left:0;top:76px;width:40px;height:234px;clip-path:polygon(15px 0,25px 0,25px 210px,21.5px 232px,18.5px 232px,15px 210px)"><div class="pl" style="position:absolute;left:0;bottom:0;width:100%;height:0;background:linear-gradient(90deg,color-mix(in srgb,'+mean+' 70%,#000),'+mean+' 45%,color-mix(in srgb,'+mean+' 80%,#fff))"></div></div>'
   +'<svg viewBox="0 0 40 310" width="40" height="310" style="position:absolute;left:0;top:0;overflow:visible"><defs>'
   +'<radialGradient id="pbk" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#34353a"/><stop offset=".35" stop-color="#1b1c1f"/><stop offset=".8" stop-color="#0a0a0b"/><stop offset="1" stop-color="#000"/></radialGradient>'
   +'<linearGradient id="pcl" x1="0" x2="1"><stop offset="0" stop-color="#15151a"/><stop offset=".3" stop-color="#4a4b52"/><stop offset=".55" stop-color="#18181c"/><stop offset="1" stop-color="#050506"/></linearGradient>'
   +'<linearGradient id="pgl" x1="0" x2="1"><stop offset="0" stop-color="#bcd2dc" stop-opacity=".55"/><stop offset=".3" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#cfe1ea" stop-opacity=".12"/><stop offset="1" stop-color="#7f9aa8" stop-opacity=".5"/></linearGradient></defs>'
   /* black rubber bulb: a teardrop with a soft highlight and a rim of reflected light */
   +'<path d="M9 3H31Q35 3 35.5 8L37 38Q37 54 29 63L11 63Q3 54 3 38L4.5 8Q5 3 9 3Z" fill="url(#pbk)"/>'
   +'<path d="M8 10V40" stroke="#fff" stroke-opacity=".14" stroke-width="2" stroke-linecap="round"/>'
   /* collar: ribbed rubber ring, then a thin metal band */
   +'<rect x="10" y="64" width="20" height="12" rx="3" fill="url(#pcl)"/><path d="M12 67H28M12 70H28M12 73H28" stroke="#fff" stroke-opacity=".12"/><rect x="13" y="75" width="14" height="3" fill="#aab4bb"/>'
   /* glass tube with a tapered tip, a bright edge on the left, graduations on the right */
   +'<path d="M15 78H25V286L21.5 308H18.5L15 286Z" fill="url(#pgl)" stroke="#4d6a78" stroke-opacity=".85" stroke-width=".9"/>'
   +'<path d="M17 82V284" stroke="#fff" stroke-opacity=".85" stroke-width="1.4" stroke-linecap="round"/>'+ticks+'</svg>';
  document.body.appendChild(pip);
  /* the front wall of the glass, drawn over the pipette below the rim, so the tip reads as inside the tube */
  const bb=v.body.getBoundingClientRect(),veil=document.createElement('div');
  veil.style.cssText=`position:fixed;z-index:96;pointer-events:none;left:${bb.left}px;top:${bb.top}px;width:${bb.width}px;height:${bb.height}px;background:linear-gradient(90deg,rgba(25,60,75,.28),rgba(207,225,234,.2) 18%,rgba(255,255,255,.28) 36%,rgba(207,225,234,.16) 60%,rgba(25,60,75,.3));backdrop-filter:blur(.6px);border-top:1px solid #fff9`;
  document.body.appendChild(veil);
  const pl=pip.querySelector('.pl'),A=(el,kf,ms,o={})=>rm?Promise.resolve():el.animate(kf,{duration:ms,easing:'ease-in-out',fill:'forwards',...o}).finished;
  await A(pip,[{transform:'translateY(-150px)',opacity:0},{transform:'translateY(0)',opacity:1}],650);
  await A(pl,[{height:'0px'},{height:'92px'}],550);pl.style.height='92px';
  await A(pip,[{transform:'translateY(0)'},{transform:'translateY(-70px)'}],450);
  const dx=sx+75-e.clientX,dy=sy+40-(e.clientY-70);
  await A(pip,[{transform:'translateY(-70px)'},{transform:`translate(${dx}px,${dy}px)`}],900);
  /* the slide and the drop */
  const rows=Object.keys(cnt).map(l=>{const L=sp.layers[l],tot=ph.layer.slice(0,ph.n).reduce((a,x)=>a+(x==l?1:0),0);return{n:L.n,c:L.c,pct:cnt[l]/n*100,min:tot?cnt[l]/tot*L.m:0}}).sort((a,b)=>b.pct-a.pct);
  const card=floatCard('slide',`<div style="font-weight:600;margin-bottom:6px">Glass slide</div><div style="position:relative;height:84px;background:linear-gradient(135deg,#eaf3f7,#cfdfe7);border:1px solid #8aa0ad;overflow:hidden"><div class="dp" style="position:absolute;left:50%;top:50%;width:38px;height:38px;margin:-19px;border-radius:50%;background:${mean};opacity:.92;box-shadow:inset 0 0 8px #fff8"></div><div class="sc" style="position:absolute;top:0;bottom:0;width:3px;left:6px;background:#2c9a73;box-shadow:0 0 8px #2c9a73;display:none"></div></div><div class="rs" style="margin-top:8px">Waiting for the drop…</div>`,sx,sy);
  const dp=card.querySelector('.dp'),sc=card.querySelector('.sc'),rs=card.querySelector('.rs');
  await Promise.all([A(dp,[{transform:'scale(0)'},{transform:'scale(1)'}],450),A(pl,[{height:'92px'},{height:'0px'}],450),A(pip,[{opacity:1},{opacity:0}],450)]);pip.remove();veil.remove();
  rs.textContent='Analysing…';sc.style.display='block';await A(sc,[{left:'6px'},{left:'calc(100% - 9px)'}],1500);sc.style.display='none';
  const bars=rows.map(r=>`<div style="margin:3px 0"><div style="display:flex;justify-content:space-between"><span><i style="display:inline-block;width:10px;height:10px;background:${r.c};border:1px solid #0006;margin-right:6px"></i>${esc(r.n)}</span><b style="font-variant-numeric:tabular-nums">${r.pct.toFixed(0)}%</b></div><div style="height:5px;background:#dbe3e8"><div style="height:5px;width:${r.pct}%;background:${r.c}"></div></div><div style="opacity:.6;font-size:11px">about ${r.min.toFixed(1)} min of this pen in the sample</div></div>`).join('');
  rs.innerHTML=`<div style="padding-right:4px"><div style="opacity:.65;margin-bottom:4px">Pens detected, ${n} parcels</div>${bars}</div>`;
}
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.wipe!==undefined){S.wipe=+t.value;document.querySelectorAll('.tb3d').forEach(b=>b.style.setProperty('--wipe',S.wipe+'%'))}});
</script>
