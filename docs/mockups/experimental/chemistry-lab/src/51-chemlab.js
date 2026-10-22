<script>
/* ===== Chemistry lab (experimental, off by default): view and controls ===== */
const CH={on:false,cfg:{A:{id:'hcl',c:.5,V:10},B:{id:'naoh',c:.5,V:10},indicator:'phph',catalyst:false,bath:298.15,T0:298.15},first:'A',scale:30,paused:false,stir:false,hist:[],eng:null,view:null,pred:null,keys:[],lastRec:0,tick:null};
const PRESETS=[
  {n:'Fizz: vinegar and baking soda',cfg:{A:{id:'aceticacid',c:.8,V:12},B:{id:'nahco3',c:.5,V:10},indicator:'uni',catalyst:false},scale:10,
   watch:'Gas bubbles form where the layers meet and rise out. The liquid gets very slightly colder, not warmer.',
   why:'The acid gives a proton to bicarbonate. The carbonic acid that forms is just CO₂ dissolved in water, and the water can only hold about 0.033 mol/L. The rest leaves as bubbles. Making the bubbles takes heat from the liquid (+20.3 kJ/mol), more than the proton transfer gives back (−7.8 kJ/mol), so the net is +12.5 kJ/mol and the tube cools.',
   tryit:['Stir, then watch how much faster the bubbles come.','Raise the bath temperature. CO₂ is less soluble when warm, so more of it leaves.','Swap the order with Pour order.']},
  {n:'Blue gel: copper sulfate and sodium hydroxide',cfg:{A:{id:'cuso4',c:.2,V:10},B:{id:'naoh',c:.4,V:10},indicator:'none',catalyst:false},scale:30,
   watch:'A pale blue solid forms at the boundary and sinks. The blue of the dissolved copper fades as it is used up.',
   why:'Cu(OH)₂ is almost insoluble (Ksp = 2.2×10⁻²⁰). Whenever [Cu²⁺][OH⁻]² is above that number, solid forms until the product drops back to Ksp. Making the solid releases 54.6 kJ/mol.',
   tryit:['Use less NaOH than 0.4 mol/L. Copper is left over, the tube stays blue and the pH ends near 5.','Use more NaOH. The copper is all used and the pH jumps above 12.','Raise the bath temperature. The solid forms just as fast, so the equilibrium barely moves.']},
  {n:'Neutralisation with an indicator',cfg:{A:{id:'hcl',c:.5,V:10},B:{id:'naoh',c:.5,V:10},indicator:'phph',catalyst:false},scale:30,
   watch:'The NaOH layer is pink. As the layers mix and the base is used up, the pink fades. The tube warms.',
   why:'H⁺ + OH⁻ → H₂O is nearly instant, so only mixing limits it. It releases 55.8 kJ/mol, which warms the solution by about 13 K for every mol/L reacted. Phenolphthalein turns pink above pH 8 to 10.',
   tryit:['Set NaOH to 10.5 mL. A faint pink remains: base is in slight excess.','Set NaOH to 9.5 mL. It ends colourless: acid is in excess.','Try the universal indicator to see the pH as a colour.']},
  {n:'White cloud: silver nitrate and salt',cfg:{A:{id:'agno3',c:.1,V:10},B:{id:'nacl',c:.1,V:10},indicator:'none',catalyst:false},scale:30,
   watch:'A white solid appears and drifts down. The liquid stays colourless.',
   why:'AgCl is very insoluble (Ksp = 1.8×10⁻¹⁰), so even small amounts of Ag⁺ and Cl⁻ together form solid. The step releases 65.4 kJ/mol.',
   tryit:['Halve the NaCl. Silver is left over, so the liquid still contains Ag⁺.','Use calcium chloride instead of salt: twice the chloride per mole.']},
  {n:'Catalyst: hydrogen peroxide',cfg:{A:{id:'h2o2',c:.9,V:10},B:{id:'water',c:1,V:10},indicator:'none',catalyst:true},scale:100,
   watch:'Oxygen bubbles rise. The tube warms. The reaction speeds up as it warms, which is thermal feedback.',
   why:'Peroxide decomposes very slowly on its own (Eₐ ≈ 75 kJ/mol). Iodide gives a faster path (Eₐ ≈ 56 kJ/mol). The reaction releases 94.6 kJ/mol, the heat raises k(T), and the rate climbs. Rate = k(T)[I⁻][H₂O₂].',
   tryit:['Turn the catalyst off. The oxygen almost stops.','Raise the bath to 330 K. Every 10 K roughly doubles the rate.','Use 2 mol/L peroxide and watch the temperature.']},
  {n:'Hard water: calcium chloride and sodium carbonate',cfg:{A:{id:'cacl2',c:.2,V:10},B:{id:'na2co3',c:.2,V:10},indicator:'uni',catalyst:false},scale:30,
   watch:'A white solid forms. The liquid is strongly basic (carbonate) and the colour shows it.',
   why:'CaCO₃ has Ksp = 3.4×10⁻⁹. The step takes in about 12.5 kJ/mol, a little heat, so the tube cools slightly. The solid forms because it is favoured by entropy.',
   tryit:['Use equal volumes and strengths. Calcium and carbonate are used up together.','Use more carbonate. The pH rises and calcium is nearly gone.']},
  {n:'Buffer: vinegar and sodium hydroxide',cfg:{A:{id:'aceticacid',c:.8,V:10},B:{id:'naoh',c:.4,V:10},indicator:'uni',catalyst:false},scale:30,
   watch:'Half the acid is neutralised. The pH sits near 4.76, the pKa of acetic acid.',
   why:'Acetic acid is a weak acid. With equal amounts of acid and acetate, the Henderson–Hasselbalch equation gives pH = pKa + log₁₀([A⁻]/[HA]) = pKa. Adding more base or acid then moves the pH only a little: a buffer.',
   tryit:['Add 1 mL more NaOH and compare the pH change with the HCl and NaOH case.','Make the NaOH 0.8 mol/L. All the acid is used and the pH jumps.']}
];
const CHSTYLE=`<style>
#chemsec .cl{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:20px;margin-top:16px}
#chemsec .cp{background:var(--paper);border:1px solid var(--rule);padding:14px}
#chemsec label{font:500 11px var(--mono);letter-spacing:.06em}
#chemsec select,#chemsec input[type=number]{font:500 12px var(--mono);background:var(--chip);color:var(--ink);border:1px solid var(--rule);padding:5px 6px;border-radius:3px;max-width:100%}
#chemsec input[type=range]{width:100%;accent-color:var(--accent)}
#chemsec .rw{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-bottom:10px}
#chemsec .rw>div{min-width:0}
#chemsec .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
#chemsec table{border-collapse:collapse;font:500 12px var(--mono);width:100%}
#chemsec td,#chemsec th{padding:3px 6px;border-bottom:1px solid var(--rule);text-align:right}
#chemsec td:first-child,#chemsec th:first-child{text-align:left}
#chemsec .big{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:12px 0}
#chemsec .big div{background:var(--paper);border:1px solid var(--rule);padding:8px 10px}
#chemsec .big span{display:block;font:500 10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
#chemsec .big b{font:600 20px var(--mono)}
#chemsec .rxn{border-top:1px solid var(--rule);padding:10px 0}
#chemsec .rxn h4{margin:0;font:600 14px var(--mono)}
#chemsec .rxn p{margin:4px 0;font-size:13.5px}
#chemsec .mline{display:none;font:italic 15px var(--serif);color:var(--accent)}
body.math #chemsec .mline{display:block}
#chemsec .ex{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px}
@media (max-width:760px){#chemsec .cl{grid-template-columns:1fr}}
</style>`;
const CMAXV=26;
function chemGeo(){const tw=44,Hh=420,top=18,bot=Hh-22,bodyH=bot-top,r=tw/2,yb=bodyH-r,ppm=550,cap=Math.PI*r*r/2;return{tw,Hh,top,bot,bodyH,r,yb,ppm,cap}}
function chemTubeHTML(){
  const g=chemGeo(),{tw,Hh,top,bodyH,r,yb,ppm,cap}=g,tx=Math.round((150-tw)/2)+14;
  let ticks='';for(let v=0;v<=30;v+=1){const a=v*ppm;if(a<cap)continue;const y=top+yb-(a-cap)/tw;if(y<top-2)break;const mj=v%5===0;ticks+=`<line x1="${tx-(mj?9:5)}" x2="${tx}" y1="${y}" y2="${y}" stroke="#4a5a6a" stroke-width="${mj?1.2:.7}"/>${mj?`<text x="${tx-12}" y="${y+3}" text-anchor="end" font-size="9" fill="#4a5a6a" font-family="IBM Plex Mono">${v} mL</text>`:''}`}
  const scale=`<svg width="150" height="${Hh}" viewBox="0 0 150 ${Hh}" style="position:absolute;left:0;top:0;overflow:visible"><ellipse cx="${tx+r}" cy="${g.bot+6}" rx="${r+8}" ry="5" fill="#0003"/>${ticks}</svg>`;
  const inset=2.4,glass=`<svg width="${tw}" height="${bodyH}" viewBox="0 0 ${tw} ${bodyH}" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none"><path d="M0 0V${yb}A${r} ${r} 0 0 0 ${tw} ${yb}V0Z" fill="#cfe1ea" fill-opacity=".13"/><path d="M${inset} 0V${yb}A${r-inset} ${r-inset} 0 0 0 ${tw-inset} ${yb}V0" fill="none" stroke="#fff" stroke-opacity=".32"/><path d="M0 0V${yb}A${r} ${r} 0 0 0 ${tw} ${yb}V0" fill="none" stroke="#4d6a78" stroke-opacity=".7" stroke-width="1.5"/><ellipse class="rim" cx="${r}" cy="0" rx="${r+2}" ry="4.5" fill="#cfe1ea" fill-opacity=".25" stroke="#4d6a78" stroke-opacity=".75" stroke-width="1.4" style="transform-box:fill-box;transform-origin:center;transform:scaleY(var(--rs))"/></svg>`;
  const lay=(bg,extra='')=>`<div style="position:absolute;inset:0;border-radius:0 0 ${r}px ${r}px;pointer-events:none;${extra}background:${bg}"></div>`;
  const fade='-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 8%,#000 62%,rgba(0,0,0,.5) 86%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 8%,#000 62%,rgba(0,0,0,.5) 86%,transparent 100%);';
  const shade=lay('linear-gradient(90deg,rgba(25,60,75,.4) 0%,rgba(25,60,75,.06) 16%,rgba(25,60,75,0) 30%,rgba(25,60,75,0) 70%,rgba(25,60,75,.08) 82%,rgba(25,60,75,.46) 100%)')+lay('linear-gradient(90deg,transparent calc(var(--hx) - 8%),rgba(255,255,255,.45) calc(var(--hx) - 2.5%),rgba(255,255,255,.9) var(--hx),rgba(255,255,255,.3) calc(var(--hx) + 2.5%),transparent calc(var(--hx) + 8%))',fade+'opacity:var(--si);');
  return `<div style="perspective:700px;width:150px;height:${Hh}px;margin:0 auto"><div class="tb3d" id="chtb" style="position:relative;width:150px;height:${Hh}px;transform-style:preserve-3d;transition:transform .4s cubic-bezier(.2,.7,.1,1);cursor:grab;touch-action:pan-y;--hx:36%;--si:.9;--rs:1">${scale}<div class="tubebody" id="chbody" style="position:absolute;left:${tx}px;top:${top}px;width:${tw}px;height:${bodyH}px;transform-origin:50% 50%"><span id="chcv"></span>${glass}${shade}</div></div></div>`;
}
class ChemView{
  constructor(){this.sc=1.5;this.ph=null;this.eng=null;this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d');this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;border-radius:0 0 22px 22px'}
  setup(ph,eng){this.ph=ph;this.eng=eng;const sc=this.sc,g=chemGeo();this.cw=Math.ceil(g.tw*sc);this.ch=Math.ceil(g.bodyH*sc);this.canvas.width=this.cw;this.canvas.height=this.ch;const n=this.cw*this.ch;this.A=new Float32Array(n);this.R=new Float32Array(n);this.G=new Float32Array(n);this.B=new Float32Array(n);this.L=new Float32Array(n);this.img=this.ctx.createImageData(this.cw,this.ch);this.settling=true}
  applyBody(){if(this.body&&this.ph)this.body.style.transform=`translateY(${this.ph.ty.toFixed(2)}px) rotate(${this.ph.th.toFixed(4)}rad)`}
  render(){
    const ph=this.ph,e=this.eng;if(!ph||!e)return;const {sc,cw,ch,A,R,G,B,L,img}=this,n=ph.n;A.fill(0);R.fill(0);G.fill(0);B.fill(0);L.fill(0);
    const rk=2.3*ph.d*sc,rk2=rk*rk,pc=e.pcol;
    for(let i=0;i<n;i++){
      const cx=ph.x[i]*sc,cy=ph.y[i]*sc,o=i*4,x0=Math.max(0,Math.floor(cx-rk)),x1=Math.min(cw-1,Math.ceil(cx+rk)),y0=Math.max(0,Math.floor(cy-rk)),y1=Math.min(ch-1,Math.ceil(cy+rk));
      for(let yy=y0;yy<=y1;yy++){const dy=yy+.5-cy;for(let xx=x0;xx<=x1;xx++){const dx=xx+.5-cx,q=(dx*dx+dy*dy)/rk2;if(q<1){const w=(1-q)*(1-q),k=yy*cw+xx;A[k]+=w;R[k]+=w*pc[o];G[k]+=w*pc[o+1];B[k]+=w*pc[o+2];L[k]+=w*pc[o+3]}}}
    }
    const d=img.data;
    for(let k=0,m=cw*ch;k<m;k++){
      const a=A[k],o=k*4;if(a<1.8){d[o+3]=0;continue}
      let t=(a-1.8)/.8;t=t>1?1:t;t=t*t*(3-2*t);const inv=1/a;let r=R[k]*inv,g=G[k]*inv,b=B[k]*inv;
      const ed=a<4.2?(1-(a-1.8)/2.4)*.35:0;r+=(255-r)*ed;g+=(255-g)*ed;b+=(255-b)*ed;
      d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=L[k]*inv*t;
    }
    this.ctx.putImageData(img,0,0);
    const c=this.ctx;c.lineWidth=1;
    for(let i=0;i<n;i++){const gs=e.gas[i];if(gs>.02){const rr=(1+9*Math.min(.5,gs))*sc;c.beginPath();c.arc(ph.x[i]*sc,ph.y[i]*sc,rr,0,6.2832);c.fillStyle='rgba(255,255,255,.5)';c.fill();c.strokeStyle='rgba(255,255,255,.9)';c.stroke()}}
  }
}
function chemStart(){
  const g=chemGeo(),cfg=JSON.parse(JSON.stringify(CH.cfg));
  if(CH.first==='B'){const t=cfg.A;cfg.A=cfg.B;cfg.B=t}
  cfg.T0=CH.cfg.bath;cfg.bath=CH.cfg.bath;
  const A=cfg.A.V*g.ppm,B=cfg.B.V*g.ppm;
  const ph=new TubePhysics({mat:'liquid',tw:g.tw,H:g.bodyH,layers:[{c:'#fff',v:Math.max(60,A-g.cap)},{c:'#fff',v:B}]});
  ph.chem=true;
  const eng=new ChemEngine(ph,cfg);eng.Tpeak=cfg.T0;
  CH.pred=ChemEngine.batch(cfg,900);
  const ign=['Na+','K+','SO4','NO3-','H2O'],rows=[];
  for(let s=0;s<NS;s++){if(ign.includes(SPN[s]))continue;const a=eng.init[s],b=CH.pred.moles[s];if(Math.max(a,b)>2e-4)rows.push(s)}
  CH.keys=rows.slice(0,6);CH.hist=[];CH.lastRec=-1;CH.eng=eng;CH.cfgRun=cfg;
  const orig=ph.frame.bind(ph);
  ph.frame=function(dt){
    ph.asleep=false;ph.rest=0;
    if(CH.paused)return;
    if(CH.stir)ph.stir(performance.now()/1000);
    orig(dt);ph.asleep=false;ph.rest=0;eng.step(dt*CH.scale);
    const a=eng.avgT();if(a.avg>eng.Tpeak)eng.Tpeak=a.avg;
    if(eng.t-CH.lastRec>=Math.max(.5,CH.scale/30)){CH.lastRec=eng.t;const b=eng.bulk(),m=eng.moles(),rec={t:eng.t,T:a.avg,pH:pHOf(b),sp:{}};CH.keys.forEach(s=>rec.sp[s]=m[s]*1000);if(CH.hist.length<700)CH.hist.push(rec)}
  };
  CH.view.setup(ph,eng);SIMS.set('chem',CH.view);
  const box=document.getElementById('chtb');if(box){box._sim=CH.view;CH.view.body=document.getElementById('chbody');const sp=document.getElementById('chcv');if(sp)sp.replaceWith(CH.view.canvas)}
  chemReadouts();
}
function chemFmt(n,d=2){return Math.abs(n)<1e-9?'0':n.toFixed(d)}
function chemReadouts(){
  const e=CH.eng;if(!e||!CH.on)return;
  const a=e.avgT(),b=e.bulk(),m=e.moles(),el=e.elements();let drift=0;for(const k in e.initElements)drift=Math.max(drift,Math.abs(el[k]-e.initElements[k])/Math.max(1e-12,e.initElements[k]));
  const gasMol=m[SI['CO2g']]+m[SI['O2g']],gasmL=gasMol*0.08206*a.avg*1000,solidG=m[SI['CuOH2s']]*MOLAR.CuOH2s+m[SI['AgCls']]*MOLAR.AgCls+m[SI['CaCO3s']]*MOLAR.CaCO3s;
  const mm=Math.floor(e.t/60),ss=Math.floor(e.t%60);
  const set=(id,h)=>{const el=document.getElementById(id);if(el)el.innerHTML=h};
  set('chbig',`<div><span>Chemistry clock</span><b>${mm}:${String(ss).padStart(2,'0')}</b></div><div><span>Temperature</span><b>${(a.avg-273.15).toFixed(1)} °C</b></div><div><span>Peak so far</span><b>${(e.Tpeak-273.15).toFixed(1)} °C</b></div><div><span>pH (bulk)</span><b>${pHOf(b).toFixed(2)}</b></div><div><span>Gas released</span><b>${gasmL.toFixed(1)} mL</b></div><div><span>Solid formed</span><b>${solidG.toFixed(3)} g</b></div><div><span>Heat released</span><b>${(e.heatJ/1000).toFixed(2)} kJ</b></div>`);
  const rows=CH.keys.map(s=>`<tr><td>${SPDISPLAY[SPN[s]]}</td><td>${chemFmt(e.init[s]*1000)}</td><td>${chemFmt(m[s]*1000)}</td><td>${chemFmt(CH.pred.moles[s]*1000)}</td></tr>`).join('');
  const used=[],left=[];for(let s=0;s<NS;s++){if(['Na+','K+','SO4','NO3-','H2O','Cl-'].includes(SPN[s]))continue;const i0=e.init[s],f0=CH.pred.moles[s];if(i0>2e-4){if(f0<i0*.02)used.push(SPDISPLAY[SPN[s]]);else if(f0<i0*.98)left.push(SPDISPLAY[SPN[s]])}}
  set('chtab',`<table><tr><th>mmol</th><th>start</th><th>now</th><th>if perfectly mixed</th></tr>${rows}</table><p style="font:500 12px var(--mono);margin:8px 0 0">Used up when fully mixed: ${used.join(', ')||'none'}. Partly left: ${left.join(', ')||'none'}.<br>Perfect-mixing prediction: peak ${(CH.pred.Tmax-273.15).toFixed(1)} °C, final pH ${CH.pred.pH.toFixed(2)}.<br>Atoms conserved: largest drift ${drift.toExponential(1)} (relative).</p>`);
  let w='';for(const k in RX){if(e.cnt[k]>1e-7){const r=RX[k];w+=`<div class="rxn"><h4>${r.eq}</h4><p style="font:500 11px var(--mono);color:var(--dim)">${r.kind} · ΔH = ${(r.dH/1000).toFixed(1)} kJ/mol · ${(e.cnt[k]*1000).toFixed(2)} mmol so far · ${(-r.dH*e.cnt[k]/1000).toFixed(2)} kJ ${r.dH<0?'released':'absorbed'}</p><p>${r.why}</p><p class="mline">${r.math}</p></div>`}}
  const notes=chemNotes();
  set('chwhy',(w||'<p style="color:var(--dim)">No reaction yet. The layers have to mix first. Stir, or tilt and shake the tube.</p>')+notes);
  chemPlot();
}
function chemNotes(){
  const c=CH.cfg,ids=[c.A.id,c.B.id],has=(a,b)=>ids.includes(a)&&ids.includes(b);let n='';
  if(has('agno3','naoh')||has('agno3','na2co3'))n+='silver oxide or silver carbonate would form. Not modelled. ';
  if(has('cuso4','na2co3')||has('cuso4','nahco3'))n+='basic copper carbonate would form. Not modelled. ';
  if(has('hcl','na2co3'))n+='the second proton step to CO₂ is modelled, but real carbonate in excess acid also fizzes at the surface. ';
  if(has('cacl2','naoh'))n+='calcium hydroxide would form at higher strength. Not modelled. ';
  return n?`<p style="font:500 12px var(--mono);color:var(--dim)">Limits for this pair: ${n}</p>`:'';
}
function chemPlot(){
  const h=CH.hist,host=document.getElementById('chplot');if(!host||h.length<2)return;
  const W=520,H=170,L=44,Bt=22,tmax=h[h.length-1].t;let ymax=1e-6;h.forEach(r=>CH.keys.forEach(s=>ymax=Math.max(ymax,r.sp[s])));
  const X=t=>L+t/Math.max(1,tmax)*(W-L-8),Y=v=>H-Bt-v/ymax*(H-Bt-8);
  const colors=['#2c5b8c','#c0506a','#3f9a7a','#8a5ab4','#d08a5a','#555'];
  let s=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;font-family:IBM Plex Mono"><rect x="${L}" y="8" width="${W-L-8}" height="${H-Bt-8}" fill="none" stroke="var(--rule)"/>`;
  [0,.5,1].forEach(f=>{s+=`<text x="${L-4}" y="${Y(ymax*f)+3}" text-anchor="end" font-size="9" fill="var(--dim)">${(ymax*f).toFixed(1)}</text>`});
  s+=`<text x="${L}" y="${H-6}" font-size="9" fill="var(--dim)">0</text><text x="${W-8}" y="${H-6}" text-anchor="end" font-size="9" fill="var(--dim)">${Math.round(tmax)} s of chemistry</text><text x="4" y="12" font-size="9" fill="var(--dim)">mmol</text>`;
  CH.keys.forEach((k,i)=>{s+=`<polyline fill="none" stroke="${colors[i%6]}" stroke-width="2" points="${h.map(r=>X(r.t).toFixed(1)+','+Y(r.sp[k]).toFixed(1)).join(' ')}"/>`});
  s+='</svg><div style="display:flex;flex-wrap:wrap;gap:4px 14px;font:500 11px var(--mono)">'+CH.keys.map((k,i)=>`<span><i style="display:inline-block;width:10px;height:3px;background:${colors[i%6]};margin-right:5px;vertical-align:middle"></i>${SPDISPLAY[SPN[k]]}</span>`).join('')+'</div>';
  const tmin=Math.min(CH.cfgRun.bath,...h.map(r=>r.T))-.2,tmx=Math.max(CH.cfgRun.bath,...h.map(r=>r.T))+.2,TY=v=>96-(v-tmin)/(tmx-tmin)*84;
  s+=`<svg viewBox="0 0 ${W} 100" style="width:100%;display:block;margin-top:10px;font-family:IBM Plex Mono"><rect x="${L}" y="6" width="${W-L-8}" height="92" fill="none" stroke="var(--rule)"/><text x="${L-4}" y="14" text-anchor="end" font-size="9" fill="var(--dim)">${(tmx-273.15).toFixed(1)}</text><text x="${L-4}" y="96" text-anchor="end" font-size="9" fill="var(--dim)">${(tmin-273.15).toFixed(1)}</text><text x="4" y="12" font-size="9" fill="var(--dim)">°C</text><line x1="${L}" x2="${W-8}" y1="${TY(CH.cfgRun.bath)}" y2="${TY(CH.cfgRun.bath)}" stroke="var(--dim)" stroke-dasharray="3 3"/><polyline fill="none" stroke="#d6402f" stroke-width="2" points="${h.map(r=>X(r.t).toFixed(1)+','+TY(r.T).toFixed(1)).join(' ')}"/></svg><div style="font:500 11px var(--mono)">Average temperature (red) and the bath (dashed)</div>`;
  host.innerHTML=s;
}
function chemUI(){
  const opts=id=>Object.keys(REAGENTS).map(k=>`<option value="${k}"${k===id?' selected':''}>${REAGENTS[k].name} (${REAGENTS[k].f})</option>`).join('');
  const side=(key,label)=>{const r=CH.cfg[key],R=REAGENTS[r.id];return `<div><label>${label}</label><br><select id="ch${key}id">${opts(r.id)}</select><br><label>Strength <span id="ch${key}cv">${r.c.toFixed(2)}</span> mol/L</label><input type="range" id="ch${key}c" min="${R.c[0]}" max="${R.c[1]}" step="0.01" value="${r.c}"><label>Volume <span id="ch${key}vv">${r.V}</span> mL</label><input type="range" id="ch${key}v" min="3" max="20" step="0.5" value="${r.V}"></div>`};
  return `${CHSTYLE}<div class="cl"><div class="cp" style="padding:8px 4px">${chemTubeHTML()}<div class="btns" style="justify-content:center"><button class="chip" id="chstir" title="Hold to run the magnetic stirrer">Stir (hold)</button><button class="chip" id="chpause">Pause</button></div><p style="font:500 11px var(--mono);color:var(--dim);text-align:center;margin:8px 8px 0">Drag the tube to tilt and shake it. Hover to turn it.</p></div>
  <div><div class="cp"><div class="lab" style="margin-bottom:8px">Try this</div><div class="btns" style="margin:0 0 12px" id="chpre">${PRESETS.map((p,i)=>`<button class="chip" data-pre="${i}">${p.n}</button>`).join('')}</div>
   <div class="rw">${side('A','Reagent A')}${side('B','Reagent B')}</div>
   <div class="rw"><div><label>Pour order</label><br><select id="chfirst"><option value="A">A at the bottom, B poured on top</option><option value="B">B at the bottom, A poured on top</option></select></div><div><label>Indicator</label><br><select id="chind"><option value="none">None</option><option value="phph">Phenolphthalein (pink above pH 9)</option><option value="btb">Bromothymol blue (yellow to blue)</option><option value="uni">Universal indicator</option></select></div></div>
   <div class="rw"><div><label>Bath temperature <span id="chbv"></span></label><input type="range" id="chbath" min="275" max="350" step="1"></div><div><label>Chemistry speed</label><br><select id="chscale"><option value="1">1× (real time)</option><option value="10">10×</option><option value="30">30×</option><option value="100">100×</option><option value="300">300×</option></select></div></div>
   <label><input type="checkbox" id="chcat"> Add potassium iodide as a catalyst (0.05 mol/L)</label>
   <div class="btns"><button class="chip on" id="chpour">Pour and start</button></div></div>
   <div class="big" id="chbig"></div></div></div>
   <div class="ex"><div class="cp"><div class="lab" style="margin-bottom:6px">What to watch</div><p id="chwatch" style="margin:0"></p><div class="lab" style="margin:10px 0 4px">Try changing</div><ul id="chtry" style="margin:0;padding-left:18px;font-size:13.5px"></ul></div><div class="cp"><div class="lab" style="margin-bottom:6px">Amounts</div><div id="chtab"></div></div></div>
   <div class="ex"><div class="cp"><div class="lab" style="margin-bottom:6px">Concentrations and temperature over time</div><div id="chplot"></div></div><div class="cp"><div class="lab" style="margin-bottom:6px">What is happening, and why</div><div id="chwhy"></div></div></div>
   <p style="font:500 12px/1.6 var(--mono);color:var(--dim);margin-top:14px;max-width:80ch">How it works: the liquid is a particle fluid. Each particle is a small parcel of solution that carries concentrations of 24 species and a temperature. Parcels move with the flow, exchange species by diffusion (real coefficients) and heat by conduction, react by instant ionic steps, solubility products or Arrhenius rate laws, and heat or cool by their reaction enthalpy. Dissolved gas above its solubility becomes bubbles that rise and leave. Enthalpies are rounded textbook values. Rates of slow reactions are calibrated for a readable time scale. Colours use Beer–Lambert with tuned absorptivities. pH is approximate and ignores activity. Turn on Show the math for each equation.</p>`;
}
function chemApplyForm(){
  const c=CH.cfg,$i=id=>document.getElementById(id);
  ['A','B'].forEach(k=>{$i('ch'+k+'id').value=c[k].id;const R=REAGENTS[c[k].id];const s=$i('ch'+k+'c');s.min=R.c[0];s.max=R.c[1];s.value=c[k].c;$i('ch'+k+'cv').textContent=(+c[k].c).toFixed(2);$i('ch'+k+'v').value=c[k].V;$i('ch'+k+'vv').textContent=c[k].V});
  $i('chind').value=c.indicator;$i('chcat').checked=!!c.catalyst;$i('chbath').value=c.bath;$i('chbv').textContent=Math.round(c.bath)+' K ('+Math.round(c.bath-273.15)+' °C)';$i('chscale').value=String(CH.scale);$i('chfirst').value=CH.first;
}
function chemPreset(i){
  const p=PRESETS[i],c=CH.cfg;c.A=JSON.parse(JSON.stringify(p.cfg.A));c.B=JSON.parse(JSON.stringify(p.cfg.B));c.indicator=p.cfg.indicator;c.catalyst=p.cfg.catalyst;c.bath=298.15;CH.scale=p.scale;CH.first='A';
  chemApplyForm();document.getElementById('chwatch').textContent=p.watch+' '+p.why;document.getElementById('chtry').innerHTML=p.tryit.map(t=>`<li>${t}</li>`).join('');chemStart();
}
function chemBuild(){
  const host=document.getElementById('chemlab');host.innerHTML=chemUI();CH.view=CH.view||new ChemView();
  const $i=id=>document.getElementById(id);
  ['A','B'].forEach(k=>{
    $i('ch'+k+'id').addEventListener('change',e=>{CH.cfg[k].id=e.target.value;const R=REAGENTS[e.target.value];CH.cfg[k].c=R.c[2];chemApplyForm()});
    $i('ch'+k+'c').addEventListener('input',e=>{CH.cfg[k].c=+e.target.value;$i('ch'+k+'cv').textContent=(+e.target.value).toFixed(2)});
    $i('ch'+k+'v').addEventListener('input',e=>{let v=+e.target.value;const o=k==='A'?'B':'A';if(v+CH.cfg[o].V>CMAXV){v=CMAXV-CH.cfg[o].V;e.target.value=v}CH.cfg[k].V=v;$i('ch'+k+'vv').textContent=v});
  });
  $i('chind').addEventListener('change',e=>{CH.cfg.indicator=e.target.value});
  $i('chcat').addEventListener('change',e=>{CH.cfg.catalyst=e.target.checked});
  $i('chbath').addEventListener('input',e=>{CH.cfg.bath=+e.target.value;$i('chbv').textContent=Math.round(CH.cfg.bath)+' K ('+Math.round(CH.cfg.bath-273.15)+' °C)'});
  $i('chscale').addEventListener('change',e=>{CH.scale=+e.target.value});
  $i('chfirst').addEventListener('change',e=>{CH.first=e.target.value});
  $i('chpour').addEventListener('click',chemStart);
  $i('chpause').addEventListener('click',e=>{CH.paused=!CH.paused;e.target.textContent=CH.paused?'Resume':'Pause'});
  const st=$i('chstir');st.addEventListener('pointerdown',()=>{CH.stir=true;st.classList.add('on')});['pointerup','pointerleave','pointercancel'].forEach(ev=>st.addEventListener(ev,()=>{CH.stir=false;st.classList.remove('on')}));
  $i('chpre').addEventListener('click',e=>{const b=e.target.closest('[data-pre]');if(b)chemPreset(+b.dataset.pre)});
  chemApplyForm();chemPreset(0);
}
function chemToggle(on){
  CH.on=on;const host=document.getElementById('chemlab');host.hidden=!on;
  if(on){if(!host.firstChild)chemBuild();else chemStart();CH.tick=setInterval(chemReadouts,300)}
  else{clearInterval(CH.tick);SIMS.delete('chem')}
}
(function(){const sw=document.getElementById('chemsw');if(sw)sw.addEventListener('change',e=>chemToggle(e.target.checked))})();
</script>
