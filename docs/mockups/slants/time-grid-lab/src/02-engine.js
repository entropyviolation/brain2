<script>
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
/* ===== sample data: minutes since midnight, [start, end, pen] ===== */
const H=(a,b=0)=>a*60+b;
const DAYS=[['Mon','Oct 19'],['Tue','Oct 20'],['Wed','Oct 21'],['Thu','Oct 22'],['Fri','Oct 23'],['Sat','Oct 24'],['Sun','Oct 25']];
const NOW={day:2,min:42};
const PAL={
  activity:{sleep:['Sleep','#2b3a8f'],scroll:['scrolling','#6b4a86'],drive:['driving','#5a4f52'],treat:['treat shop','#e6a9be'],rest:['restaurant','#3f74e0'],walk:['walking','#6f9a6a'],brain:['Brain2','#1a24b5'],clean:['cleaned 3 min','#e49a1c'],pl:['PlaylistLab','#7d8f55'],cds:['Finish CDs','#6b3a12']},
  location:{home:['Home','#4a6f8a'],car:['Car','#6a6470'],shop:['Grocery','#3f9a7a'],lin:["Linda's",'#8a5ab4'],jen:["Jenny's",'#d08a5a'],studio:['Studio','#2a5ab4']},
  mood:{low:['Low','#53627a'],ok:['Okay','#4c9a9a'],good:['Good','#5a8fd8'],great:['Great','#a77be0']},
  screen:{social:['Social','#c0506a'],video:['Video','#4a8ac0']},
  company:{}
};
const DATA={
  activity:[[[40,360,'scroll'],[360,540,'sleep'],[600,640,'drive'],[1035,1040,'walk'],[1040,1080,'drive'],[1080,1095,'treat'],[1095,1180,'rest'],[1320,1400,'scroll']],
            [[180,240,'cds'],[360,420,'sleep'],[420,540,'pl'],[600,1080,'brain'],[1200,1265,'clean']],[],[],[],[],[]],
  location:[[[40,600,'home'],[600,640,'car'],[640,690,'shop'],[690,710,'car'],[710,846,'home'],[846,870,'car'],[870,1035,'lin'],[1035,1080,'car'],[1080,1180,'jen'],[1180,1200,'car'],[1200,1400,'home']],
            [[0,600,'home'],[600,1080,'studio'],[1080,1200,'car'],[1200,1440,'home']],[],[],[],[],[]],
  mood:[[[40,360,'low'],[360,840,'ok'],[840,1080,'good'],[1080,1180,'great'],[1180,1400,'good']],[[420,720,'ok'],[720,1080,'good'],[1080,1265,'great']],[],[],[],[],[]],
  screen:[[[40,110,'social'],[1000,1040,'video'],[1320,1400,'social']],[[1200,1265,'video']],[],[],[],[],[]]
};
const VIEWS=[['activity','Activity','Activity'],['location','Location','Location'],['mood','Mood','Mood'],['company','Company','Company'],['events','Discrete events','Events'],['screen','Screen time','Screen'],['phscr','iPhone screen time','iPh screen'],['phcall','iPhone calls','iPh calls'],['phtxt','iPhone texts','iPh texts']];
const VNAME=Object.fromEntries(VIEWS.map(v=>[v[0],v[1]]));
const TOOLS=[['draw','Draw'],['erase','Erase'],['scissors','Scissors'],['point','Point'],['fill','Fill']];
const FLAGS=[['multi','Multi'],['adv','Advanced'],['logflags','Hide log flags'],['sun','Hide sun lines']];
const CELLS={day:[5,10,15,30],week:[15,30,60]};

const S={span:'day',cell:5,view:'activity',day:0,pen:null,tool:'draw',flags:{},glass:'glass',cleared:{},confirm:false,fid:{0:'sand',1:'liquid'},lay:'pen',grain:3.3,scope:'days',zg:false,mix:50,multi:false,sm:'liquid',shape:'tube',ends:'closed',hg:{speed:60,playing:true,start:0,clock:0,sig:''},eng:'v2',wipe:50};

/* ===== helpers ===== */
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const fmtDur=m=>`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
const fmtT=m=>{m=((m%1440)+1440)%1440;const h=Math.floor(m/60),mm=m%60;return `${h%12||12}:${String(mm).padStart(2,'0')} ${h<12?'AM':'PM'}`};
const fmtH=h=>`${h%12||12}${h<12?'a':'p'}`;
const hex=c=>{c=c.replace('#','');return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16))};
const toHex=a=>'#'+a.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>{const A=hex(a),B=hex(b);return toHex(A.map((x,i)=>x+(B[i]-x)*t))};
const lum=c=>{const [r,g,b]=hex(c);return .299*r+.587*g+.114*b};
const gray=(c,tint='#8a6a4a',t=.22)=>{const l=lum(c);return mix(toHex([l,l,l]),tint,t)};
const dayLab=d=>`${DAYS[d][0]}, ${DAYS[d][1]}, 2026`;
const spanDays=()=>S.span==='week'?[0,1,2,3,4,5,6]:[S.day];
const spanLab=()=>S.span==='week'?'Oct 19 – Oct 25, 2026':dayLab(S.day);
const pal=()=>PAL[S.view]||{};
const isToday=d=>d===NOW.day;

let memo={};
function raw(view,d){const k=view+':'+d;if(S.cleared[k])return[];return (DATA[view]&&DATA[view][d])||[]}
function cellsArr(view,d,step){
  const key=`c${view}${d}${step}${S.cleared[view+':'+d]?1:0}`;if(memo[key])return memo[key];
  const n=1440/step,out=new Array(n).fill(null),occ=new Array(1440).fill(null);
  raw(view,d).forEach(([s,e,k])=>{for(let m=s;m<e;m++)occ[m]=k});
  for(let i=0;i<n;i++){const c={};let best=null,bc=0;for(let m=i*step;m<(i+1)*step;m++){const k=occ[m];if(k){c[k]=(c[k]||0)+1;if(c[k]>bc){bc=c[k];best=k}}}if(best&&bc*2>=step)out[i]=best}
  return memo[key]=out;
}
function runs(view,d,step){
  const key=`r${view}${d}${step}${S.cleared[view+':'+d]?1:0}`;if(memo[key])return memo[key];
  const out=[];let cur=null;cellsArr(view,d,step).forEach((k,i)=>{if(!k){cur=null;return}if(cur&&cur.k===k&&cur.e===i*step)cur.e=(i+1)*step;else{cur={k,s:i*step,e:(i+1)*step};out.push(cur)}});
  return memo[key]=out;
}
function rawRuns(view,d){return raw(view,d).map(([s,e,k])=>({s,e,k}))}
function totals(days=spanDays(),view=S.view){
  const t={};let sum=0;days.forEach(d=>raw(view,d).forEach(([s,e,k])=>{t[k]=(t[k]||0)+(e-s);sum+=e-s}));
  const list=Object.keys(PAL[view]||{}).map(k=>({k,n:PAL[view][k][0],c:PAL[view][k][1],m:t[k]||0})).sort((a,b)=>b.m-a.m);
  return {list,sum};
}
function read(){
  const days=spanDays(),t=totals(days);
  const withData=days.filter(d=>raw(S.view,d).length).length;
  return {tracked:t.sum,pct:t.sum/(1440*days.length)*100,days:withData,n:days.length,list:t.list};
}
const isEmpty=()=>read().tracked===0;
function selPen(){const l=totals().list;if(S.pen&&PAL[S.view]&&PAL[S.view][S.pen])return S.pen;return l[0]?l[0].k:null}
function emptyText(){return `This is an EMPTY ${S.span.toUpperCase()}. No ${VNAME[S.view].toLowerCase()} is logged for ${spanLab()}. This writing is the DESIGN upon the empty ${S.span}.`}

/* ===== one grid engine, many skins ===== */
function grid(o){
  const days=o.days||spanDays(),v=o.v!==false,W=o.w,Hh=o.h,lw=o.lw??44,hh=o.hh??(v?(days.length>1?24:0):18);
  const px=lw,py=hh,pw=W-lw,ph=Hh-hh,dn=days.length,g=o.gap??0,P=pal();
  const cellOf=i=>v?{x:px+i*pw/dn,y:py,w:pw/dn-g,h:ph}:{x:px,y:py+i*ph/dn,w:pw,h:ph/dn-g};
  const pos=(c,a,b)=>v?{x:c.x,y:c.y+a/1440*c.h,w:c.w,h:(b-a)/1440*c.h}:{x:c.x+a/1440*c.w,y:c.y,w:(b-a)/1440*c.w,h:c.h};
  const lc=o.lab||'#556270';let s=`<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:${o.font||"'IBM Plex Mono',monospace"}">${o.defs||''}`;
  if(o.bg)s+=`<rect width="${W}" height="${Hh}" fill="${o.bg}"/>`;
  days.forEach((d,i)=>{
    const c=cellOf(i);
    s+=`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${o.col||'none'}" ${o.colStroke?`stroke="${o.colStroke}"`:''}/>`;
    if(o.zebra)for(let hr=0;hr<24;hr+=2){const r=pos(c,hr*60,hr*60+60);s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${o.zebra}"/>`}
    for(let hr=0;hr<=24;hr++){const r=pos(c,hr*60,hr*60);const q=hr%6===0;
      s+=v?`<line x1="${c.x}" x2="${c.x+c.w}" y1="${r.y}" y2="${r.y}" stroke="${o.line||'#0002'}" stroke-width="${q?1.2:.6}"/>`:`<line y1="${c.y}" y2="${c.y+c.h}" x1="${r.x}" x2="${r.x}" stroke="${o.line||'#0002'}" stroke-width="${q?1.2:.6}"/>`}
    rawOrRuns(o,d).forEach(r0=>{const k=r0.k,pen=P[k];if(!pen)return;const r=pos(c,r0.s,r0.e);
      const custom=o.run&&o.run(r,{k,pen,run:r0,d,i,c,v});
      s+=custom!=null?custom:`<rect x="${r.x}" y="${r.y}" width="${Math.max(r.w,.6)}" height="${Math.max(r.h,.6)}" fill="${o.color?o.color(pen[1],k):pen[1]}" data-tip="${esc(pen[0])} · ${fmtT(r0.s)}–${fmtT(r0.e)} · ${fmtDur(r0.e-r0.s)}"/>`});
    if(isToday(d)&&o.now!==false){const r=pos(c,NOW.min,NOW.min);s+=o.nowFn?o.nowFn(c,r,v):(v?`<line x1="${c.x}" x2="${c.x+c.w}" y1="${r.y}" y2="${r.y}" stroke="#d6402f" stroke-width="2"/><text x="${c.x+c.w-3}" y="${r.y-3}" text-anchor="end" font-size="9" fill="#d6402f">NOW</text>`:`<line y1="${c.y}" y2="${c.y+c.h}" x1="${r.x}" x2="${r.x}" stroke="#d6402f" stroke-width="2"/>`)}
    if(!v)s+=`<text x="${lw-8}" y="${c.y+c.h/2+3}" text-anchor="end" font-size="${o.fs||10}" fill="${lc}">${days.length>1?DAYS[d][0]+' '+DAYS[d][1].slice(4):''}</text>`;
    else if(days.length>1)s+=`<text x="${c.x+c.w/2}" y="${hh-8}" text-anchor="middle" font-size="${o.fs||10}" fill="${isToday(d)?'#d6402f':lc}" font-weight="${isToday(d)?700:500}">${DAYS[d][0]} ${DAYS[d][1].slice(4)}</text>`;
  });
  const c0=cellOf(0);
  if(v){const step=ph/24>=15?1:ph/24>=9?2:3;for(let hr=0;hr<24;hr+=step)s+=`<text x="${lw-6}" y="${c0.y+hr*ph/24+Math.min(11,ph/48+4)}" text-anchor="end" font-size="${o.fs||10}" fill="${lc}">${o.hourFmt?o.hourFmt(hr):fmtH(hr)}</text>`}
  else{for(let hr=0;hr<24;hr+=o.hstep||3)s+=`<text x="${px+hr*pw/24+3}" y="${hh-5}" font-size="${o.fs||10}" fill="${lc}">${fmtH(hr)}</text>`}
  return s+(o.extra||'')+'</svg>';
}
function rawOrRuns(o,d){return o.raw?rawRuns(S.view,d):runs(S.view,d,S.cell)}

/* ===== 7-segment digits ===== */
function seg7(str,o={}){
  const w=o.w||16,hh=o.h||28,gap=o.gap||5,on=o.on||'#7dffc4',off=o.off||'#7dffc41c',sw=o.sw||2.6;
  const M={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg','-':'g'};
  const P={a:[1,1,w-1,1],b:[w-1,1,w-1,hh/2],c:[w-1,hh/2,w-1,hh-1],d:[1,hh-1,w-1,hh-1],e:[1,hh/2,1,hh-1],f:[1,1,1,hh/2],g:[1,hh/2,w-1,hh/2]};
  let x=0,out='';
  for(const ch of String(str)){
    if(ch===' '){x+=w+gap;continue}
    if(ch===':'){out+=`<circle cx="${x+w/2}" cy="${hh*.32}" r="${sw*.7}" fill="${on}"/><circle cx="${x+w/2}" cy="${hh*.68}" r="${sw*.7}" fill="${on}"/>`;x+=w+gap;continue}
    if(ch==='+'){out+=`<path transform="translate(${x},0)" d="M${w/2-4} ${hh/2}h8M${w/2} ${hh/2-4}v8" stroke="${on}" stroke-width="${sw}" stroke-linecap="round"/>`;x+=w+gap;continue}
    const set=M[ch]||'';
    out+=`<g transform="translate(${x},0)">`+Object.keys(P).map(k=>{const p=P[k];return `<line x1="${p[0]}" y1="${p[1]}" x2="${p[2]}" y2="${p[3]}" stroke="${set.includes(k)?on:off}" stroke-width="${sw}" stroke-linecap="round"/>`}).join('')+'</g>';x+=w+gap;
  }
  return `<svg width="${x}" height="${hh}" viewBox="0 0 ${x} ${hh}" style="display:block;overflow:visible">${out}</svg>`;
}

/* ===== controls (styled by the board's family class) ===== */
const IC={
  draw:'<path d="M2 14l1-4 8-8 3 3-8 8zM9 4l3 3"/>',
  erase:'<path d="M3 10l6-7 5 4-5 6H5zM6 14h9"/>',
  scissors:'<circle cx="4" cy="4" r="1.8"/><circle cx="4" cy="12" r="1.8"/><path d="M5.5 5l9 7M5.5 11l9-7"/>',
  point:'<circle cx="8" cy="8" r="1.6"/><path d="M8 1v4M8 11v4M1 8h4M11 8h4"/>',
  fill:'<path d="M3 9l5-6 5 6-5 5zM13 11c1 1.6 1 2.5 0 3"/>'
};
const ico=n=>`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
const kb=(label,on,attr,title)=>`<button class="k${on?' on':''}" ${attr}${title?` title="${esc(title)}"`:''} aria-pressed="${on?'true':'false'}">${label}</button>`;
const viewKeys=(short,n)=>VIEWS.slice(0,n||VIEWS.length).map(v=>kb(short?v[2]:v[1],S.view===v[0],`data-set="view:${v[0]}"`)).join('');
const spanKeys=()=>kb('Day',S.span==='day','data-set="span:day"')+kb('Week',S.span==='week','data-set="span:week"')+kb('Scroll ∞',false,'data-act="toast:Infinite scroll is one continuous strip in the app. It is not mocked in this lab."');
const cellKeys=()=>CELLS[S.span].map(n=>kb(n+'m',S.cell===n,`data-set="cell:${n}"`)).join('');
const toolKeys=(labels=true)=>TOOLS.map(t=>kb(ico(t[0])+(labels?t[1]:''),S.tool===t[0],`data-tool="${t[0]}"`,t[1])).join('');
const flagKeys=()=>FLAGS.map(f=>kb(f[1],!!S.flags[f[0]],`data-flag="${f[0]}"`)).join('');
const glassKeys=()=>kb('Glass',S.glass==='glass','data-glass="glass"')+kb('Paper',S.glass==='paper','data-glass="paper"');
function navBar(noClear){
  const r=read(),lab=spanLab();
  const clear=noClear?'':S.confirm?`<span class="confirm">Clears ${fmtDur(r.tracked)} tracked on ${lab}.<button class="k" data-act="clear-go">Clear</button><button class="k" data-act="clear-no">Cancel</button></span>`:kb('Clear '+S.span,false,'data-act="clear"');
  return `<div class="nav"><button class="k" data-act="prev" aria-label="Previous">‹</button><span class="dt">${lab}</span><button class="k" data-act="next" aria-label="Next">›</button>${kb('Today',false,'data-act="today"')}${clear}</div>`;
}
function pods(){
  const r=read();
  const a=`<div class="pod"><span>Tracked</span><b>${fmtDur(r.tracked)}</b><small>T = Σ(eᵢ − sᵢ) = ${r.tracked} min</small></div>`;
  const b=`<div class="pod"><span>Of ${S.span==='week'?'week':'day'}</span><b>${Math.round(r.pct)}%</b><small>T ÷ ${1440*r.n} = ${r.pct.toFixed(1)}%</small></div>`;
  const c=S.span==='week'?`<div class="pod"><span>Days</span><b>${r.days}/7</b><small>days with data ÷ 7</small></div>`:'';
  return a+b+c;
}
function penRack(n=8,fmt){
  const sel=selPen(),l=totals().list.slice(0,n);
  return l.map(p=>`<button class="pn${p.k===sel?' on':''}" data-pen="${p.k}"><i style="background:${p.c}"></i><span>${esc(p.n)}</span><em>${p.m?fmtDur(p.m):'—'}</em></button>`).join('')||'<div class="lab" style="padding:6px">No pens in this view</div>';
}
const board=[];
const B=o=>board.push(o);
</script>
