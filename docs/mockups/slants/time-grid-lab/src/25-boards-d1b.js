<script>
/* ---------------- 1D Day Tubes (liquid and sand, optional) ---------------- */
const mat_ok=m=>m==='liquid'||m==='sand';
const hhmm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');
/* Scope data: a week or a 4-week month poured into one tube. Only Oct 19-25 is real; other weeks are scaled copies so the lab has something to show. */
const WK0=new Date(2026,9,19),mon3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const wkDate=(off,add=0)=>{const x=new Date(WK0.getTime()+(off*7+add)*864e5);return mon3[x.getMonth()]+' '+x.getDate()};
const hsh=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
const wkF=(off,k)=>off===0?1:(.55+.8*hsh(off,0))*(.6+.8*hsh(off,String(k).length*7+String(k).charCodeAt(0)));
let TUBEN=0;
const clockLabel=(T,m)=>{m=Math.max(0,Math.min(T-1,Math.floor(m)));const d=Math.floor(m/1440),h=hhmm(m%1440);return T<=1440?h:T<=10080?DAYS[d][0]+' '+h:'Wk '+(Math.floor(d/7)+1)+' '+DAYS[d%7][0]+' '+h};
/* every tracked run in a period, with its minute counted from the start of the period (a) and a scale for the mock weeks (f) */
function periodRuns(view,offs,days){
  const out=[];offs.forEach((o,wi)=>days.forEach((d,di)=>rawRuns(view,d).forEach(q=>out.push({k:q.k,s:q.s,e:q.e,a:(wi*days.length+di)*1440+q.s,f:wkF(o,q.k),dl:DAYS[d][0]+', '+wkDate(o,d)}))));
  return out.sort((x,y)=>x.a-y.a);
}
function layersOf(view,runs){   /* grouped by pen (largest first) or kept in time order */
  const P=PAL[view]||{},bk=q=>({s:q.s,e:q.e,dl:q.dl});let L;
  if(S.lay==='time'){L=[];runs.forEach(q=>{const l=L[L.length-1],m=(q.e-q.s)*q.f;if(l&&l.k===q.k){l.m+=m;l.b.push(bk(q))}else L.push({k:q.k,m,b:[bk(q)]})})}
  else{const t={};runs.forEach(q=>{const l=t[q.k]=t[q.k]||{k:q.k,m:0,b:[]};l.m+=(q.e-q.s)*q.f;l.b.push(bk(q))});L=Object.values(t).sort((x,y)=>y.m-x.m)}
  return L.filter(l=>l.m>0&&P[l.k]);
}
function mkScope(view,offs,days,o){
  const runs=periodRuns(view,offs,days),L=layersOf(view,runs),T=1440*days.length*offs.length;
  return{view,runs,L,sum:L.reduce((a,l)=>a+l.m,0),cap:T,T,...o};
}
const ALLD=[0,1,2,3,4,5,6],hrTicks=[0,6,12,18,24].map(h=>({f:h/24,l:h+'h'})),
  wkTicks=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((n,i)=>({f:i/7,l:n})).concat([{f:1,l:''}]),moTicks=[0,1,2,3,4].map(i=>({f:i/4,l:'wk '+(i+1)}));
function dayScope(d,W,tw){return mkScope(S.view,[0],[d],{lab:'',abbr:DAYS[d][0].toUpperCase(),ticks:hrTicks,tw,W,tl:true})}
function scopeSpecs(){
  let sc=S.scope;const mu=S.multi;if(mu){if(sc==='weeks')sc='week';if(sc==='months')sc='month'}
  const wl=o=>wkDate(o)+' – '+wkDate(o,6),mo=o=>wkDate(o[0])+' – '+wkDate(o[3],6),out=[],W=mu?162:300,tw=mu?50:S.shape==='hourglass'?72:64;
  const VS=mu?VIEWS.map(v=>v[0]):[S.view],pre=v=>mu?VNAME[v]+' · ':'';
  VS.forEach(v=>{
    if(sc==='days')out.push(mkScope(v,[0],[S.day],{lab:pre(v)+DAYS[S.day][0]+' '+DAYS[S.day][1],abbr:DAYS[S.day][0].toUpperCase(),ticks:hrTicks,tw,W,tl:true}));
    else if(sc==='week')out.push(mkScope(v,[0],ALLD,{lab:pre(v)+wl(0),abbr:'WEEK',ticks:wkTicks,tw,W,tl:true}));
    else if(sc==='weeks')[-2,-1,0,1].forEach(o=>out.push(mkScope(v,[o],ALLD,{lab:wl(o),abbr:'WK',ticks:wkTicks,tw:56,W:230})));
    else if(sc==='month')out.push(mkScope(v,[-2,-1,0,1],ALLD,{lab:pre(v)+mo([-2,-1,0,1]),abbr:'MONTH',ticks:moTicks,tw,W,tl:true}));
    else[-2,-1,0].forEach(m=>{const o=[0,1,2,3].map(i=>m*4-2+i);out.push(mkScope(v,o,ALLD,{lab:mo(o),abbr:'MONTH',ticks:moTicks,tw:60,W:300}))});
  });
  return out;
}
/* The replay transport: clock, a strip of the period with a playhead, play and restart, speed. One clock drives every hourglass on the board. */
function hgPanel(o,cmp){
  const T=o.T,cur=Math.floor(Math.min(T-1,S.hg.clock||0)),pw=cmp?400:340,sp=[10,30,60,120],si=Math.max(0,sp.indexOf(S.hg.speed));
  const lab=T<=1440?[['12a',0],['6a',.25],['12p',.5],['6p',.75],['12a',1]]:T<=10080?DAYS.map((d,i)=>[d[0],i/7]).concat([['',1]]):[1,2,3,4].map(i=>['Wk'+i,(i-1)/4]).concat([['',1]]);
  const P=PAL[o.view]||{},runs=S.multi?'':o.runs.map(q=>`<rect x="${q.a}" width="${q.e-q.s}" height="12" fill="${P[q.k]?P[q.k][1]:'#888'}"/>`).join('');
  const pb=S.hg.playing?'<svg viewBox="0 0 16 16" style="width:18px;height:18px"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>':'<svg viewBox="0 0 16 16" style="width:18px;height:18px"><path d="M4 2.5l9 5.5-9 5.5z" fill="currentColor"/></svg>';
  const clk=`<div><div class="lab" id="hgday" style="min-height:14px">${esc(T>1440?clockLabel(T,cur).replace(/ \d\d:\d\d$/,''):'Day replay')}</div><div id="hgclock" style="margin:2px 0">${seg7(hhmm(cur%1440),{w:cmp?18:26,h:cmp?32:44,gap:cmp?7:9,sw:cmp?3:4,on:'#0b5a4a',off:'#0b5a4a18'})}</div></div>`;
  const strip=`<div style="width:${pw}px"><div style="position:relative;height:30px"><svg viewBox="0 0 ${T} 12" preserveAspectRatio="none" style="position:absolute;left:0;top:9px;width:${pw}px;height:12px;background:#dbe3e8">${runs}</svg><div id="hgph" style="position:absolute;top:2px;bottom:2px;width:2px;background:#d6402f;left:${(cur/T*pw).toFixed(1)}px"></div><input id="hgscrub" data-hgscrub="1" type="range" min="0" max="${T-1}" step="1" value="${cur}" aria-label="Time in the period" style="position:absolute;left:0;top:0;width:${pw}px;height:30px;margin:0;opacity:0;cursor:ew-resize"></div><div style="display:flex;justify-content:space-between;font:500 10px var(--mono);opacity:.7">${lab.map(q=>`<span>${q[0]}</span>`).join('')}</div></div>`;
  const ctl=`<div style="display:flex;align-items:center;gap:12px"><button class="k${S.hg.playing?' on':''}" data-hg="play" aria-label="${S.hg.playing?'Pause':'Play'}" style="width:44px;height:44px;border-radius:50%;justify-content:center;padding:0">${pb}</button><button class="k" data-hg="restart" aria-label="Back to the start" style="width:34px;height:34px;border-radius:50%;justify-content:center;padding:0"><svg viewBox="0 0 16 16" style="width:15px;height:15px"><path d="M3 3h2v10H3zM13 3v10L6 8z" fill="currentColor"/></svg></button><label style="font:500 10px var(--mono);letter-spacing:.1em;min-width:120px">SPEED <b id="hgsv" style="font-weight:600">${Math.round(1440/sp[si])} s per period</b><input type="range" min="0" max="3" step="1" value="${si}" data-hgspeed="1" aria-label="Replay speed" style="width:100%;accent-color:#1d2733;display:block"><span style="display:flex;justify-content:space-between;opacity:.65"><span>slow</span><span>fast</span></span></label></div>`;
  return cmp?`<div style="display:flex;align-items:center;gap:22px">${clk}${strip}${ctl}</div>`:`${clk}<div style="max-width:340px;margin:6px 0 12px">${strip}<div style="margin-top:8px">${ctl}</div></div>`;
}
function tube(d,mat,W,Hh,o){
  const hg=S.shape==='hourglass',closed=S.ends!=='open'||hg;
  if(!o&&hg&&mat==='sand'&&S.span==='day')o=dayScope(d,W,72);   /* the hourglass day replay is a scope of one day */
  const tl=hg&&mat==='sand'&&!!(o&&o.tl);
  const tw=o?o.tw:hg?(W>250?60:52):(W>250?64:44),r=tw/2,tx=Math.round((W-tw)/2)+10,top=18,bot=Hh-22,yb=bot-r,ih=yb-top,bodyH=bot-top;
  let L;
  if(o)L=o.L;
  else if(S.lay==='time'){L=[];rawRuns(S.view,d).forEach(q=>{const l=L[L.length-1];if(l&&l.k===q.k){l.m+=q.e-q.s;l.b.push({s:q.s,e:q.e})}else L.push({k:q.k,m:q.e-q.s,b:[{s:q.s,e:q.e}]})})}
  else L=totals([d]).list.filter(p=>p.m).map(p=>({k:p.k,m:p.m,b:rawRuns(S.view,d).filter(q=>q.k===p.k).map(q=>({s:q.s,e:q.e}))}));
  const P=PAL[(o&&o.view)||S.view]||{},sum=L.reduce((a,l)=>a+l.m,0),CAP=o?o.cap:1440;
  const spec={mat,day:o&&o.T>1440?-1:d,lab:o?o.lab:'',tw,H:bodyH,d:mat==='sand'?S.grain:undefined,shape:hg?'hourglass':'tube',closed,layers:L.map(l=>({c:mat==='sand'?mix(P[l.k][1],'#c9b89a',.25):mix(P[l.k][1],'#ffffff',.12),v:Math.round(tw*(l.m/CAP*ih)*10)/10,n:P[l.k][0],m:l.m,blocks:l.b}))};
  spec.mix=S.mix;if(S.zg&&!hg&&sum)spec.zg={y0:ih,ih,cap:CAP};
  if(tl&&sum){   /* hourglass replay: one grain per tracked minute (or per few minutes in a long period), coloured by that minute's pen */
    const pens=[...new Set(o.runs.map(q=>q.k))],idx={};
    spec.layers=pens.map((k,i)=>{idx[k]=i;const bl=o.runs.filter(q=>q.k===k).map(q=>({s:q.s,e:q.e,dl:q.dl,a:q.a}));return{c:mix(P[k][1],'#c9b89a',.25),v:0,n:P[k][0],m:bl.reduce((a,q)=>a+(q.e-q.s)*q.f,0),blocks:bl}});
    const tot=o.runs.reduce((a,q)=>a+(q.e-q.s)*q.f,0),pr=[];let gm=Math.max(.2,tot/(S.multi?1200:3800));if(gm>1)gm=Math.ceil(gm);
    o.runs.forEach(q=>{const st=gm/q.f;for(let m=0;m<q.e-q.s;m+=st)pr.push([q.a+m,idx[q.k]])});
    pr.sort((x,y)=>x[0]-y[0]);
    spec.timeline={layer:pr.map(x=>x[1]),mins:pr.map(x=>x[0]),start:S.hg.start||0,T:o.T,gm};
    const A=makeProfile('hourglass',true,tw,bodyH,3).lowerArea();spec.d=Math.max(.95,Math.min(3,Math.sqrt(.6*A/(0.93*Math.max(1,pr.length)))));
  }
  const prof=makeProfile(spec.shape,closed,tw,bodyH,spec.d||3.3),poly=prof.poly();
  let ticks='';if(o&&!hg)o.ticks.forEach(t=>{const yy=top+bodyH-r-t.f*ih;ticks+=`<line x1="${tx-9}" x2="${tx}" y1="${yy}" y2="${yy}" stroke="#4a5a6a" stroke-width="1.2"/>${t.l?`<text x="${tx-12}" y="${yy+(t.f<1?-3:3)}" text-anchor="end" font-size="9" fill="#4a5a6a" font-family="IBM Plex Mono">${t.l}</text>`:''}`});else if(!hg&&!o)for(let hr=0;hr<=24;hr++){const yy=top+bodyH-r-hr/24*ih,mj=hr%6===0;ticks+=`<line x1="${tx-(mj?9:5)}" x2="${tx}" y1="${yy}" y2="${yy}" stroke="#4a5a6a" stroke-width="${mj?1.2:.7}"/>${mj?`<text x="${tx-12}" y="${yy+3}" text-anchor="end" font-size="9" fill="#4a5a6a" font-family="IBM Plex Mono">${hr}h</text>`:''}`}
  const nowl=!hg&&!o&&isToday(d)?`<line x1="${tx-9}" x2="${tx+tw+6}" y1="${top+bodyH-r-NOW.min/1440*ih}" y2="${top+bodyH-r-NOW.min/1440*ih}" stroke="#d6402f" stroke-dasharray="3 3"/>`:'';
  const scale=`<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="position:absolute;left:0;top:0;display:block;overflow:visible"><ellipse cx="${tx+r}" cy="${bot+6}" rx="${r+8}" ry="5" fill="#0003"/>${ticks}${nowl}</svg>`;
  const capc=L.length?mix(P[L[0].k][1],'#101830',.25):'#1d3cc0',gid='cg'+(++TUBEN),cd=mix(capc,'#000000',.55),cl=mix(capc,'#ffffff',.5),ab3=o?o.abbr:DAYS[d][0].toUpperCase();
  const cap=!hg?'':`<defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" stop-color="#3d4750"/><stop offset=".1" stop-color="#e6edf1"/><stop offset=".24" stop-color="#8794a0"/><stop offset=".42" stop-color="#fbfdfe"/><stop offset=".58" stop-color="#a7b3bc"/><stop offset=".82" stop-color="#5a6670"/><stop offset=".94" stop-color="#c9d3da"/><stop offset="1" stop-color="#36404a"/></linearGradient><linearGradient id="${gid}v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".38" stop-color="#fff" stop-opacity=".05"/><stop offset=".5" stop-color="#0b1218" stop-opacity=".45"/><stop offset=".62" stop-color="#0b1218" stop-opacity=".05"/><stop offset=".85" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#0b1218" stop-opacity=".35"/></linearGradient><linearGradient id="${gid}p" x1="0" x2="1"><stop offset="0" stop-color="#5d6a74"/><stop offset=".3" stop-color="#f4f8fa"/><stop offset=".62" stop-color="#a9b5be"/><stop offset="1" stop-color="#55626c"/></linearGradient></defs>`+
   [-8.5,tw+3.5].map(x=>`<rect x="${x}" y="0" width="5" height="${bodyH}" rx="2.5" fill="url(#${gid}p)"/>`).join('')+
   `<rect x="-9" y="-14" width="${tw+18}" height="17" rx="3" fill="url(#${gid})"/><rect x="-9" y="1" width="${tw+18}" height="2" fill="#000" fill-opacity=".3"/><rect x="-17" y="-23" width="${tw+34}" height="10" rx="5" fill="url(#${gid})"/><rect x="-14" y="-22" width="${tw+28}" height="2.5" rx="1.2" fill="#fff" fill-opacity=".45"/><text x="${r}" y="-5" text-anchor="middle" font-size="9" font-weight="700" fill="#27323c" font-family="Archivo,sans-serif" letter-spacing="1.2" style="paint-order:stroke;stroke:#ffffffaa;stroke-width:.6px">${ab3}</text>`+
   `<rect x="-9" y="${bodyH-3}" width="${tw+18}" height="17" rx="3" fill="url(#${gid})"/><rect x="-9" y="${bodyH-3}" width="${tw+18}" height="2" fill="#000" fill-opacity=".3"/><rect x="-17" y="${bodyH+10}" width="${tw+34}" height="10" rx="5" fill="url(#${gid})"/><rect x="-14" y="${bodyH+11}" width="${tw+28}" height="2.5" rx="1.2" fill="#fff" fill-opacity=".4"/>`;
  const capx=cap&&cap.replace(/<rect ([^>]*?)fill="url\(#cg\d+\)"\/>/g,(m,at)=>m+`<rect ${at}fill="url(#${gid}v)"/>`);
  const rim=closed?'':`<ellipse class="rim" cx="${r}" cy="0" rx="${r+1.5}" ry="4" fill="#cfe1ea" fill-opacity=".1" stroke="#4d6a78" stroke-opacity=".38" stroke-width="1" style="transform-box:fill-box;transform-origin:center;transform:scaleY(var(--rs))"/>`;
  const glass=`<svg width="${tw}" height="${bodyH}" viewBox="0 0 ${tw} ${bodyH}" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none"><path d="${prof.path()}" fill="#cfe1ea" fill-opacity=".13"/><path d="${prof.path(2.4,true)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1"/><path d="${closed?prof.path():prof.path(0,true)}" fill="none" stroke="#4d6a78" stroke-opacity=".7" stroke-width="1.5"/>${rim}</svg>`;
  const shell=`<svg width="${tw}" height="${bodyH}" viewBox="0 0 ${tw} ${bodyH}" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none">${capx}</svg>`;
  const lay=(bg,extra='')=>`<div style="position:absolute;inset:0;clip-path:polygon(${poly});pointer-events:none;${extra}background:${bg}"></div>`;
  const fade='-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 8%,#000 62%,rgba(0,0,0,.5) 86%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 8%,#000 62%,rgba(0,0,0,.5) 86%,transparent 100%);';
  const shade=
    lay('linear-gradient(90deg,rgba(25,60,75,.4) 0%,rgba(25,60,75,.06) 16%,rgba(25,60,75,0) 30%,rgba(25,60,75,0) 70%,rgba(25,60,75,.08) 82%,rgba(25,60,75,.46) 100%)')+
    lay('linear-gradient(90deg,transparent calc(var(--hx) - 8%),rgba(255,255,255,.45) calc(var(--hx) - 2.5%),rgba(255,255,255,.9) var(--hx),rgba(255,255,255,.3) calc(var(--hx) + 2.5%),transparent calc(var(--hx) + 8%)),linear-gradient(90deg,transparent calc(var(--hx) - 26%),rgba(255,255,255,.13) var(--hx),transparent calc(var(--hx) + 32%))',fade+'opacity:var(--si);')+
    lay('linear-gradient(90deg,transparent calc(96% - var(--hx) - 4%),rgba(255,255,255,.28) calc(96% - var(--hx)),rgba(25,60,75,.2) calc(96% - var(--hx) + 3%),transparent calc(96% - var(--hx) + 7%))',fade+'opacity:var(--si);')+
    lay('radial-gradient(ellipse 14px 9px at var(--hx) 94%,rgba(255,255,255,.55),transparent 70%)')+
    lay('linear-gradient(90deg,rgba(255,255,255,calc(.5 - var(--hx) * .006)) 0,transparent 3px,transparent calc(100% - 3px),rgba(255,255,255,calc(var(--hx) * .006 - .1)) 100%)');
  const cmp=S.eng==='compare'&&!spec.timeline,cvs=(sp,extra='')=>`<canvas data-sim="${esc(JSON.stringify(sp))}" width="${tw}" height="${bodyH}" style="position:absolute;inset:0;width:100%;height:100%;${extra}"></canvas>`;
  const cv=sum?`<div style="position:absolute;inset:0;clip-path:polygon(${poly})">${cmp?cvs({...spec,ver:'classic'})+cvs({...spec,ver:'v2'},'clip-path:inset(0 0 0 var(--wipe))'):cvs({...spec,ver:S.eng==='classic'?'classic':'v2'})}</div>${cmp?'<div style="position:absolute;top:-6px;bottom:-6px;left:var(--wipe);width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 6px #000a;pointer-events:none"></div>':''}`:'';
  return `<div style="perspective:700px;width:${W}px;height:${Hh}px"><div class="tb3d" style="position:relative;width:${W}px;height:${Hh}px;transform-style:preserve-3d;cursor:grab;touch-action:pan-y;--hx:36%;--si:.9;--rs:1;--wipe:${S.wipe}%">${scale}<div class="tubebody" style="position:absolute;left:${tx}px;top:${top}px;width:${tw}px;height:${bodyH}px;transform-origin:50% 50%">${shell}${cv}${glass}${shade}</div></div></div>`;
}
B({id:'1d',code:'1D',title:'Day Tubes',dial:1,lead:'blend',h:716,
 idea:'Any day can become a graduated tube of simulated liquid or sand, and turn back into the grid with one key. The grid stays the real view and the default. The tube is a decorative, optional one, drawn like lab software: an hour scale down the side, a meniscus or a sand cone for the surface, a readout under each tube. Layers can be sorted by pen or by time of day, so sand settles in order like sediment. The contents are a real particle simulation: they pour in, settle, slosh when you tilt or shake the tube, and settle again.',
 math:'Liquid: position-based fluids. Density ρᵢ = Σⱼ W(|pᵢ − pⱼ|, h), constraint Cᵢ = ρᵢ/ρ₀ − 1 = 0, correction Δpᵢ = (1/ρ₀) Σⱼ (λᵢ + λⱼ) ∇W with λᵢ = −Cᵢ / (Σₖ|∇ₖCᵢ|² + ε), plus XSPH viscosity. Sand: hard grains pushed apart on overlap, with Coulomb friction between them, so the pile settles at an angle of repose of about arctan μ = arctan 0.62 ≈ 32°. Tube frame: g_body = (g − a) (sin θ, cos θ) − α×r − 2ω×v + ω²r.',
 data:'Particle count follows the fill. Fill height is tracked minutes against 1440 on a 0 to 24 h scale. Layer height is each pen’s minutes, or each block in time order. The dashed red line on today’s tube is now. Under each day: tracked time and percent.',
 kept:['Cool paper, graph rule, silver keys','Glass kept matte and tinted, with a soft highlight','Mono readouts and scale','Every grid control still works on the days left as grid'],
 broke:['Tube and sand shapes replace the grid on the days you turn over'],
 src:'Scientific glassware and lab instrument software, with the Strawbs Deadlines idea of fill level as time (board 2C), made quieter. The fidget view is meant to sit beside the real grid, like the other for-fun views in the app. The mock opens with Mon as sand and Tue as liquid to show it. The intended default for every day is the grid, and All grid returns every day to it. Not built.',
 render(){
  const mu=!!S.multi,sc=S.scope||'days',wk=S.span==='week'&&sc==='days'&&!mu,days=wk?[0,1,2,3,4,5,6]:[S.day],W=wk?136:420,gap=wk?8:0,x0=wk?20:24,Hh=mu?300:340;
  const km=(d,m,l)=>`<button class="k${(S.fid[d]||'grid')===m?' on':''}" data-fid="${d}:${m}" style="padding:4px 6px;font-size:9px;letter-spacing:.06em">${l}</button>`;
  const sm=S.sm||'liquid',specs=sc==='days'&&!mu?[]:scopeSpecs(),hgs=S.shape==='hourglass'&&(mu||sc!=='days'?sm==='sand':S.fid[S.day]==='sand');
  const gs=[sc,mu,S.view,S.day,S.lay,S.shape,sm,S.span,S.eng].join();if(hgs&&S.hg.sig!==gs){S.hg.sig=gs;S.hg.clock=S.hg.start||0;if(typeof SIMS!=='undefined')SIMS.clear()}
  const pspec=!hgs?null:(sc==='days'&&!mu)?dayScope(S.day,420,72):specs.find(q=>q.tl);
  const scols=specs.map((o,i)=>{const n=specs.length,gp=mu?6:n>1?14:0,x=24+specs.slice(0,i).reduce((a,q)=>a+q.W+gp,0);
    return ab(x,148,o.W,0,`<div style="display:flex;flex-direction:column;gap:6px"><div style="font:600 ${mu?10:11}px var(--mono);letter-spacing:.04em;width:${o.W}px;${mu?'height:28px;':''}overflow:hidden">${o.lab}</div><div style="margin-top:4px">${tube(0,sm,o.W,Hh,o)}</div>${S.eng==='compare'&&!(o.tl&&hgs)?`<label style="font:500 9px var(--mono);letter-spacing:.1em;display:block;margin-top:2px">BEFORE <input type="range" min="0" max="100" value="${S.wipe}" data-wipe="1" aria-label="Before and after" style="width:70px;accent-color:#1d2733;vertical-align:middle"> AFTER</label>`:''}<div style="font:500 11px var(--mono)">${fmtDur(Math.round(o.sum))} · ${(o.sum/o.cap*100).toFixed(1)}%</div></div>`)}).join('');
  const cols=specs.length?scols:days.map((d,i)=>{
    const mode=S.fid[d]||'grid',t=totals([d]).sum;
    const body=mode==='grid'?`<div style="border:2px solid #1b2128;width:fit-content">${grid({days:[d],w:W,h:Hh,lw:30,hh:0,bg:'#f4f7f9',zebra:'#dfe7ee99',line:'#9fb0bf99',lab:'#4a5a6a',col:'#fbfdfe',fs:9})}</div>`:tube(d,mode,W,Hh);
    return ab(x0+i*(W+gap),148,W,0,`<div style="display:flex;flex-direction:column;gap:6px"><div style="font:600 11px var(--mono);letter-spacing:.06em">${DAYS[d][0]} ${DAYS[d][1].slice(4)}${isToday(d)?' · today':''}</div><div class="row" style="gap:3px;flex-wrap:nowrap">${km(d,'grid','Grid')}${km(d,'liquid','Liquid')}${km(d,'sand','Sand')}</div><div style="margin-top:4px">${body}</div>${S.eng==='compare'&&mode!=='grid'&&mat_ok(mode)?`<label style="font:500 9px var(--mono);letter-spacing:.1em;display:block;margin-top:2px">BEFORE <input type="range" min="0" max="100" value="${S.wipe}" data-wipe="1" aria-label="Before and after" style="width:70px;accent-color:#1d2733;vertical-align:middle"> AFTER</label>`:''}<div style="font:500 11px var(--mono)">${t?fmtDur(t):'—'} · ${Math.round(t/14.4)}%</div></div>`)}).join('');
  const r=read(),anyGrid=days.some(d=>!S.fid[d]);
  return `<div class="b f-house" style="height:716px;${graphBg('#e4eaef','#c3cdd788')}">
   ${ab(16,10,1010,0,`<div class="row">${viewKeys(true,5)}</div>`)}
   ${ab(16,48,1010,0,`<div style="display:flex;gap:10px 22px;flex-wrap:wrap;align-items:center">${navBar(!anyGrid)}${sc==='days'&&!mu?`<div class="row">${kb('Day',S.span==='day','data-set="span:day"')}${kb('Week',S.span==='week','data-set="span:week"')}</div>`:''}${S.shape==='hourglass'?'':`<div class="row" style="gap:6px"><span class="lab">Gravity</span>${kb('Normal',!S.zg,'data-set="zg:0"')}${kb('Zero-g',!!S.zg,'data-set="zg:1"','Blocks float at their time of day on the ruler, with no gravity')}</div><div class="row" style="gap:6px"><span class="lab">Ends</span>${kb('Closed',S.ends!=='open','data-set="ends:closed"')}${kb('Open',S.ends==='open','data-set="ends:open"')}</div>`}<div style="margin-left:auto">${kb('Reset',false,'data-act="reset"','Pour everything in again and stand the tubes upright')}</div></div>`)}
   ${ab(16,84,1010,0,`<div style="display:flex;gap:6px 0;flex-wrap:wrap;align-items:flex-end;padding:6px 0 8px;border-top:1px solid #9fb0bf;border-bottom:1px solid #9fb0bf">${[
     ['Scope',[['days','Days'],['week','Week'],['weeks','Weeks'],['month','Month'],['months','Months']].filter(q=>!document.body.classList.contains('app')||q[0]==='days'||q[0]==='week').map(q=>kb(q[1],sc===q[0],`data-set="scope:${q[0]}"`)).join('')],
     ['Views',kb('One',!mu,'data-set="multi:0"')+kb('All views',mu,'data-set="multi:1"','Show one tube for each view type, side by side')],
     sc!=='days'||mu?['Fill',kb('Liquid',sm==='liquid','data-set="sm:liquid"')+kb('Sand',sm==='sand','data-set="sm:sand"')]:['Every day',kb('Grid',false,'data-fid="all:grid"','Revert every day to the grid')+kb('Liquid',false,'data-fid="all:liquid"')+kb('Sand',false,'data-fid="all:sand"')],
     ['Shape',kb('Tube',S.shape!=='hourglass','data-set="shape:tube"')+kb('Hourglass',S.shape==='hourglass','data-set="shape:hourglass"')]
    ].map(g=>`<div style="display:flex;flex-direction:column;gap:4px;padding:0 10px 0 0;margin-right:10px;border-right:1px solid #9fb0bf66"><span class="lab">${g[0]}</span><div class="row">${g[1]}</div></div>`).join('')}</div>`)}
   ${cols}
   ${mu&&hgs&&pspec?ab(24,512,990,0,hgPanel(pspec,true)):''}${wk||mu||sc==='weeks'||sc==='months'?'':ab(470,148,550,0,`${hgs&&pspec?hgPanel(pspec,false):''}<div class="row" style="gap:12px;margin-bottom:12px">${sc==="days"?pods():""}</div><div class="lab" style="margin-bottom:4px">Layers · ${S.lay==='pen'?'largest at the bottom':'earliest at the bottom'}</div><div style="background:#f4f7f9;border:1px solid #8794a2;max-width:300px">${penRack(10)}</div>`)}
   ${ab(16,590,1010,0,`<div class="row" style="gap:6px 22px;align-items:flex-start"><div class="row"><span class="lab">Layers</span>${kb('By pen',S.lay==='pen','data-set="lay:pen"')}${kb('By time',S.lay==='time','data-set="lay:time"')}<span class="lab" style="margin-left:10px">Engine</span>${kb('Before',S.eng==='classic','data-set="eng:classic"')}${kb('After',S.eng==='v2','data-set="eng:v2"')}${kb('Compare',S.eng==='compare','data-set="eng:compare"')}</div><div class="row">${anyGrid?toolKeys(false):kb(ico('point')+'Point (inspect)',S.tool==='point','data-tool="point"','Click a grain for its time block, or a liquid to take a sample')}</div>${(specs.length?sm==='liquid':days.some(d=>S.fid[d]==='liquid'))&&S.eng!=='classic'?(()=>{const pl=totals(specs.length?ALLD:spanDays()).list.filter(p=>p.m).slice(0,8),cur=S.ink&&pl.some(p=>p.k===S.ink)?S.ink:(pl[0]||{}).k;return `<div class="row"><span class="lab">Ink</span>${pl.map(p=>`<button class="k${p.k===cur?' on':''}" data-set="ink:${esc(p.k)}" aria-label="${esc(p.n)}" title="${esc(p.n)}" style="padding:3px"><i style="display:block;width:16px;height:16px;background:${p.c};border:1px solid #0006"></i></button>`).join('')}${kb('Make denser',false,'data-ink="dense"','The picked colour gets heavier. It sinks and spreads by diffusion and gravity')}${kb('Lighter',false,'data-ink="light"','The picked colour gets lighter and rises')}</div>`})():''}${anyGrid?`<div class="row">${flagKeys()}</div><div class="row">${glassKeys()}</div>`:''}${wk?`<div class="row" style="gap:12px">${pods()}</div>`:''}</div>`)}
   ${ab(430,672,330,0,`<label class="lab" style="white-space:nowrap;display:flex;align-items:center;gap:8px" for="mixr">Mixing<span style="opacity:.7">apart</span><input id="mixr" type="range" min="0" max="100" step="5" value="${S.mix}" data-mix="1" style="width:100px;accent-color:#1d2733"><span style="opacity:.7">blended</span><span class="mv" style="min-width:34px">${S.mix}%</span></label>`)}
   ${ab(16,672,400,0,`<label class="lab" style="white-space:nowrap;display:flex;align-items:center;gap:8px" for="grain">Sand coarseness<span style="opacity:.7">fine</span><input id="grain" type="range" min="0.8" max="8" step="0.1" value="${S.grain}" data-grain="1" style="width:130px;accent-color:#1d2733"><span style="opacity:.7">coarse</span><span class="gv" style="min-width:44px">${S.grain.toFixed(1)} px</span></label>`)}
   ${ab(776,668,250,0,`<div class="lab" style="opacity:.9">Hover to turn · drag to tilt · tap to nudge · Point to inspect</div>`)}
   ${isEmpty()&&!wk?ab(24,200,420,0,`<div style="font:500 13px/1.6 var(--mono);background:#f4f7f9ee;padding:12px;border:1px solid #8794a2">${esc(emptyText())}</div>`):''}
  </div>`}});
</script>
