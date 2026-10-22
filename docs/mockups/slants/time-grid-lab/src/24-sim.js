<script>
/* ===== Tube physics =====
   A 2D side view of a test tube, simulated in the tube's own frame.
   Liquid: position based fluids (Macklin and Mueller 2013). Each particle i has density
     rho_i = sum_j W(|p_i - p_j|, h)         (poly6 kernel)
   and a constraint C_i = rho_i / rho0 - 1 = 0. Positions move along grad C with
     lambda_i = -C_i / (sum_k |grad_k C_i|^2 + eps),  dp_i = (1/rho0) sum_j (lambda_i + lambda_j + s_corr) grad W_ij
   (spiky gradient), then XSPH viscosity v_i += c sum_j (v_j - v_i) W_ij.
   Sand: hard disks pushed apart by position projection, with Coulomb friction between grains
     |dx_t| <= mu * penetration  (static), else slip. The angle of repose comes out as arctan(mu).
   The tube is a non-inertial frame with tilt theta, rate w and acceleration a. Each particle feels
     g_body = (g - a_y) (sin theta, cos theta)  -  alpha x r  -  2 w x v  +  w^2 r   (r from the pivot)
   so tilting, shaking and letting go all move the contents by the real equations. */
/* The shape of the container: half width hw(y) from the top (y = 0) to the bottom (y = H).
   'tube' is a straight tube with a round bottom, closed or open at the top. 'hourglass' is two ellipse bulbs meeting at a neck. */
function makeProfile(shape,closed,tw,H,d){
  const r=tw/2,ST=.5,n=Math.round(H/ST)+1,t=new Float32Array(n),neck=Math.max(5,(d||3.3)*2.4);
  for(let i=0;i<n;i++){const y=i*ST;let w;
    if(shape==='hourglass'){const hh=H/2,yy=y<hh?y:H-y,cb=r*.2,ys=hh*.56;
      if(yy<cb)w=r*Math.sqrt(Math.max(0,1-((cb-yy)/cb)*((cb-yy)/cb)));else if(yy<ys)w=r;else{const u=Math.min(1,(yy-ys)/(hh-ys));w=neck+(r-neck)*Math.pow(Math.cos(u*Math.PI/2),1.5)}
      w=Math.max(w,neck)}
    else{w=r;const rt=r;if(closed&&y<rt)w=r-rt+Math.sqrt(Math.max(0,rt*rt-(rt-y)*(rt-y)));if(y>H-r)w=Math.sqrt(Math.max(0,r*r-(y-(H-r))*(y-(H-r))))}
    t[i]=w}
  const at=y=>{const f=Math.max(0,Math.min(n-1.001,y/ST)),i=f|0,u=f-i;return t[i]*(1-u)+t[i+1]*u};
  const slope=y=>(at(y+1)-at(y-1))/2;
  const pts=(inset=0)=>{const L=[],R=[];for(let y=0;y<=H+1e-6;y+=2){const w=Math.max(0,at(Math.min(H,y))-inset);L.push([r-w,y]);R.push([r+w,y])}return{L,R}};
  const f=a=>a[0].toFixed(1)+' '+a[1].toFixed(1);
  return{at,slope,r,H,neck,
    poly:(inset=0)=>{const p=pts(inset);return[...p.L,...p.R.reverse()].map(a=>a[0].toFixed(1)+'px '+a[1].toFixed(1)+'px').join(',')},
    path:(inset=0,sides=false)=>{const p=pts(inset);return sides?'M'+p.L.map(f).join('L')+'M'+p.R.map(f).join('L'):'M'+p.L.map(f).join('L')+'L'+p.R.reverse().map(f).join('L')+'Z'},
    lowerArea:()=>{let a=0;for(let y=H/2;y<H;y+=ST)a+=2*at(y)*ST;return a}};
}
class TubePhysics{
  constructor(o){
    this.v2=o.ver==='v2';this.mat=o.mat;this.tw=o.tw;this.r=o.tw/2;this.H=o.H;this.yb=o.H-this.r;
    let area=0;o.layers.forEach((l,i)=>area+=l.v+(i===0?Math.PI*this.r*this.r/2:0));
    this.d=Math.max(o.d||3.3,Math.sqrt(area/0.9/1500));this.pr=this.d/2;
    const counts=o.layers.map((l,i)=>(l.v+(i===0?Math.PI*this.r*this.r/2:0))/area);
    this.N=Math.max(0,Math.round(area/((o.mat==='sand'?0.93:0.8)*this.d*this.d)));
    this.queue=[];o.layers.forEach((l,i)=>{const c=Math.round(counts[i]*this.N);for(let k=0;k<c;k++)this.queue.push(i)});
    if(o.timeline){this.queue=o.timeline.layer.slice();this.mins=o.timeline.mins;this.tl=true;this.T=o.timeline.T||1440;this.clock=o.timeline.start||0;this.d=o.d;this.pr=this.d/2}
    this.blocks=o.layers.map(l=>l.blocks||[]);
    this.N=this.queue.length;const N=this.N;this.minute=new Int16Array(N).fill(-1);
    this.x=new Float32Array(N);this.y=new Float32Array(N);this.vx=new Float32Array(N);this.vy=new Float32Array(N);
    this.px=new Float32Array(N);this.py=new Float32Array(N);this.lam=new Float32Array(N);this.dx=new Float32Array(N);this.dy=new Float32Array(N);
    this.gf=new Float32Array(N).fill(1);this.slp=new Uint8Array(N);this.still=new Uint16Array(N);this.sup=new Uint8Array(N);this.wk=new Uint8Array(N);this.nsl=0;this.layer=new Uint8Array(N);this.var=new Uint8Array(N);this.n=0;this.spawnPer=Math.max(1,Math.ceil(N/100));this.spawnK=0;
    this.h=this.mat==='sand'?this.d*1.5:this.d*2.1;
    this.cell=this.h;this.gw=Math.ceil(this.tw/this.cell)+2;this.gh=Math.ceil(this.H/this.cell)+2;
    this.head=new Int32Array(this.gw*this.gh);this.next=new Int32Array(N);
    this.nb=new Int32Array(N*40);this.nc=new Uint8Array(N);
    this.th=0;this.w=0;this.al=0;this.ty=0;this.vyf=0;this.ay=0;this.tth=0;this.tty=0;
    this.prof=makeProfile(o.shape||'tube',!!o.closed,this.tw,this.H,o.d||3.3);
    {let a=0;while(a<this.H&&this.prof.at(a)<this.pr+.05)a+=.5;this.ymin=Math.max(this.pr,a);let b=this.H;while(b>0&&this.prof.at(b)<this.pr+.05)b-=.5;this.ymax=b;
     const open=!(o.closed||o.shape==='hourglass'),want=o.shape==='hourglass'?Math.max(2.5*this.d,.4*this.r):.75*this.r;let sy=open?this.pr*1.2:this.ymin;while(sy<this.H/2&&this.prof.at(sy)<want+this.pr)sy+=.5;this.sy=Math.max(sy,this.ymin+.1);this.sw=Math.max(0,this.prof.at(this.sy)-2*this.pr)*.8}
    if(this.tl)this.buildHeld();
    /* layers differ a little in density, the lowest layer densest, so mixed liquid separates again (buoyancy) */
    const nl=o.layers.length;this.dens=o.layers.map((l,i)=>1+0.14*(nl-1-i)/Math.max(1,nl-1)+(nl===1?0:0));
    this.g=620;this.rest=0;this.asleep=false;this.maxv=0;
    this.mixK=o.mix==null?1:o.mix<=0?0:Math.pow(4,(o.mix-50)/50);this.zg=o.zg||null;this.zy=o.zg?new Float32Array(N):null;
    if(this.mat!=='sand'){this.initLiquid();this.zg?this.placeZG():this.prefill();if(this.v2)this.initV2(o)}
    if(this.v2&&this.mat==='sand'){const g=()=>{let u=0,v=0;while(!u)u=Math.random();v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v)};this.rad=new Float32Array(N);this.ang=new Float32Array(N);this.sh=new Float32Array(N);this.mj=new Float32Array(N);this.gauss=g}
    if(this.zg&&this.mat==='sand')this.placeZG();
  }
  /* v2 liquid: colour and 'heaviness' are continuous per-particle fields that diffuse, so layers blend and streak when stirred */
  initV2(o){
    const N=this.N,nl=o.layers.length;this.pcol=new Float32Array(N*3);this.hv=new Float32Array(N);
    for(let i=0;i<N;i++){const l=this.layer[i],c=o.layers[l]?o.layers[l].c:'#888888';this.pcol[i*3]=parseInt(c.slice(1,3),16);this.pcol[i*3+1]=parseInt(c.slice(3,5),16);this.pcol[i*3+2]=parseInt(c.slice(5,7),16);this.hv[i]=(nl-1-l)/Math.max(1,nl-1);this.gf[i]=1+.28*this.hv[i]}
    this.om=new Float32Array(N);this.hvm=new Float32Array(N);this.hvm2=new Float32Array(N);this.inkK=0;
  }
  /* diffuse colour and heaviness over neighbour pairs (conservative), then vorticity confinement to keep swirls alive */
  mixV2(h){
    const n=this.n,nb=this.nb,nc=this.nc,x=this.x,y=this.y,pc=this.pcol,hv=this.hv,hh=this.h,k=.9*h;
    for(let i=0;i<n;i++)for(let q=0;q<nc[i];q++){const j=nb[i*40+q];if(j<i)continue;const dx=x[i]-x[j],dy=y[i]-y[j],r=Math.sqrt(dx*dx+dy*dy),w=Math.pow(Math.max(0,1-r/hh),2)*k*2*this.mixK;
      for(let c=0;c<3;c++){const d=w*(pc[j*3+c]-pc[i*3+c]);pc[i*3+c]+=d;pc[j*3+c]-=d}
      const d=w*.07*(hv[j]-hv[i]);hv[i]+=d;hv[j]-=d}
    for(let i=0;i<n;i++)this.gf[i]=1+.28*hv[i];
    if(this.inkK>0){   /* a smoothed copy of the heaviness: whatever is heavier than its surroundings drifts down (lighter drifts up) through the fluid */
      const a=this.hvm,b=this.hvm2;for(let i=0;i<n;i++){let s=hv[i],t=1;for(let q=0;q<nc[i];q++){const j=nb[i*40+q],dx=x[i]-x[j],dy=y[i]-y[j],w=Math.pow(Math.max(0,1-Math.sqrt(dx*dx+dy*dy)/hh),2);s+=w*hv[j];t+=w}a[i]=s/t}
      for(let i=0;i<n;i++){let s=a[i],t=1;for(let q=0;q<nc[i];q++){const j=nb[i*40+q],dx=x[i]-x[j],dy=y[i]-y[j],w=Math.pow(Math.max(0,1-Math.sqrt(dx*dx+dy*dy)/hh),2);s+=w*a[j];t+=w}b[i]=s/t}
    }
    /* vorticity confinement (2D scalar curl), faded when the liquid is calm */
    const om=this.om,vx=this.vx,vy=this.vy;let ms=0;for(let i=0;i<n;i++)ms+=Math.abs(vx[i])+Math.abs(vy[i]);ms/=Math.max(1,n);const eps=.9*Math.min(1,ms/70);if(eps<.02)return;
    for(let i=0;i<n;i++){let w=0;for(let q=0;q<nc[i];q++){const j=nb[i*40+q],dx=x[i]-x[j],dy=y[i]-y[j],r=Math.sqrt(dx*dx+dy*dy)+1e-6,g=this.gradS(r)/r;w+=(vx[j]-vx[i])*(dy*g)-(vy[j]-vy[i])*(dx*g)}om[i]=w}
    for(let i=0;i<n;i++){let ex=0,ey=0;for(let q=0;q<nc[i];q++){const j=nb[i*40+q],dx=x[i]-x[j],dy=y[i]-y[j],r=Math.sqrt(dx*dx+dy*dy)+1e-6,g=this.gradS(r)/r;ex+=Math.abs(om[j])*dx*g;ey+=Math.abs(om[j])*dy*g}
      const l=Math.hypot(ex,ey);if(l<1e-9)continue;ex/=l;ey/=l;const f=Math.max(-3,Math.min(3,om[i]*8e3));vx[i]+=h*eps*f*ey*.02;vy[i]+=h*eps*-f*ex*.02}
  }
  initLiquid(){
    const h=this.h,d=this.d;let rho=0,sum=0,gx=0,gy=0;
    for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++){
      const px=(i+(j&1)*.5)*d,py=j*d*.866,r2=px*px+py*py;
      if(r2<h*h){rho+=this.W(r2);if(i||j){const r=Math.sqrt(r2),g=this.gradS(r);gx+=g*px/r;gy+=g*py/r;sum+=g*g}}}
    this.rho0=rho;this.eps=Math.max(1e-9,0.12*(sum/(rho*rho)));
    this.wdq=this.W((0.25*h)*(0.25*h));
  }
  /* liquid starts as neat layers on a hex lattice, a little loose, and relaxes into the tube */
  /* zero gravity: every particle starts at the height of its own minute on the ruler and is held there by a soft spring */
  placeZG(){
    const z=this.zg,d=this.d;
    for(let k=0;k<this.N;k++){
      const l=this.queue[k];let m=this.pick(l);if(m<0)m=Math.random()*z.cap;
      const y=Math.max(this.ymin,Math.min(this.ymax,z.y0-(m+.5)/z.cap*z.ih+(Math.random()-.5)*d*.5)),hw=Math.max(0,this.prof.at(y)-this.pr);
      const i=this.n++;if(this.grain)this.grain(i);
      this.x[i]=this.r+(Math.random()*2-1)*hw;this.y[i]=y;this.zy[i]=y;this.layer[i]=l;this.var[i]=(Math.random()*5)|0;this.minute[i]=m<0?-1:Math.floor(m);
    }
    this.spawnK=this.N;
  }
  prefill(){
    const d=this.d,sp=d*1.05;let k=0;
    for(let j=0;k<this.N&&j<3000;j++){
      const y=this.ymax-j*sp*0.866;if(y<this.ymin)break;
      const hw=this.prof.at(y)-this.pr,off=(j&1)*sp/2;let x=this.r-hw+off;
      for(;x<=this.r+hw+1e-6&&k<this.N;x+=sp,k++){const i=this.n++;this.x[i]=x;this.y[i]=y;this.layer[i]=this.queue[k];this.var[i]=(Math.random()*5)|0;this.minute[i]=this.pick(this.queue[k])}
    }
    this.spawnK=this.N;
  }
  /* Day replay: all grains of the day wait in the top bulb, stacked soonest-first from the neck up.
     Held grains are placed on a lattice and drift down as grains below them are released. */
  buildHeld(){
    const sp=this.d*1.05,lat=[];
    for(let j=0;lat.length<this.N&&j<4000;j++){
      const y=this.H/2-this.pr*1.3-j*sp*.866;if(y<this.ymin)break;
      const hw=this.prof.at(y)-this.pr*.8;if(hw<0)continue;
      if(hw<sp/2){lat.push([this.r,y]);continue}
      /* each row is stretched to touch both walls, so the pile has no thin ragged edge */
      const c=Math.floor(2*hw/sp)+1,st=c>1?2*hw/(c-1):0;
      for(let q=0;q<c&&lat.length<this.N;q++)lat.push([this.r-hw+q*st,y]);
    }
    this.lat=lat;this.hx=new Float32Array(this.N);this.hy=new Float32Array(this.N);
    for(let k=0;k<this.N;k++){const q=lat[Math.min(k,lat.length-1)];this.hx[k]=q[0];this.hy[k]=q[1]}
    this.shown=this.clock;
  }
  updateHeld(){
    for(let k=this.spawnK;k<this.N;k++){const q=this.lat[Math.min(k-this.spawnK,this.lat.length-1)];this.hx[k]+=(q[0]-this.hx[k])*.18;this.hy[k]+=(q[1]-this.hy[k])*.18}
  }
  /* a representative minute for a grain of this layer, chosen from the layer's time blocks by their length */
  pick(l){const b=this.blocks[l];if(!b||!b.length)return -1;let tot=0;b.forEach(q=>tot+=q.e-q.s);let u=Math.random()*tot;for(const q of b){const w=q.e-q.s;if(u<w)return Math.floor(q.s+u);u-=w}return b[0].s}
  W(r2){const h2=this.h*this.h,t=h2-r2;return t>0?4/(Math.PI*Math.pow(this.h,8))*t*t*t:0}
  gradS(r){const t=this.h-r;return t>0?-30/(Math.PI*Math.pow(this.h,5))*t*t:0}
  wake(){this.asleep=false;this.rest=0}
  grain(i){if(!this.rad)return;this.rad[i]=this.pr*Math.max(.72,Math.min(1.38,Math.exp(.16*this.gauss())));this.sh[i]=Math.random();this.mj[i]=.9+Math.random()*.2;this.ang[i]=Math.random()*6.28}
  spawn(){
    const d=this.d,fast=this.fast;let made=0;
    if(this.tl){   /* a grain leaves the pile at the neck when the clock reaches its minute */
      while(this.spawnK<this.N&&this.mins[this.spawnK]<=this.clock&&made<8){
        const k=this.spawnK,x=this.hx[k],y=this.hy[k];let ok=true;
        for(let q=Math.max(0,this.n-6);q<this.n;q++){const ex=this.x[q]-x,ey=this.y[q]-y;if(ex*ex+ey*ey<d*d*.36){ok=false;break}}
        if(!ok)break;
        const i=this.n++;this.spawnK++;made++;this.grain(i);
        this.x[i]=x;this.y[i]=y;this.vx[i]=0;this.vy[i]=140;this.layer[i]=this.queue[k];this.var[i]=k%5;this.minute[i]=this.mins[k];
      }
      this.shown=(this.spawnK<this.N&&this.mins[this.spawnK]<=this.clock)?this.mins[Math.max(0,this.spawnK-1)]:this.clock;
      this.updateHeld();return;
    }
    /* sand: a steady fall from the top, spread across most of the width, only where the last grains have cleared */
    for(let t=0;t<(fast?40:4)&&made<(fast?30:3)&&this.spawnK<this.N;t++){
      const x=this.r+(Math.random()-.5)*2*this.sw,y=this.sy;let ok=true;
      for(let q=Math.max(0,this.n-30);q<this.n;q++){const ex=this.x[q]-x,ey=this.y[q]-y;if(ex*ex+ey*ey<d*d*1.15){ok=false;break}}
      if(!ok)continue;
      const i=this.n++,k=this.spawnK++;made++;this.grain(i);
      this.x[i]=x;this.y[i]=y;this.vx[i]=(Math.random()-.5)*4;this.vy[i]=120;this.layer[i]=this.queue[k];this.var[i]=(Math.random()*5)|0;this.minute[i]=this.pick(this.queue[k]);
    }
  }
  clamp(i,x,y){
    const pr=this.rad?this.rad[i]:this.pr,P=this.prof,ox=x,oy=y;let hit=false;
    if(y<this.ymin){y=this.ymin;hit=true}else if(y>this.ymax){y=this.ymax;hit=true}
    for(let it=0;it<2;it++){
      const hw=P.at(y)-pr,dx=x-this.r;
      if(Math.abs(dx)>hw){const sg=dx>0?1:-1,s=P.slope(y),nr=Math.sqrt(1+s*s),pen=(Math.abs(dx)-hw)/nr;x-=pen*sg/nr;y+=pen*s/nr;hit=true}
      if(y<this.ymin)y=this.ymin;else if(y>this.ymax)y=this.ymax;
    }
    this.pen=hit?Math.hypot(x-ox,y-oy):0;this.cx=x;this.cy=y;return hit;
  }
  grid(){
    const {head,next,px,py,n,cell,gw,gh}=this;head.fill(-1);
    for(let i=0;i<n;i++){const cx=Math.min(gw-1,Math.max(0,(px[i]/cell|0)+1)),cy=Math.min(gh-1,Math.max(0,(py[i]/cell|0)+1));next[i]=head[cy*gw+cx];head[cy*gw+cx]=i}
    const R2=this.h*this.h,nb=this.nb,nc=this.nc;
    for(let i=0;i<n;i++){
      const cx=Math.min(gw-1,Math.max(0,(px[i]/cell|0)+1)),cy=Math.min(gh-1,Math.max(0,(py[i]/cell|0)+1));let c=0;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const gx=cx+ox,gy=cy+oy;if(gx<0||gy<0||gx>=gw||gy>=gh)continue;
        for(let j=head[gy*gw+gx];j>=0;j=next[j]){if(j===i)continue;const ddx=px[j]-px[i],ddy=py[j]-py[i];if(ddx*ddx+ddy*ddy<R2&&c<39)nb[i*40+c++]=j}}
      nc[i]=c;
    }
  }
  /* one frame: dt is a frame, split into substeps */
  frame(dt){
    if(this.n<this.N)this.spawn();
    // body spring (the hand holding the tube)
    const k=150,c=13;let a=k*(this.tth-this.th)-c*this.w;a=Math.max(-150,Math.min(150,a));this.al=a;this.w=Math.max(-8,Math.min(8,this.w+a*dt));this.th+=this.w*dt;
    const ky=130,cy=14;let ay=ky*(this.tty-this.ty)-cy*this.vyf;ay=Math.max(-1400,Math.min(1400,ay));this.vyf+=ay*dt;this.ty+=this.vyf*dt;this.ay=ay;
    const sub=(Math.abs(this.w)>2||Math.abs(ay)>500)?5:3,h=dt/sub;
    for(let s=0;s<sub;s++)this.mat==='sand'?this.stepSand(h):this.stepLiquid(h);
    if((this.fc=(this.fc||0)+1)%30===0)this.fix();
    let mv=0;for(let i=0;i<this.n;i++){const v=Math.abs(this.vx[i])+Math.abs(this.vy[i]);if(v>mv)mv=v}this.maxv=mv;
    const still=this.n>=this.N&&mv<14&&Math.abs(this.w)<.03&&Math.abs(this.th-this.tth)<.004&&Math.abs(this.ty-this.tty)<.4;
    this.rest=still?this.rest+1:0;if(this.rest>45){this.asleep=true;this.th=this.tth;this.ty=this.tty;this.w=0;this.vyf=0}
  }
  forces(h,i){
    const th=this.th,s=Math.sin(th),c=Math.cos(th),G=this.zg?0:(this.g-this.ay)*(this.mat==='sand'?1:((this.chem||this.v2)?this.gf[i]:this.dens[this.layer[i]]));
    const rx=this.x[i]-this.r,ry=this.y[i]-this.H/2,w=this.w,al=this.al;
    this.vx[i]+=h*(G*s+al*ry+2*w*this.vy[i]+w*w*rx);
    this.vy[i]+=h*(G*c-al*rx-2*w*this.vx[i]+w*w*ry);
    if(this.zy){this.vy[i]+=h*(70*(this.zy[i]-this.y[i])-9*this.vy[i]);this.vx[i]*=.992}
  }
  stepLiquid(h){
    const n=this.n,x=this.x,y=this.y,vx=this.vx,vy=this.vy,px=this.px,py=this.py,lam=this.lam,ddx=this.dx,ddy=this.dy;
    const ik=this.inkK,sn=Math.sin(this.th),cs=Math.cos(this.th);
    for(let i=0;i<n;i++){this.forces(h,i);let dd=0;if(ik>0){const rl=this.hv[i]-this.hvm2[i],ar=Math.abs(rl)-.4;if(ar>0)dd=ik*(rl>0?ar:-ar)*h}const hit=this.clamp(i,x[i]+vx[i]*h+dd*sn,y[i]+vy[i]*h+dd*cs);px[i]=this.cx;py[i]=this.cy}
    this.grid();const nb=this.nb,nc=this.nc,rho0=this.rho0,eps=this.eps,hh=this.h;
    for(let it=0;it<4;it++){
      for(let i=0;i<n;i++){
        let rho=this.W(0),gx=0,gy=0,sum=0;
        for(let q=0;q<nc[i];q++){const j=nb[i*40+q],ex=px[i]-px[j],ey=py[i]-py[j],r2=ex*ex+ey*ey;rho+=this.W(r2);const r=Math.sqrt(r2)+1e-6,g=this.gradS(r)/rho0;const ux=g*ex/r,uy=g*ey/r;gx+=ux;gy+=uy;sum+=ux*ux+uy*uy}
        const C=Math.max(0,rho/rho0-1);lam[i]=-C/(sum+gx*gx+gy*gy+eps);
      }
      for(let i=0;i<n;i++){
        let sx=0,sy=0;
        for(let q=0;q<nc[i];q++){const j=nb[i*40+q],ex=px[i]-px[j],ey=py[i]-py[j],r2=ex*ex+ey*ey,r=Math.sqrt(r2)+1e-6;
          const sc=-0.0008*Math.pow(this.W(r2)/this.wdq,4),f=(lam[i]+lam[j]+sc)*this.gradS(r)/r;sx+=f*ex;sy+=f*ey}
        ddx[i]=sx/rho0;ddy[i]=sy/rho0;
      }
      for(let i=0;i<n;i++){this.clamp(i,px[i]+ddx[i],py[i]+ddy[i]);px[i]=this.cx;py[i]=this.cy}
    }
    for(let i=0;i<n;i++){let ux=(px[i]-x[i])/h,uy=(py[i]-y[i])/h;const sp=Math.hypot(ux,uy);if(sp>620){ux*=620/sp;uy*=620/sp}vx[i]=ux;vy[i]=uy}
    // cohesion: a stretched particle is pulled back toward its neighbours, so thrown liquid stays in drops that rejoin
    for(let i=0;i<n;i++){let cx=0,cy=0;for(let q=0;q<nc[i];q++){const j=nb[i*40+q],ex=px[j]-px[i],ey=py[j]-py[i],r=Math.sqrt(ex*ex+ey*ey)+1e-6;if(r>this.d*1.1){const f=(1-r/hh)*0.9/r;cx+=ex*f;cy+=ey*f}}vx[i]+=cx*0.9;vy[i]+=cy*0.9}
    // XSPH viscosity
    for(let i=0;i<n;i++){let ax=0,ay=0;for(let q=0;q<nc[i];q++){const j=nb[i*40+q],ex=px[i]-px[j],ey=py[i]-py[j],w=this.W(ex*ex+ey*ey)/rho0;ax+=(vx[j]-vx[i])*w;ay+=(vy[j]-vy[i])*w}this.dx[i]=ax*0.12;this.dy[i]=ay*0.12}
    for(let i=0;i<n;i++){vx[i]+=this.dx[i];vy[i]+=this.dy[i];x[i]=px[i];y[i]=py[i]}
    if(this.v2)this.mixV2(h);
  }
  /* Sand. Grains that have been still for a while go to sleep and become fixed in the tube, like grains deep in a pile
     that are locked by the weight above them. A sleeping grain wakes when the grain it rests on leaves, when something hits
     it hard, when it becomes the free surface at a new tilt, or when the tube is shaken hard. */
  stepSand(h){
    const n=this.n,x=this.x,y=this.y,vx=this.vx,vy=this.vy,px=this.px,py=this.py,d=this.d,mu0=this.v2?0.6:0.5,slp=this.slp,still=this.still,wk=this.wk;
    const shake=Math.abs(this.w)>3||Math.abs(this.ay)>650;
    if(shake&&this.nsl>0){slp.fill(0);still.fill(0);this.nsl=0}
    for(let i=0;i<n;i++){
      if(slp[i]){px[i]=x[i];py[i]=y[i];vx[i]=0;vy[i]=0;continue}
      this.forces(h,i);vx[i]*=.985;vy[i]*=.985;this.clamp(i,x[i]+vx[i]*h,y[i]+vy[i]*h);px[i]=this.cx;py[i]=this.cy;
    }
    this.grid();const nb=this.nb,nc=this.nc;wk.fill(0);
    this.sc=(this.sc||0)+1;
    if(this.sc%6===0&&this.nsl>0){
      const ux=-Math.sin(this.th),uy=-Math.cos(this.th),tilted=Math.abs(this.th)>0.1;
      for(let i=0;i<n;i++)if(slp[i]){
        if(nc[i]<this.sup[i]-1){wk[i]=1;continue}
        if(tilted){let up=0;for(let q=0;q<nc[i];q++){const j=nb[i*40+q];if((x[j]-x[i])*ux+(y[j]-y[i])*uy>0.6*d)up++}if(up<=1)wk[i]=1}
      }
    }
    for(let it=0;it<10;it++){
      for(let i=0;i<n;i++)for(let q=0;q<nc[i];q++){
        const j=nb[i*40+q];if(j<i)continue;if(slp[i]&&slp[j])continue;
        const rd=this.rad,dij=rd?rd[i]+rd[j]:d,mu=rd?mu0*(this.mj[i]+this.mj[j])/2:mu0;let ex=px[j]-px[i],ey=py[j]-py[i],r2=ex*ex+ey*ey;if(r2>=dij*dij)continue;
        let r=Math.sqrt(r2);if(r<1e-5){ex=1e-3;ey=0;r=1e-3}
        const nx=ex/r,ny=ey/r,pen=dij-r;
        if(slp[i]||slp[j]){
          const m=slp[i]?j:i,sg=slp[i]?1:-1;   /* m is the awake grain, sg points from the sleeper to m */
          px[m]+=nx*pen*sg;py[m]+=ny*pen*sg;
          const rx=px[m]-x[m],ry=py[m]-y[m],dn=rx*nx+ry*ny,tx=rx-dn*nx,ty=ry-dn*ny,tm=Math.hypot(tx,ty);
          if(tm>1e-7){const f=Math.min(1,mu*pen/tm);px[m]-=tx*f;py[m]-=ty*f}
          const o=slp[i]?i:j;if(pen>.45*d||vx[m]*vx[m]+vy[m]*vy[m]>5000)wk[o]=1;
        }else{
          const wi=rd?1/(rd[i]*rd[i]):1,wj=rd?1/(rd[j]*rd[j]):1,ci=pen*wi/(wi+wj),cj=pen*wj/(wi+wj);
          px[i]-=nx*ci;py[i]-=ny*ci;px[j]+=nx*cj;py[j]+=ny*cj;
          const rx=(px[i]-x[i])-(px[j]-x[j]),ry=(py[i]-y[i])-(py[j]-y[j]),dn=rx*nx+ry*ny,tx=rx-dn*nx,ty=ry-dn*ny,tm=Math.hypot(tx,ty);
          if(tm>1e-7){const f=Math.min(1,mu*pen/tm)*.5;px[i]-=tx*f;py[i]-=ty*f;px[j]+=tx*f;py[j]+=ty*f}
        }
      }
      for(let i=0;i<n;i++){if(slp[i])continue;this.clamp(i,px[i],py[i]);if(this.pen>0.2*d){px[i]=x[i]+(this.cx-x[i])*.95;py[i]=y[i]+(this.cy-y[i])*.95;this.clamp(i,px[i],py[i])}px[i]=this.cx;py[i]=this.cy}
    }
    for(let i=0;i<n;i++){
      if(wk[i]&&slp[i]){slp[i]=0;still[i]=0;this.nsl--}
      if(slp[i])continue;
      let ux=(px[i]-x[i])/h,uy=(py[i]-y[i])/h;
      if(ux*ux+uy*uy<9){ux=0;uy=0;px[i]=x[i];py[i]=y[i];if(++still[i]>80&&nc[i]>=2){slp[i]=1;this.sup[i]=nc[i];this.nsl++;still[i]=0}}else still[i]=0;
      vx[i]=ux;vy[i]=uy;x[i]=px[i];y[i]=py[i];if(this.ang)this.ang[i]+=ux*h/Math.max(.5,this.rad[i]);
    }
  }
  /* a magnetic stirrer: a slowly drifting cellular flow (divergence-free, Taylor-Green) that the fluid is pulled toward */
  stir(t,amp){
    const kx=2*Math.PI/this.tw,ky=2*Math.PI/(this.H*.55),p1=.35*t,p2=.23*t,V=amp||110;
    for(let i=0;i<this.n;i++){
      const a=kx*this.x[i]+p1,b=ky*this.y[i]+p2;
      const tx=-V*Math.sin(a)*Math.cos(b),ty=V*Math.cos(a)*Math.sin(b);
      this.vx[i]+=(tx-this.vx[i])*.25;this.vy[i]+=(ty-this.vy[i])*.25;
    }
  }
  /* height of the top of the pile in px above the tube floor, for testing */
  fix(){for(let i=0;i<this.n;i++)if(!(Math.abs(this.x[i])<1e4&&Math.abs(this.y[i])<1e4)){this.x[i]=this.r;this.y[i]=this.yb;this.vx[i]=this.vy[i]=0}}
  topY(){let m=1e9;for(let i=0;i<this.n;i++)if(this.y[i]<m)m=this.y[i];return m}
}
</script>
