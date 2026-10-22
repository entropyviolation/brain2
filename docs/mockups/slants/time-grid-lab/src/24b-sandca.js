<script>
/* ===== Fine sand: one grain per grid cell =====
   Below about 2.6 px per grain a particle solver is too slow, so fine sand is a cellular automaton.
   Each grain tries to move one cell along gravity in the tube frame (the gravity direction is rounded
   stochastically to one of 8 directions, so tilting is smooth), then slumps down a 45 degree or a
   27 degree step if the cell is free. The pile rests between about 27 and 45 degrees.
   Shaking lets grains jump to a random free neighbour with a probability set by |w|, |alpha| and |a|.
   The tube frame uses the same spring as the particle solver. */
class SandCA{
  constructor(o){
    this.mat='sand';this.ca=true;this.tw=o.tw;this.r=o.tw/2;this.H=o.H;this.yb=o.H-this.r;
    const c=Math.max(.8,o.d);this.c=c;this.d=c;this.gw=Math.ceil(this.tw/c);this.gh=Math.ceil(this.H/c);
    const n=this.gw*this.gh;this.cell=new Uint8Array(n);this.vr=new Uint8Array(n);this.inside=new Uint8Array(n);
    const P=makeProfile(o.shape||'tube',!!o.closed,this.tw,this.H,o.d||3.3);this.prof=P;
    for(let gy=0;gy<this.gh;gy++)for(let gx=0;gx<this.gw;gx++){const px=(gx+.5)*c,py=(gy+.5)*c;this.inside[gy*this.gw+gx]=Math.abs(px-this.r)<=P.at(py)?1:0}
    {const open=!(o.closed||o.shape==='hourglass'),want=o.shape==='hourglass'?Math.max(2.5*c,.4*this.r):.75*this.r;let sy=open?c:0;while(sy<this.H/2&&P.at(sy)<want+c)sy+=.5;this.srow=Math.max(1,Math.floor(sy/c));this.sw=Math.max(0,P.at(sy)-2*c)*.8}
    this.blocks=o.layers.map(l=>l.blocks||[]);
    this.queue=[];o.layers.forEach((l,i)=>{const cnt=Math.round((l.v+(i===0?Math.PI*this.r*this.r/2:0))/(c*c));for(let k=0;k<cnt;k++)this.queue.push(i)});
    this.N=this.queue.length;this.n=0;this.spawnK=0;this.rate=Math.max(3,Math.ceil(this.N/260));this.tt=0;{const ps=Math.max(2,Math.min(9,Math.round(6/c)));this.stw=Math.max(2,Math.min(this.gw*.28,Math.ceil(this.rate/(ps*.8))))}
    this.th=0;this.w=0;this.al=0;this.ty=0;this.vyf=0;this.ay=0;this.tth=0;this.tty=0;this.rest=0;this.asleep=false;this.par=0;this.moved=1;this.depth=new Uint16Array(n);
  }
  wake(){this.asleep=false;this.rest=0}
  spawn(){
    /* a thin stream from the top centre */
    const gw=this.gw;
    for(let s=0;s<this.rate&&this.spawnK<this.N;s++){
      const gx=Math.max(1,Math.min(gw-2,Math.round(gw/2+Math.sin(this.tt*.021)*gw*.05+(Math.random()-.5)*this.stw))),k=this.srow*gw+gx;
      if(this.cell[k]===0&&this.inside[k]){this.cell[k]=this.queue[this.spawnK]+1;this.vr[k]=(Math.random()*8)|0;this.n++;this.spawnK++}
    }
  }
  frame(dt){
    this.tt++;if(this.spawnK<this.N)this.spawn();
    const k=150,c=13;let a=k*(this.tth-this.th)-c*this.w;a=Math.max(-150,Math.min(150,a));this.al=a;this.w=Math.max(-8,Math.min(8,this.w+a*dt));this.th+=this.w*dt;
    const ky=130,cy=14;let ay=ky*(this.tty-this.ty)-cy*this.vyf;ay=Math.max(-1400,Math.min(1400,ay));this.vyf+=ay*dt;this.ty+=this.vyf*dt;this.ay=ay;
    const passes=Math.max(3,Math.min(12,Math.round(8.5/this.c))),jp=Math.min(.6,(Math.abs(this.w)*.12+Math.abs(this.al)*.003+Math.abs(ay)*.0006))*0.35;
    let mv=0;for(let p=0;p<passes;p++)mv+=this.pass(jp);
    this.moved=mv;this.par^=1;
    const still=this.spawnK>=this.N&&mv===0&&jp<.01&&Math.abs(this.w)<.03&&Math.abs(this.th-this.tth)<.004&&Math.abs(this.ty-this.tty)<.4;
    this.rest=still?this.rest+1:0;if(this.rest>20){this.asleep=true;this.th=this.tth;this.ty=this.tty;this.w=0;this.vyf=0}
  }
  pass(jp){
    const gw=this.gw,gh=this.gh,cell=this.cell,vr=this.vr,ins=this.inside;
    const D=[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
    const sct=((this.th/(Math.PI/4))%8+8)%8,k0=Math.floor(sct),tt=sct-k0;
    const gx=Math.sin(this.th),gy=Math.cos(this.th);let moved=0;
    const free=(x,y)=>{if(x<0||y<0||x>=gw||y>=gh)return false;const j=y*gw+x;return !cell[j]&&ins[j]};
    const mv=(i,x,y,dx,dy)=>{const nx=x+dx,ny=y+dy;if(!free(nx,ny))return false;const j=ny*gw+nx;cell[j]=cell[i];vr[j]=vr[i];cell[i]=0;moved++;return true};
    const one=(x,y)=>{
      const i=y*gw+x;if(!cell[i])return;
      const dn=D[(k0+(Math.random()<tt?1:0))&7],sx=-dn[1],sy=dn[0];
      if(mv(i,x,y,dn[0],dn[1]))return;   /* a grain with air straight below it always falls, locked or not, so nothing hangs on a shelf */
      if(this.depth[i]>this.flow&&Math.random()>.012)return;
      if(jp>0&&Math.random()<jp){const d=D[(Math.random()*8)|0];if(mv(i,x,y,d[0],d[1]))return}
      const sg=Math.random()<.5?1:-1;
      for(let t=0;t<2;t++){
        const s2=t?-sg:sg,ox=x+s2*sx,oy=y+s2*sy;if(!free(ox,oy))continue;
        if(Math.random()<.6&&free(ox+dn[0],oy+dn[1])&&free(ox+s2*sx,oy+s2*sy)&&free(ox+s2*sx+dn[0],oy+s2*sy+dn[1])){if(mv(i,x,y,dn[0]+2*s2*sx,dn[1]+2*s2*sy))return}
        if(mv(i,x,y,dn[0]+s2*sx,dn[1]+s2*sy))return;
      }
    };
    /* depth = how many grains sit on top of this one along gravity. Only grains near the free surface may move,
       so the bulk stays locked in the tube and a tilt erodes the pile from the top, layer by layer. */
    const dn0=D[(k0+(tt>.5?1:0))&7],depth=this.depth,flow=jp>.1?1e9:Math.max(5,Math.round(15/this.c)*(1+jp*8));this.flow=flow;
    {const ys=dn0[1]>=0?[0,gh,1]:[gh-1,-1,-1],xs=dn0[0]>=0?[0,gw,1]:[gw-1,-1,-1];
     for(let y=ys[0];y!==ys[1];y+=ys[2])for(let x=xs[0];x!==xs[1];x+=xs[2]){const i=y*gw+x;if(!cell[i]){depth[i]=0;continue}const ux=x-dn0[0],uy=y-dn0[1];depth[i]=(ux<0||uy<0||ux>=gw||uy>=gh||!cell[uy*gw+ux])?1:depth[uy*gw+ux]+1}}
    const par=this.par;
    if(Math.abs(gy)>=Math.abs(gx)){
      const down=gy>0;for(let yy=0;yy<gh;yy++){const y=down?gh-1-yy:yy;if(par){for(let x=0;x<gw;x++)one(x,y)}else for(let x=gw-1;x>=0;x--)one(x,y)}
    }else{
      const right=gx>0;for(let xx=0;xx<gw;xx++){const x=right?gw-1-xx:xx;if(par){for(let y=0;y<gh;y++)one(x,y)}else for(let y=gh-1;y>=0;y--)one(x,y)}
    }
    return moved;
  }
  topY(){for(let y=0;y<this.gh;y++)for(let x=0;x<this.gw;x++)if(this.cell[y*this.gw+x])return y*this.c;return 1e9}
}
</script>
