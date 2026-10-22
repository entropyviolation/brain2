<script>
const LEAD={hip:'Hipgnosis',retro:'Retrofuturism',blend:'Blend'};
const DIALNAME=['Keeps every house rule','New furniture the house allows','Breaks a few named rules','Re-skins the whole tab','Breaks everything'];
const filt={dial:'all',lead:'all'};
let focusId=null,undoList=null,toastT=null;

/* ---------- build the page shell ---------- */
function buildCards(){
  let html='';
  [0,1,2,3,4].forEach(dl=>{
    html+=`<h2 class="dg" data-dial="${dl}" style="margin:36px 0 18px">Dial ${dl} · ${DIALNAME[dl]}</h2>`;
    board.filter(b=>b.dial===dl).forEach(b=>{
      html+=`<article class="card" id="b-${b.id}" data-dial="${dl}" data-lead="${b.lead}">
       <div class="card-h"><span class="code">${b.code}</span><h2>${esc(b.title)}</h2><span class="pill">Dial ${dl}</span><span class="pill l">${LEAD[b.lead]}</span><button class="full" data-act="focus:${b.id}">Full size</button></div>
       <div class="stagewrap" id="w-${b.id}"><div class="stage" id="st-${b.id}"></div></div>
       <div class="notes">
        <div><h4>The idea</h4><p>${esc(b.idea)}</p></div>
        <div><h4>Data it carries</h4><p>${esc(b.data)}</p></div>
        <div><h4>${dl>=3?'House rules kept':'Rules kept'}</h4><ul>${b.kept.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
        ${b.broke.length?`<div><h4>Rules broken</h4><ul>${b.broke.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
        <div><h4>Where it comes from</h4><p>${esc(b.src)}</p></div>
       </div>${b.math?`<p class="mathnote">${esc(b.math)}</p>`:''}</article>`;
    });
  });
  $('#boards').innerHTML=html;
  $('#idx').innerHTML=board.map(b=>`<a href="#b-${b.id}">${b.code} ${esc(b.title)}</a>`).join('')+'<a href="#parts">Parts bin</a><a href="#research">Research</a>';
  const mk=(grp,items)=>items.map(([v,l])=>`<button class="chip" data-filter="${grp}:${v}">${l}</button>`).join('');
  $('#filters').innerHTML=mk('dial',[['all','All dials'],['0','0'],['1','1'],['2','2'],['3','3'],['4','4']])+'<span style="width:10px"></span>'+mk('lead',[['all','Both styles'],['hip','Hipgnosis'],['retro','Retro'],['blend','Blend']]);
}
function applyFilter(){
  $$('.card').forEach(c=>{c.hidden=!((filt.dial==='all'||c.dataset.dial===filt.dial)&&(filt.lead==='all'||c.dataset.lead===filt.lead))});
  $$('.dg').forEach(h=>{h.hidden=!$$(`.card[data-dial="${h.dataset.dial}"]:not([hidden])`).length});
  $$('[data-filter]').forEach(b=>{const[g,v]=b.dataset.filter.split(':');b.classList.toggle('on',filt[g]===v)});
  fit();
}

/* ---------- render ---------- */
function renderBoard(b,el){el.style.height=b.h+'px';el.innerHTML=b.render()}
function renderAll(){
  memo={};
  board.forEach(b=>{const el=$('#st-'+b.id);if(el&&!el.closest('.card').hidden)renderBoard(b,el)});
  if(focusId){const b=board.find(x=>x.id===focusId);const fs=$('#fs');fs.style.height=b.h+'px';fs.innerHTML=b.render()}
  renderParts();syncBench();fit();
}
function fit(){
  board.forEach(b=>{const w=$('#w-'+b.id),st=$('#st-'+b.id);if(!w||w.closest('.card').hidden)return;const sc=w.clientWidth/1040;st.style.transform=`scale(${sc})`;w.style.height=(b.h*sc)+'px'});
}
function syncBench(){
  $$('.bench [data-set]').forEach(b=>{const[k,v]=b.dataset.set.split(':');b.classList.toggle('on',String(S[k])===v)});
  $('#cellchips').innerHTML=CELLS[S.span].map(n=>`<button class="chip${S.cell===n?' on':''}" data-set="cell:${n}">${n}m</button>`).join('');
  $('#daylab').textContent=S.span==='week'?'Oct 19–25':DAYS[S.day][0]+' '+DAYS[S.day][1].slice(4);
}

/* ---------- parts bin: every control in eight families ---------- */
const FAMS=[
 ['house','House','Silver chrome keys, CRT-lit active key.','0A 0B 1A 1B','background:#dfe6ec;color:#1d2733'],
 ['line','Drafting line','One stroke weight, filled when pressed.','2A 4A 4B 4D','background:#f1f2f0;color:#14181d'],
 ['dsky','DSKY keypad','Dark caps, a lit lamp as the pressed state.','0B','background:#2b3036;color:#d7dde2'],
 ['lcars','Elbow pills','Rounded bars in three tints.','3A','background:#000;color:#ffd8b0;font-family:Antonio,sans-serif'],
 ['y2k','Gel','Glossy pearl and Bondi blue.','2C','background:linear-gradient(#bfe3ee,#eaf7fb);color:#0c3a4e'],
 ['film','Film print','Orange edge print, red grease pencil ring.','1C 2B 3C','background:#0e0d0c;color:#d68a46'],
 ['term','Terminal','Bracket keys, one phosphor.','3B','background:#030a05;color:#7dff9a;font-family:VT323,monospace;font-size:17px'],
 ['dymo','Label tape','Embossed strips, red when active.','2D 4C','background:#202226;color:#ece9e2']
];
function renderParts(){
  $('#partsgrid').innerHTML=FAMS.map(f=>`<div class="f-${f[0]}" style="${f[4]};padding:16px;border:1px solid var(--rule);display:flex;flex-direction:column;gap:10px">
   <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b style="font:600 14px var(--sans)">${f[1]}</b><span class="lab">Used in ${f[3]}</span></div><div style="font-size:12px;opacity:.8">${f[2]}</div>
   <span class="lab">View keys</span><div class="row">${viewKeys(true)}</div>
   <span class="lab">Span · Cell</span><div class="row">${spanKeys()}${cellKeys()}</div>
   <span class="lab">Paint tools</span><div class="row">${toolKeys()}</div>
   <span class="lab">Flags · Display</span><div class="row">${flagKeys()}${glassKeys()}</div>
   <span class="lab">Date and Clear day (asks first)</span>${navBar()}
   <span class="lab">Readouts</span><div class="row" style="gap:10px">${pods()}</div>
   <span class="lab">Pen rack</span><div>${penRack(3)}</div></div>`).join('');
}

/* ---------- research and shelf ---------- */
const L=(t,u)=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
const RS=[
 ['Helicorders and drum recorders','A drum recorder prints a day on paper wrapped round a slow drum, so the trace becomes a stack of lines once flattened. Displays differ: the NCEDC page shows one line per hour, USGS pages use 15 minutes per line. Both keep the day on one sheet.','Board 1B. The Day key is the chart speed. Cell size sets how finely the pulses snap. Week turns each line into a day.',[['USGS, what is a drum recorder','https://earthquake.usgs.gov/monitoring/seismograms/about.php'],['NCEDC waveform display notes','https://ncedc.org/waveformDisplayFAQ.html']]],
 ['Muybridge against Marey','Muybridge broke motion into a grid of separate negatives, small multiples of time. Marey merged many exposures on one plate. Harvard describes Marey as a careful graphic designer who treated chronophotography as time made visible.','Boards 1A (grid of days), 1C (one long exposure), 2B (frames on a roll). Search found no authoritative source on their effect on graphic design, so that link is a design argument, not a cited fact.',[['Harvard Art Museums, Just in Time','https://harvardartmuseums.org/article/just-in-time'],['Marey and chronophotography (Paris)','https://numerabilis.u-paris.fr/medica/bibliotheque-numerique/presentations/marey/03-en.php']]],
 ['Split-flap boards','Solari boards date to the 1950s and spread through airports and stations. Much of their appeal was sound: they announced a change by flipping.','Board 2D. Every redraw flips the tiles, in order, and stops when the reduced-motion setting asks for stillness.',[['Split-flap display','https://en.wikipedia.org/wiki/Split-flap_display'],['Billy Penn, the Amtrak Solari board','https://billypenn.com/2022/12/05/amtrak-flipboard-philadelphia-30th-street-station-solari-historic-display/']]],
 ['Apollo flight plans and a shared clock','Apollo flight plans were indexed by Ground Elapsed Time, one clock that crew and ground both pointed at. A 1969 commercial Mission Analyzer used rotating discs to line up days and hours.','Board 4C, where days and hours are lined up on a disc. Shelf idea: a GET readout, hours since the first block of the week. The search did not turn up the layout of the strip charts themselves, so none is copied.',[['Apollo 11 flight plan (ALSJ)','https://www.nasa.gov/history/alsj/a11/a11-fltplan.htm'],['Apollo 12 flight plan (PDF)','https://www.ibiblio.org/apollo/Documents/Apollo12FlightPlan.pdf']]],
 ['From the Hipgnosis file','Idea first, band second. Do it for real. The object measures something. Boards here use Presence (0A), Technical Ecstasy (2A), Deadlines (2C), Elegy (4A), Go 2 (4D), And Then There Were Three (1C), The Lamb (1A) and The Dark Side of the Moon (3C).','Every quote on a board is in the slant research with its source. Nothing here adds a new claim about those covers.',[['Hipgnosis slant file','../hipgnosis/HIPGNOSIS_SLANT.md'],['Second research round','../hipgnosis/research-2-hipgnosis.md']]],
 ['From the retrofuturism file','One glowing screen per panel. Every label earns its place. Boards use the DSKY (0B), cassette futurism and Alien labels (1B, 3B), LCARS (3A), Esper (4B), Y2K gel (2C) and split-flap (2D). One era per board.','Palettes are by eye, as in the slant file.',[['Retrofuturism slant file','../retrofuturism/RETROFUTURISM_SLANT.md'],['Research','../retrofuturism/research.md']]],
 ['What was not found','Searches for Braun ET66 and Teenage Engineering design principles returned nothing usable. The Apollo search found flight plan documents but not strip chart layouts.','These are open leads, not claims. Nothing on a board depends on them.',[]]
];
const SHELF=[
 ['Tool keys as line icons','Five single-weight marks, one per tool, so Draw, Erase, Scissors, Point and Fill stop sharing one jewel. The plan file leaves this as a decision.'],
 ['Clear day as a retoucher’s mask','The day washes pale and one sentence stands on it: Clears 12h 45m tracked on Mon, Oct 19. Cancel lifts the wash.'],
 ['Undo as develop-in','Restored minutes come back through the develop filter, bright and soft, then settle.'],
 ['Ghost as a double exposure','The ghost view prints behind the main view as a faint second exposure. The ghost LED becomes visible in the picture itself.'],
 ['Sun lines in sky color','The hairline at sunrise and sunset takes the color of the sky at that hour. Hide sun lines stays a flag.'],
 ['Name the view in words','A readout in the dark strip: Viewing Location, ghost Activity. It fills the empty strip the plan file wants explained.'],
 ['Group the view keys','Mine (activity, location, mood, company) on one plate, Phone (screen time, calls, texts) on another, split by a hairline.'],
 ['Caution lamps for data quality','Assumed, gap over two hours, overlap, phone data missing, sync pending. Each lights from a real count.'],
 ['Day summary as liner notes','The summary well set like the back of a sleeve, with Recorded, Tracked and Pens printed as credits.'],
 ['Week as a gatefold','The week board opens sideways to show the week summary, and closes back to the grid.'],
 ['Mission clock','Hours since the first tracked block of the week, as a small seven-segment readout in the Time recorder header.'],
 ['Liquid and sand view, optional','Any day can be turned into a tube of liquid or sand for fun, and turned back. The grid stays the real view. Board 1D shows it; the default for every day is the grid.'],
 ['Phosphor persistence on date change','Old blocks fade over about a second when the date moves, so you can see what changed.']
];
function buildResearch(){
  $('#rs').innerHTML=RS.map(r=>`<article><h3>${r[0]}</h3><p>${r[1]}</p><p><small>${r[2]}</small></p><p>${r[3].map(s=>L(s[0],s[1])).join(' · ')}</p></article>`).join('');
  $('#shelfbody').innerHTML=SHELF.map(s=>`<p><b>${s[0]}.</b> ${s[1]}</p>`).join('');
}

/* ---------- actions ---------- */
function toast(msg,undo){
  const t=$('#toast');t.innerHTML=esc(msg)+(undo?' <button data-act="undo">Undo</button>':'');t.style.display='flex';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',4800);
}
function setState(k,v){
  S.confirm=false;
  if(k==='span'){S.span=v;if(!CELLS[v].includes(S.cell))S.cell=v==='week'?60:5}
  else if(k==='cell')S.cell=+v;
  else if(k==='view'){S.view=v;S.pen=null}
  else if(k==='day')S.day=+v;
  else if(k==='lay')S.lay=v;else if(k==='shape')S.shape=v;else if(k==='eng')S.eng=v;else if(k==='ends')S.ends=v;else if(k==='scope')S.scope=v;else if(k==='zg')S.zg=v==='1';else if(k==='multi')S.multi=v==='1';else if(k==='ink')S.ink=v;else if(k==='sm')S.sm=v;
}
function act(a){
  const[n,arg]=[a.split(':')[0],a.slice(a.indexOf(':')+1)];
  if(n==='prev'||n==='next'){if(S.span==='week')return toast('Only this week is sampled in the lab.');S.day=Math.max(0,Math.min(6,S.day+(n==='next'?1:-1)));S.confirm=false}
  else if(n==='today'){S.day=NOW.day;S.confirm=false}
  else if(n==='clear')S.confirm=true;
  else if(n==='clear-no')S.confirm=false;
  else if(n==='clear-go'){const r=read(),lab=spanLab();undoList=spanDays().map(d=>S.view+':'+d).filter(k=>!S.cleared[k]);undoList.forEach(k=>S.cleared[k]=true);S.confirm=false;toast(`Cleared ${fmtDur(r.tracked)} on ${lab}.`,true)}
  else if(n==='undo'){(undoList||[]).forEach(k=>delete S.cleared[k]);undoList=null;$('#toast').style.display='none'}
  else if(n==='reset')resetTubes();
  else if(n==='toast')return toast(arg);
  else if(n==='cyc'){S.confirm=false;if(arg==='cell'){const c=CELLS[S.span];S.cell=c[(c.indexOf(S.cell)+1)%c.length]}else if(arg==='view'){const i=VIEWS.findIndex(v=>v[0]===S.view);S.view=VIEWS[(i+1)%VIEWS.length][0];S.pen=null}else if(arg==='span')setState('span',S.span==='day'?'week':'day')}
  else if(n==='focus'){focusId=arg;$('#focus').classList.add('open');$('#focuslab').textContent=board.find(b=>b.id===arg).code+' · '+board.find(b=>b.id===arg).title;document.body.style.overflow='hidden'}
  else if(n==='closefocus'){focusId=null;$('#focus').classList.remove('open');$('#fs').innerHTML='';document.body.style.overflow=''}
  renderAll();
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-set],[data-act],[data-pen],[data-tool],[data-flag],[data-glass],[data-filter],[data-fid]');if(!t)return;
  const d=t.dataset;
  if(d.filter){const[g,v]=d.filter.split(':');filt[g]=v;applyFilter();renderAll();return}
  if(d.set){const i=d.set.indexOf(':');setState(d.set.slice(0,i),d.set.slice(i+1));renderAll();return}
  if(d.fid){const[a,m]=d.fid.split(':');(a==='all'?[0,1,2,3,4,5,6]:[+a]).forEach(x=>{if(m==='grid')delete S.fid[x];else S.fid[x]=m});renderAll();return}
  if(d.pen){S.pen=d.pen;renderAll();return}
  if(d.tool){S.tool=(d.tool==='point'&&S.tool==='point')?'draw':d.tool;renderAll();return}
  if(d.flag){S.flags[d.flag]=!S.flags[d.flag];renderAll();return}
  if(d.glass){S.glass=d.glass;renderAll();return}
  if(d.act)act(d.act);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&focusId)act('closefocus')});
$('#mathsw').addEventListener('change',e=>document.body.classList.toggle('math',e.target.checked));
const tip=$('#tip');
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]');if(t){tip.textContent=t.dataset.tip;tip.style.display='block'}});
document.addEventListener('mousemove',e=>{if(tip.style.display==='block'){tip.style.left=Math.min(e.clientX+14,innerWidth-250)+'px';tip.style.top=(e.clientY+16)+'px'}});
document.addEventListener('mouseout',e=>{if(e.target.closest('[data-tip]'))tip.style.display='none'});
window.addEventListener('resize',fit);

buildCards();buildResearch();applyFilter();renderAll();
if('ResizeObserver' in window)new ResizeObserver(fit).observe($('#boards'));
</script>
