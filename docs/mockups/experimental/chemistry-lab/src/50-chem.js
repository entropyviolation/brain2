<script>
/* ===== Chemistry engine (experimental) =====
   A reactive particle fluid. The liquid in the tube is the particle fluid from 24-sim.js. Every particle is a small
   parcel of solution (equal volume Vp) that carries:
     concentrations c_s (mol/L) of 24 species, and a temperature T.
   Each frame, for every parcel:
     1. transport: parcels move with the flow (advection), exchange species by diffusion and heat by conduction with their
        neighbours:  dc_i/dt = D * 4/S0 * sum_j w_ij (c_j - c_i),  S0 = sum w r^2 on an ideal lattice. The sum is over pairs, so
        moles are conserved exactly. D values are real (about 1.5e-9 m2/s for ions, 1.4e-7 m2/s for heat).
     2. reaction: instant ionic reactions use extent = min(reactants); precipitation relaxes to the solubility
        equilibrium of Ksp;  slow reactions use rate laws with Arrhenius k(T) = k298 exp(-Ea/R (1/T - 1/298.15)).
     3. thermochemistry: each extent xi (mol/L) changes the parcel temperature by -dH * xi / (rho c) with rho c = 4180 J/(L K).
     4. gas: dissolved gas above its Henry's law solubility (which falls as T rises) nucleates into bubbles, which make the
        parcel buoyant, rise, and leave at the surface (dissolution enthalpy is paid when they form).
   Mixing is therefore physical: shaking, stirring, density and heat-driven convection all feed the reactions.
   Enthalpies are rounded textbook standard values (kJ/mol). Rate constants of slow reactions are calibrated for a
   readable time scale, not measured. Fast reactions are limited by mixing, as they are in a real tube. */
const SPN=['H+','OH-','Cl-','Na+','AcOH','AcO-','HCO3-','CO2aq','Cu2+','SO4','Ag+','NO3-','Ca2+','CO3','H2O2','I-','K+','O2aq','H2O','CuOH2s','AgCls','CaCO3s','CO2g','O2g'];
const SI={};SPN.forEach((n,i)=>SI[n]=i);
const NS=SPN.length,NAQ=19;
const SPDISPLAY={'H+':'H⁺','OH-':'OH⁻','Cl-':'Cl⁻','Na+':'Na⁺','AcOH':'CH₃COOH','AcO-':'CH₃COO⁻','HCO3-':'HCO₃⁻','CO2aq':'CO₂(aq)','Cu2+':'Cu²⁺','SO4':'SO₄²⁻','Ag+':'Ag⁺','NO3-':'NO₃⁻','Ca2+':'Ca²⁺','CO3':'CO₃²⁻','H2O2':'H₂O₂','I-':'I⁻','K+':'K⁺','O2aq':'O₂(aq)','H2O':'H₂O formed','CuOH2s':'Cu(OH)₂(s)','AgCls':'AgCl(s)','CaCO3s':'CaCO₃(s)','CO2g':'CO₂(g)','O2g':'O₂(g)'};
const FORMULA={'H+':'H','OH-':'OH','Cl-':'Cl','Na+':'Na','AcOH':'C2H4O2','AcO-':'C2H3O2','HCO3-':'HCO3','CO2aq':'CO2','Cu2+':'Cu','SO4':'SO4','Ag+':'Ag','NO3-':'NO3','Ca2+':'Ca','CO3':'CO3','H2O2':'H2O2','I-':'I','K+':'K','O2aq':'O2','H2O':'H2O','CuOH2s':'CuO2H2','AgCls':'AgCl','CaCO3s':'CaCO3','CO2g':'CO2','O2g':'O2'};
const FORMULA_EL=SPN.map(n=>{const o={};(FORMULA[n].match(/[A-Z][a-z]?\d*/g)||[]).forEach(t=>{const e=t.match(/[A-Z][a-z]?/)[0],k=+(t.slice(e.length)||1);o[e]=(o[e]||0)+k});return o});
const MOLAR={CuOH2s:97.56,AgCls:143.32,CaCO3s:100.09};
const CHARGE={'H+':1,'OH-':-1,'Cl-':-1,'Na+':1,'AcO-':-1,'HCO3-':-1,'Cu2+':2,'SO4':-2,'Ag+':1,'NO3-':-1,'Ca2+':2,'CO3':-2,'I-':-1,'K+':1};
const REAGENTS={
  water:{name:'Water (blank)',f:'H₂O',sp:{},c:[1,1,1]},
  hcl:{name:'Hydrochloric acid',f:'HCl',sp:{'H+':1,'Cl-':1},c:[.05,1,.5]},
  naoh:{name:'Sodium hydroxide',f:'NaOH',sp:{'Na+':1,'OH-':1},c:[.05,1,.5]},
  aceticacid:{name:'Acetic acid (vinegar)',f:'CH₃COOH',sp:{'AcOH':1},c:[.1,1.5,.8]},
  nahco3:{name:'Sodium bicarbonate',f:'NaHCO₃',sp:{'Na+':1,'HCO3-':1},c:[.05,1,.5]},
  cuso4:{name:'Copper(II) sulfate',f:'CuSO₄',sp:{'Cu2+':1,'SO4':1},c:[.02,.5,.2]},
  agno3:{name:'Silver nitrate',f:'AgNO₃',sp:{'Ag+':1,'NO3-':1},c:[.01,.3,.1]},
  nacl:{name:'Sodium chloride',f:'NaCl',sp:{'Na+':1,'Cl-':1},c:[.01,1,.1]},
  cacl2:{name:'Calcium chloride',f:'CaCl₂',sp:{'Ca2+':1,'Cl-':2},c:[.02,.5,.2]},
  na2co3:{name:'Sodium carbonate',f:'Na₂CO₃',sp:{'Na+':2,'CO3':1},c:[.02,.5,.2]},
  h2o2:{name:'Hydrogen peroxide',f:'H₂O₂',sp:{'H2O2':1},c:[.1,2,.9]}
};
/* reactions: id, balanced equation, standard enthalpy (J/mol), kind, note */
const RX={
  neut:{eq:'H⁺ + OH⁻ → H₂O',dH:-55.8e3,kind:'instant acid-base',why:'A proton moves from the acid to the hydroxide. It is nearly instant, so only mixing limits it. The released bond energy warms the solution.',math:'extent ξ = min([H⁺],[OH⁻]);  ΔT = −ΔH·ξ / (ρc) = 55.8 kJ/mol × ξ / 4180 J/(L·K) = 13.3 K per mol/L'},
  carbH:{eq:'H⁺ + CO₃²⁻ → HCO₃⁻',dH:-14.9e3,kind:'instant acid-base',why:'Carbonate is a base and takes a proton to become bicarbonate.',math:'ξ = min([H⁺],[CO₃²⁻])'},
  bicarbH:{eq:'H⁺ + HCO₃⁻ → CO₂(aq) + H₂O',dH:-7.6e3,kind:'instant acid-base',why:'Bicarbonate takes a proton and becomes carbonic acid, which is just dissolved CO₂. When the water cannot hold it, the CO₂ comes out as bubbles.',math:'ξ = min([H⁺],[HCO₃⁻]);  gas leaves when [CO₂] > S(T)'},
  acOH:{eq:'CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O',dH:-56.0e3,kind:'instant acid-base',why:'A weak acid is neutralised by a strong base, leaving acetate. A mix of acetic acid and acetate is a buffer, so the pH changes slowly there.',math:'pH = pKa + log₁₀([A⁻]/[HA]), pKa = 4.76 (Henderson–Hasselbalch)'},
  bicarbOH:{eq:'HCO₃⁻ + OH⁻ → CO₃²⁻ + H₂O',dH:-40.9e3,kind:'instant acid-base',why:'Hydroxide removes the proton from bicarbonate.',math:'pH = pKa₂ + log₁₀([CO₃²⁻]/[HCO₃⁻]), pKa₂ = 10.33'},
  vinegar:{eq:'CH₃COOH + HCO₃⁻ → CH₃COO⁻ + H₂O + CO₂',dH:-7.8e3,kind:'rate law',why:'Acetic acid gives a proton to bicarbonate. The carbonic acid that forms falls apart into CO₂ gas. Making CO₂(aq) is slightly exothermic, but letting it bubble out takes +20.3 kJ/mol from the liquid, so the tube gets colder overall (net +12.5 kJ/mol).',math:'rate = k(T)[AcOH][HCO₃⁻];  k(T) = k₂₉₈ exp(−Eₐ/R (1/T − 1/298.15)),  Eₐ = 30 kJ/mol'},
  cuoh:{eq:'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓',dH:-54.6e3,kind:'precipitation',why:'Copper(II) hydroxide is almost insoluble. Once the ion product passes the solubility product, the excess leaves the solution as a pale blue solid that sinks.',math:'precipitate when Q = [Cu²⁺][OH⁻]² > Ksp = 2.2×10⁻²⁰, equilibrium (Cₜ−s)(Oₜ−2s)² = Ksp'},
  agcl:{eq:'Ag⁺ + Cl⁻ → AgCl↓',dH:-65.4e3,kind:'precipitation',why:'Silver chloride is very insoluble. A tiny amount of Ag⁺ and Cl⁻ together is enough to make white solid.',math:'Q = [Ag⁺][Cl⁻] > Ksp = 1.8×10⁻¹⁰,  s = ((A+C) − √((A−C)² + 4Ksp)) / 2'},
  caco3:{eq:'Ca²⁺ + CO₃²⁻ → CaCO₃↓',dH:+12.5e3,kind:'precipitation',why:'This is hard-water scale. The solid forms because it is entropy-favoured, even though the step is slightly endothermic, so the tube cools a little.',math:'Q = [Ca²⁺][CO₃²⁻] > Ksp = 3.4×10⁻⁹'},
  h2o2:{eq:'2 H₂O₂ → 2 H₂O + O₂',dH:-94.6e3,kind:'rate law, catalysed',why:'Peroxide decomposes slowly on its own. Iodide opens a path with a lower activation energy, so the rate jumps. The reaction releases heat, the heat speeds it up, and it accelerates itself.',math:'rate = (k_cat[I⁻] + k_unc)[H₂O₂];  Eₐ(cat) = 56 kJ/mol, Eₐ(uncat) = 75 kJ/mol;  k = k₂₉₈ exp(−Eₐ/R (1/T − 1/298.15))'}
};
const KSP={cu:2.2e-20,ag:1.8e-10,ca:3.4e-9};
const R_GAS=8.314,CV=4180,TAU_BATH=240;
const D_ION=1.5e-9,D_GAS=2e-9,D_HEAT=1.4e-7;

function cuEq(Ct,Ot){const m=Math.min(Ct,Ot/2);if(m<=0||Ct*Ot*Ot<=KSP.cu)return 0;let lo=0,hi=m;for(let k=0;k<44;k++){const mid=(lo+hi)/2,f=(Ct-mid)*(Ot-2*mid)*(Ot-2*mid)-KSP.cu;if(f>0)lo=mid;else hi=mid}return(lo+hi)/2}
function quadEq(A,C,K){if(A*C<=K)return 0;return((A+C)-Math.sqrt((A-C)*(A-C)+4*K))/2}
const solCO2=T=>0.0334*Math.exp(2400*(1/T-1/298.15)),solO2=T=>0.00126*Math.exp(1500*(1/T-1/298.15));

/* approximate pH from a composition (no activity corrections) */
function pHOf(c){
  const H=c[SI['H+']],OH=c[SI['OH-']],A=c[SI['AcOH']],Ac=c[SI['AcO-']],B=c[SI['HCO3-']],Co=c[SI['CO3']],Cu=c[SI['Cu2+']],S=c[SI['CO2aq']],Cus=c[SI['CuOH2s']];
  if(H>1e-9&&H>OH)return -Math.log10(H);
  if(OH>1e-9&&OH>H)return 14+Math.log10(OH);
  if(Cus>1e-7&&Cu>0)return 14+Math.log10(Math.sqrt(KSP.cu/Cu));
  if(A>1e-6){const Ka=1.75e-5,h=(-(Ac+Ka)+Math.sqrt((Ac+Ka)*(Ac+Ka)+4*Ka*A))/2;return -Math.log10(h)}
  if(S>1e-6&&B>1e-6)return 6.35+Math.log10(B/S);
  if(Cu>1e-6){const h=Math.sqrt(1.26e-8*Cu);return -Math.log10(h)}
  if(B>1e-6&&Co>1e-6)return 10.33+Math.log10(Co/B);
  if(Co>1e-6){const Kb=2.14e-4,oh=(-Kb+Math.sqrt(Kb*Kb+4*Kb*Co))/2;return 14+Math.log10(oh)}
  if(Ac>1e-6){const Kb=5.7e-10,oh=Math.sqrt(Kb*Ac);return 14+Math.log10(oh)}
  if(B>1e-6)return 8.34;
  return 7;
}

class ChemEngine{
  constructor(ph,cfg,opt={}){
    this.ph=ph;this.cfg=cfg;const N=ph.N;this.N=N;this.C=new Float64Array(N*NS);this.T=new Float64Array(N).fill(cfg.T0);
    this.Vp=(cfg.A.V+cfg.B.V)/1000/N;this.bath=cfg.bath;this.t=0;this.heatJ=0;this.esc=new Float64Array(NS);this.cnt={};Object.keys(RX).forEach(k=>this.cnt[k]=0);
    this.W=new Float32Array(N*40);this.pcol=new Uint8Array(N*4);this.gas=new Float32Array(N);
    if(opt.mixed){for(let i=0;i<N;i++)this.setComp(i,null,true)}
    else for(let i=0;i<N;i++)this.setComp(i,ph.layer[i]===0?cfg.A:cfg.B,false);
    this.init=this.moles();this.initElements=this.elements();
    /* lattice constant for the conservative diffusion stencil */
    const d=ph.d,h=ph.h;let s0=0;for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++){if(!i&&!j)continue;const px=(i+(j&1)*.5)*d,py=j*d*.866,r2=px*px+py*py;if(r2<h*h){const w=Math.pow(1-Math.sqrt(r2)/h,2);s0+=w*r2}}
    this.S0=s0;this.pxmm=16/ph.tw;
    this.dIon=D_ION/Math.pow(this.pxmm*1e-3,2);this.dGas=D_GAS/Math.pow(this.pxmm*1e-3,2);this.dHeat=D_HEAT/Math.pow(this.pxmm*1e-3,2);
  }
  setComp(i,r,mixed){
    const c=this.C,b=i*NS,cfg=this.cfg;
    const add=(rr,f)=>{const R=REAGENTS[rr.id];for(const k in R.sp)c[b+SI[k]]+=R.sp[k]*rr.c*f};
    if(mixed){const V=cfg.A.V+cfg.B.V;add(cfg.A,cfg.A.V/V);add(cfg.B,cfg.B.V/V)}else add(r,1);
    if(cfg.catalyst){c[b+SI['I-']]+=0.05;c[b+SI['K+']]+=0.05}
  }
  moles(){const m=new Float64Array(NS),N=this.N;for(let i=0;i<N;i++)for(let s=0;s<NS;s++)m[s]+=this.C[i*NS+s]*this.Vp;for(let s=0;s<NS;s++)m[s]+=this.esc[s];return m}
  elements(){const m=this.moles(),o={};for(let s=0;s<NS;s++)for(const e in FORMULA_EL[s])o[e]=(o[e]||0)+m[s]*FORMULA_EL[s][e];return o}
  bulk(){const b=new Float64Array(NS),N=this.N;for(let i=0;i<N;i++)for(let s=0;s<NS;s++)b[s]+=this.C[i*NS+s];for(let s=0;s<NS;s++)b[s]/=N;return b}
  avgT(){let s=0,mx=0;for(let i=0;i<this.N;i++){s+=this.T[i];if(this.T[i]>mx)mx=this.T[i]}return{avg:s/this.N,max:mx}}
  /* ---- transport ---- */
  weights(){
    const ph=this.ph,n=this.N,h=ph.h;
    for(let i=0;i<n;i++)for(let q=0;q<ph.nc[i];q++){const j=ph.nb[i*40+q],dx=ph.x[i]-ph.x[j],dy=ph.y[i]-ph.y[j],r=Math.sqrt(dx*dx+dy*dy);this.W[i*40+q]=Math.pow(Math.max(0,1-r/h),2)}
  }
  diffuse(dt){
    const act=this.act,ph=this.ph,n=this.N,C=this.C,T=this.T,k=4/this.S0,nb=ph.nb,nc=ph.nc,W=this.W;
    const fIon=Math.min(.45,this.dIon*k*dt),fGas=Math.min(.45,this.dGas*k*dt),fHeat=Math.min(.45,this.dHeat*k*dt);
    const dC=this.dC||(this.dC=new Float64Array(C.length)),dT=this.dTT||(this.dTT=new Float64Array(n));dC.fill(0);dT.fill(0);
    for(let i=0;i<n;i++)for(let q=0;q<nc[i];q++){
      const j=nb[i*40+q];if(j<i)continue;const w=W[i*40+q],bi=i*NS,bj=j*NS;
      for(let a=0;a<act.length;a++){const s=act[a],f=(s===SI['CO2aq']||s===SI['O2aq'])?fGas:fIon,d=f*w*(C[bj+s]-C[bi+s]);dC[bi+s]+=d;dC[bj+s]-=d}
      const dt2=fHeat*w*(T[j]-T[i]);dT[i]+=dt2;dT[j]-=dt2;
    }
    for(let i=0;i<C.length;i++)C[i]+=dC[i];for(let i=0;i<n;i++)T[i]+=dT[i];
  }
  /* ---- reactions ---- */
  react(dt){
    const n=this.N,C=this.C,Vp=this.Vp,cnt=this.cnt,H=SI['H+'],OH=SI['OH-'],AcOH=SI['AcOH'],Ac=SI['AcO-'],HCO3=SI['HCO3-'],CO2=SI['CO2aq'],CO3=SI['CO3'],Cu=SI['Cu2+'],Ag=SI['Ag+'],Cl=SI['Cl-'],Ca=SI['Ca2+'],H2O2=SI['H2O2'],I=SI['I-'],O2=SI['O2aq'],W=SI['H2O'],CuS=SI['CuOH2s'],AgS=SI['AgCls'],CaS=SI['CaCO3s'],CO2g=SI['CO2g'],O2g=SI['O2g'];
    for(let i=0;i<n;i++){
      const b=i*NS;let q=0;const T=this.T[i];
      const kT=(k,Ea)=>k*Math.exp(-Ea/R_GAS*(1/T-1/298.15));
      const ext=(id,x,dH)=>{q+=-dH*x;this.heatJ+=-dH*x*Vp;cnt[id]+=x*Vp};
      for(let pass=0;pass<2;pass++){
        let x=Math.min(C[b+H],C[b+OH]);if(x>0){C[b+H]-=x;C[b+OH]-=x;C[b+W]+=x;ext('neut',x,RX.neut.dH)}
        x=Math.min(C[b+H],C[b+CO3]);if(x>0){C[b+H]-=x;C[b+CO3]-=x;C[b+HCO3]+=x;ext('carbH',x,RX.carbH.dH)}
        x=Math.min(C[b+H],C[b+HCO3]);if(x>0){C[b+H]-=x;C[b+HCO3]-=x;C[b+CO2]+=x;C[b+W]+=x;ext('bicarbH',x,RX.bicarbH.dH)}
        x=Math.min(C[b+AcOH],C[b+OH]);if(x>0){C[b+AcOH]-=x;C[b+OH]-=x;C[b+Ac]+=x;C[b+W]+=x;ext('acOH',x,RX.acOH.dH)}
        x=Math.min(C[b+HCO3],C[b+OH]);if(x>0){C[b+HCO3]-=x;C[b+OH]-=x;C[b+CO3]+=x;C[b+W]+=x;ext('bicarbOH',x,RX.bicarbOH.dH)}
      }
      /* precipitation, relaxing to the solubility equilibrium (also dissolves again if undersaturated) */
      let relax=1-Math.exp(-2*dt),ds;
      ds=(cuEq(C[b+Cu]+C[b+CuS],C[b+OH]+2*C[b+CuS])-C[b+CuS])*relax;if(Math.abs(ds)>1e-15){C[b+Cu]-=ds;C[b+OH]-=2*ds;C[b+CuS]+=ds;ext('cuoh',ds,RX.cuoh.dH)}
      ds=(quadEq(C[b+Ag]+C[b+AgS],C[b+Cl]+C[b+AgS],KSP.ag)-C[b+AgS])*relax;if(Math.abs(ds)>1e-15){C[b+Ag]-=ds;C[b+Cl]-=ds;C[b+AgS]+=ds;ext('agcl',ds,RX.agcl.dH)}
      ds=(quadEq(C[b+Ca]+C[b+CaS],C[b+CO3]+C[b+CaS],KSP.ca)-C[b+CaS])*relax;if(Math.abs(ds)>1e-15){C[b+Ca]-=ds;C[b+CO3]-=ds;C[b+CaS]+=ds;ext('caco3',ds,RX.caco3.dH)}
      /* rate laws */
      let x=Math.min(kT(5,30e3)*C[b+AcOH]*C[b+HCO3]*dt,C[b+AcOH],C[b+HCO3]);if(x>0){C[b+AcOH]-=x;C[b+HCO3]-=x;C[b+Ac]+=x;C[b+CO2]+=x;C[b+W]+=x;ext('vinegar',x,RX.vinegar.dH)}
      x=Math.min((kT(0.05,56e3)*C[b+I]+kT(1e-7,75e3))*C[b+H2O2]*dt,C[b+H2O2]);if(x>0){C[b+H2O2]-=x;C[b+W]+=x;C[b+O2]+=x/2;ext('h2o2',x,RX.h2o2.dH)}
      /* gas: above solubility, the excess nucleates into bubbles (pays the dissolution enthalpy) */
      let sc=solCO2(T);if(C[b+CO2]>1.4*sc){const dg=(C[b+CO2]-sc)*(1-Math.exp(-3*dt));C[b+CO2]-=dg;C[b+CO2g]+=dg;q+=-20.3e3*dg;this.heatJ+=-20.3e3*dg*Vp}
      sc=solO2(T);if(C[b+O2]>1.4*sc){const dg=(C[b+O2]-sc)*(1-Math.exp(-3*dt));C[b+O2]-=dg;C[b+O2g]+=dg;q+=-11.7e3*dg;this.heatJ+=-11.7e3*dg*Vp}
      this.T[i]=T+q/CV+(this.bath-T)*(1-Math.exp(-dt/TAU_BATH));
    }
  }
  step(dtc){
    if(!(dtc>0))return;
    this.weights();
    const nsub=Math.max(1,Math.min(40,Math.ceil(dtc/0.5))),dts=dtc/nsub;
    this.act=[];for(let s=0;s<NAQ;s++){let nz=false;for(let i=0;i<this.N&&!nz;i++)if(this.C[i*NS+s]>1e-12)nz=true;if(nz)this.act.push(s)}
    for(let s=0;s<nsub;s++){this.diffuse(dts);this.react(dts)}
    this.t+=dtc;this.surface();this.update();
  }
  /* bubbles at the free surface leave the tube */
  surface(){
    const ph=this.ph,n=this.N,C=this.C,d=ph.d,ux=-Math.sin(ph.th),uy=-Math.cos(ph.th);
    for(let i=0;i<n;i++){
      const b=i*NS,g=C[b+SI['CO2g']]+C[b+SI['O2g']];if(g<1e-9)continue;
      let up=0;for(let q=0;q<ph.nc[i];q++){const j=ph.nb[i*40+q];if((ph.x[j]-ph.x[i])*ux+(ph.y[j]-ph.y[i])*uy>0.6*d)up++}
      if(up<=1){this.esc[SI['CO2g']]+=C[b+SI['CO2g']]*this.Vp;this.esc[SI['O2g']]+=C[b+SI['O2g']]*this.Vp;C[b+SI['CO2g']]=0;C[b+SI['O2g']]=0}
    }
  }
  /* buoyancy (gravity factor) and colour for each parcel */
  update(){
    const ph=this.ph,n=this.N,C=this.C,cfg=this.cfg;
    for(let i=0;i<n;i++){
      const b=i*NS,c=C.subarray(b,b+NS);
      let ions=0;for(const k in CHARGE)ions+=c[SI[k]];
      const solid=c[SI['CuOH2s']]+c[SI['AgCls']]+c[SI['CaCO3s']],gas=(c[SI['CO2g']]+c[SI['O2g']])*0.0821*this.T[i];
      this.gas[i]=gas;
      ph.gf[i]=1+0.02*ions+0.5*Math.min(1,solid*20)-6*Math.min(.6,gas);
      this.colorOf(i,c);
    }
  }
  colorOf(i,c){
    const pH=pHOf(c),l=1.6;let A=[0,0,0];
    const add=(eps,conc)=>{A[0]+=eps[0]*conc*l;A[1]+=eps[1]*conc*l;A[2]+=eps[2]*conc*l};
    add([3,1,.2],c[SI['Cu2+']]);
    const ind=this.cfg.indicator;let uni=null;
    if(ind==='phph'){const f=1/(1+Math.pow(10,9.4-pH));add([1500,14000,6000],5e-5*f)}
    else if(ind==='btb'){const f=1/(1+Math.pow(10,7.1-pH));add([12000,6000,500],5e-5*f);add([500,1200,14000],5e-5*(1-f))}
    else if(ind==='uni'){const P=[[1,[230,40,40]],[3,[240,130,40]],[5,[240,220,50]],[7,[80,190,90]],[9,[60,110,200]],[11,[120,70,170]],[13,[90,40,130]]];let p=Math.max(1,Math.min(13,pH)),k=0;while(k<P.length-2&&p>P[k+1][0])k++;const t=(p-P[k][0])/(P[k+1][0]-P[k][0]);uni=P[k][1].map((v,m)=>v+(P[k+1][1][m]-v)*t)}
    let r=255*Math.pow(10,-A[0]),g=255*Math.pow(10,-A[1]),bl=255*Math.pow(10,-A[2]);
    let alpha=170-60*Math.min(1,(A[0]+A[1]+A[2])/1.2);
    const clear=[210,232,245];r=clear[0]*r/255;g=clear[1]*g/255;bl=clear[2]*bl/255;
    if(uni){r=r*.15+uni[0]*.85;g=g*.15+uni[1]*.85;bl=bl*.15+uni[2]*.85;alpha=215}
    const sol=[[c[SI['CuOH2s']],[95,170,225]],[c[SI['AgCls']],[243,243,243]],[c[SI['CaCO3s']],[238,238,232]]];
    for(const[s,col]of sol){const w=1-Math.exp(-s*45);if(w>.01){r+=(col[0]-r)*w;g+=(col[1]-g)*w;bl+=(col[2]-bl)*w;alpha=Math.max(alpha,235*w+alpha*(1-w))}}
    const o=i*4;this.pcol[o]=r;this.pcol[o+1]=g;this.pcol[o+2]=bl;this.pcol[o+3]=Math.max(60,Math.min(240,alpha));
  }
  /* what a perfectly mixed batch would do, for comparison */
  static batch(cfg,tEnd=900){
    const fake={N:1,n:1,tw:44,d:3.3,h:7,layer:new Uint8Array(1),gf:new Float32Array(1),nc:new Uint8Array(1),nb:new Int32Array(40),x:new Float32Array(1),y:new Float32Array(1),th:0};
    const e=new ChemEngine(fake,cfg,{mixed:true});let Tmax=cfg.T0;
    for(let t=0;t<tEnd;t+=0.05){e.react(0.05);if(e.T[0]>Tmax)Tmax=e.T[0]}
    const m=e.moles(),b=e.bulk();return{moles:m,bulk:b,Tmax,pH:pHOf(b),heatJ:e.heatJ,Vtot:(cfg.A.V+cfg.B.V),esc:e.esc};
  }
}
</script>
