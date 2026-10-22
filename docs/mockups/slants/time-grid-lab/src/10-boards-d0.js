<script>
const ab=(x,y,w,h,inner,st='')=>`<div style="position:absolute;left:${x}px;top:${y}px;${w?`width:${w}px;`:''}${h?`height:${h}px;`:''}${st}">${inner}</div>`;
const graphBg=(a,b,s=24)=>`background:${a};background-image:linear-gradient(${b} 1px,transparent 1px),linear-gradient(90deg,${b} 1px,transparent 1px);background-size:${s}px ${s}px`;

/* ---------------- 0A Presence ---------------- */
B({id:'0a',code:'0A',title:'Presence on the plot',dial:0,lead:'hip',h:640,
 idea:'One black slab stands on the today line and carries the time left. Its height is the minutes still ahead today. Its shadow, cast across the column, is the time already behind. A small plate in the left rail shows the same slab in a bleached landscape.',
 data:'Minutes left today (1440 − now) and minutes elapsed. The slab moves with the clock. The plate develops in on load.',
 kept:['Cool paper and graph rule','Silver keys, CRT-lit active key','Red now line language, now a slab','Self-describing empty state in plain mono'],broke:[],
 src:'Led Zeppelin, Presence (1976): Storm Thorgerson wanted an object from the future set into a nostalgic photograph. XTC, Go 2 (1978) for the empty text.',
 render(){
  const left=1440-NOW.min,el=NOW.min,sh=96*(left/1440);
  const plate=`<svg class="dev" width="250" height="150" viewBox="0 0 250 150"><defs><linearGradient id="sk0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9eef2"/><stop offset="1" stop-color="#c3cfda"/></linearGradient><radialGradient id="vg0" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#0000"/><stop offset="1" stop-color="#0007"/></radialGradient></defs>
   <rect width="250" height="96" fill="url(#sk0)"/><rect y="96" width="250" height="54" fill="#3a434c"/>
   <polygon points="${125+7},96 ${125+7+el/1440*180+4},97 ${125+7+el/1440*180+4},101 ${125+7},100" fill="#0008"/>
   <rect x="125" y="${96-sh}" width="7" height="${sh}" fill="#0b0c0e"/><rect x="125" y="${96-sh}" width="2" height="${sh}" fill="#ffffff22"/>
   <rect width="250" height="150" fill="url(#vg0)"/></svg>`;
  const g=grid({w:560,h:520,bg:'#f4f7f9',zebra:'#dfe7ee99',line:'#9fb0bf99',lab:'#4a5a6a',col:'#fbfdfe',
   nowFn:(c,r)=>`<line x1="${c.x}" x2="${c.x+c.w}" y1="${r.y}" y2="${r.y}" stroke="#0b0c0e" stroke-width=".8"/><polygon points="${c.x+c.w*.5+7},${r.y} ${c.x+c.w-8},${r.y-1} ${c.x+c.w-8},${r.y+3} ${c.x+c.w*.5+7},${r.y+2}" fill="#0b0c0e44"/><rect x="${c.x+c.w*.5}" y="${r.y-24}" width="7" height="24" fill="#0b0c0e"/>`});
  return `<div class="b f-house" style="height:640px;${graphBg('#e4eaef','#c3cdd788')}">
   ${ab(16,12,1008,0,`<div class="row">${viewKeys(true)}</div>`)}
   ${ab(16,60,250,150,plate,'border:2px solid #1b2128;box-shadow:0 2px 6px #0004')}
   ${ab(16,216,250,0,`<div class="lab" style="margin-bottom:5px">Left today · ${fmtDur(left)} · behind ${fmtDur(el)}</div><div class="row" style="gap:8px">${pods()}</div>`)}
   ${ab(16,350,250,274,`<div class="lab" style="padding:0 6px 4px">Pens · ${S.view}</div>${penRack(10)}`,'background:#f4f7f9;border:1px solid #8794a2;overflow:hidden')}
   ${ab(282,60,560,0,navBar())}
   ${ab(282,104,560,520,g,'border:2px solid #1b2128')}
   ${isEmpty()?ab(300,170,520,0,`<div style="font:500 14px/1.7 var(--mono);color:#17202a;background:#f4f7f9ee;padding:16px;border:1px solid #8794a2">${esc(emptyText())}</div>`):''}
   ${ab(858,60,166,0,`<div class="col"><span class="lab">Span</span><div class="row">${spanKeys()}</div><span class="lab">Cell</span><div class="row">${cellKeys()}</div><span class="lab">Tools</span><div class="col" style="align-items:stretch">${toolKeys()}</div><span class="lab">Flags</span><div class="col" style="align-items:stretch">${flagKeys()}</div><span class="lab">Display</span><div class="row">${glassKeys()}</div></div>`)}
  </div>`}});

/* ---------------- 0B DSKY ---------------- */
B({id:'0b',code:'0B',title:'Span panel with caution lamps',dial:0,lead:'retro',h:640,
 idea:'Span, cell size and view move off a row of tabs and onto a small mission-control keypad. Three readouts in seven-segment digits show the program, verb and noun. A lamp grid lights for every view that has data, and a click on a lamp switches to it.',
 data:'PROG = span, VERB = cell minutes, NOUN = view number. R1 = tracked minutes, R2 = percent, R3 = days with data. Each lamp shows the minutes in that view.',
 kept:['Silver and grey chrome','Lamps light, they never blink','Cool paper behind the plot','One lit color per meaning'],broke:[],
 src:'Apollo Guidance Computer DSKY, 1966 to 1975. Ron Cobb labels on every surface (Alien, 1979). See also the style lab board 0b.',
 render(){
  const r=read(),vi=VIEWS.findIndex(v=>v[0]===S.view)+1;
  const lamp=VIEWS.map((v,i)=>{const t=totals(spanDays(),v[0]).sum;return `<button class="lamp${t?' lit':''}${S.view===v[0]?' sel':''}" data-set="view:${v[0]}" aria-pressed="${S.view===v[0]}">${v[2].toUpperCase()}<b>${t?t:'—'}</b></button>`}).join('');
  const reg=(l,t)=>`<div class="rg"><span>${l}</span>${seg7(t,{w:15,h:26,gap:5,on:'#8dffd0',off:'#8dffd018'})}</div>`;
  const pad=(n,l)=>String(Math.round(n)).padStart(l,'0');
  const g=grid({w:612,h:446,bg:'#f4f7f9',zebra:'#dfe7ee99',line:'#9fb0bf99',lab:'#4a5a6a',col:'#fbfdfe'});
  return `<div class="b f-house b0b" style="height:640px;background:#aeb9c2;${S.glass==='x'?'':''}">
  <style>.b0b .dsky{background:linear-gradient(#444b52,#2d3338);border:2px solid #14181b;border-radius:6px;box-shadow:inset 0 1px #6a727a,0 4px 10px #0005}
  .b0b .el{background:#06130e;border:2px solid #000;border-radius:3px;padding:12px 14px;box-shadow:inset 0 0 20px #000;display:flex;flex-direction:column;gap:8px}
  .b0b .rg{display:flex;justify-content:space-between;align-items:center}.b0b .rg span{font:500 10px var(--mono);letter-spacing:.2em;color:#4fae8a}
  .b0b .lamp{height:50px;border:1px solid #0b0d0f;border-radius:3px;background:#3c4349;color:#8f989f;font:500 9px var(--mono);letter-spacing:.1em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer}
  .b0b .lamp b{font:600 14px var(--mono)}.b0b .lamp.lit{background:#cfe9f7;color:#0b2d44;box-shadow:0 0 12px #9dd3f07a}.b0b .lamp.sel{outline:2px solid #fff;outline-offset:1px}
  .b0b .kp{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.b0b .kp .k{justify-content:center}</style>
  ${ab(16,16,344,608,`<div class="dsky" style="height:100%;padding:14px;display:flex;flex-direction:column;gap:12px">
    <span class="lab" style="color:#c7cfd6">Span · cell · view</span>
    <div class="el">${reg('PROG',pad(S.span==='day'?1:2,2))}${reg('VERB',pad(S.cell,2))}${reg('NOUN',pad(vi,2))}<div style="height:1px;background:#1f4a39"></div>${reg('R1','+'+pad(r.tracked,5))}${reg('R2','+'+pad(r.pct,5))}${reg('R3','+'+pad(r.days,5))}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${lamp}</div>
    <div class="kp">${kb('Verb',false,'data-act="cyc:cell"','Next cell size')}${kb('Noun',false,'data-act="cyc:view"','Next view')}${kb('Pro',false,'data-act="cyc:span"','Day or week')}${kb('Clr',false,'data-act="clear"','Clear')}${kb('Entr',false,'data-act="today"','Today')}</div>
    <div class="pod" style="margin-top:auto"><span>Tracked</span><b>${fmtDur(r.tracked)}</b><small>R1 = Σ(eᵢ − sᵢ) minutes</small></div></div>`)}
  ${ab(376,16,648,36,navBar(),'color:#17202a')}
  ${ab(376,64,648,470,`<div style="border:2px solid #1b2128;width:fit-content">${g}</div>`)}
  ${isEmpty()?ab(420,150,520,0,`<div style="font:500 14px/1.7 var(--mono);background:#f4f7f9ee;padding:16px;border:1px solid #8794a2;color:#17202a">${esc(emptyText())}</div>`):''}
  ${ab(376,548,648,76,`<div class="row" style="gap:6px 14px;align-items:flex-start"><div class="col"><span class="lab">Tools</span><div class="row">${toolKeys(false)}</div></div><div class="col"><span class="lab">Flags</span><div class="row">${flagKeys()}</div></div><div class="col"><span class="lab">Display</span><div class="row">${glassKeys()}</div></div></div>`)}
  </div>`}});

/* ---------------- 0C The math, shown ---------------- */
B({id:'0c',code:'0C',title:'The math, shown',dial:0,lead:'retro',h:640,
 idea:'A drawer under the readouts. It writes the formulas with the real numbers in them and plots the day as a running total against the clock. The gap between the total and the diagonal is the untracked time. It also shows what the cell size costs: the grid only draws what its cells can hold.',
 data:'Tracked T, the percent of day or week, each pen as a share of T, cumulative minutes against time, and the minutes the current cell size draws against the minutes recorded.',
 kept:['Cool paper family, here as a graph-rule night variant','Optional, behind a setting','No decoration: every mark is a number'],broke:[],
 src:'Teaching-plot grammar after 3Blue1Brown: draw the curve on, label the one number that matters. The Show the math switch in the bench turns the same formulas on across every board.',
 render(){
  const r=read(),n=r.n,days=spanDays(),X0=70,Y0=470,PW=420,PH=420,tot=1440*n;
  const sx=t=>X0+t/tot*PW,sy=m=>Y0-m/tot*PH;
  let cum=0,segs='',pts=[[0,0]];
  days.forEach((d,i)=>rawRuns(S.view,d).forEach(ru=>{const a=i*1440+ru.s,b=i*1440+ru.e,p=pal()[ru.k];
    segs+=`<line x1="${sx(pts[pts.length-1][0])}" y1="${sy(cum)}" x2="${sx(a)}" y2="${sy(cum)}" stroke="#7d8da3" stroke-width="2"/>`;
    segs+=`<line x1="${sx(a)}" y1="${sy(cum)}" x2="${sx(b)}" y2="${sy(cum+ru.e-ru.s)}" stroke="${p?mix(p[1],'#ffffff',.35):'#fff'}" stroke-width="4" stroke-linecap="round"/>`;
    cum+=ru.e-ru.s;pts.push([b,cum])}));
  const endx=sx(pts[pts.length-1][0]);segs+=`<line x1="${endx}" y1="${sy(cum)}" x2="${sx(tot)}" y2="${sy(cum)}" stroke="#7d8da3" stroke-width="2"/>`;
  const gap=`<polygon points="${X0},${Y0} ${X0+PW},${Y0-PH} ${X0+PW},${sy(cum)} ${endx},${sy(cum)}" fill="#ff8080" opacity=".14"/>`;
  let ticks='';for(let i=0;i<=4;i++){const t=tot*i/4;ticks+=`<line x1="${sx(t)}" x2="${sx(t)}" y1="${Y0}" y2="${Y0+5}" stroke="#9fb0c3"/><text x="${sx(t)}" y="${Y0+20}" fill="#9fb0c3" font-size="11" text-anchor="middle">${n>1?'day '+(i*7/4).toFixed(i%4?1:0):fmtH(i*6)}</text><line x1="${X0}" x2="${X0+PW}" y1="${sy(t)}" y2="${sy(t)}" stroke="#ffffff10"/><text x="${X0-8}" y="${sy(t)+4}" fill="#9fb0c3" font-size="11" text-anchor="end">${Math.round(t/60)}h</text>`}
  const drawn=days.reduce((a,d)=>a+runs(S.view,d,S.cell).reduce((x,y)=>x+y.e-y.s,0),0);
  const top=r.list.filter(p=>p.m).slice(0,4);
  const F=(s)=>`<div style="font:italic 500 25px/1.35 var(--serif);color:#e8eef6">${s}</div>`;
  return `<div class="b" style="height:640px;color:#cfd9e6;${graphBg('#0e1a2b','#ffffff0c',32)}">
   ${ab(36,34,430,0,`<div class="lab" style="color:#8fb4da;margin-bottom:8px">Tracked</div>${F(`T = Σ ( e<sub>i</sub> − s<sub>i</sub> ) = <span style="color:#58c4dd">${r.tracked}</span> min`)}<div style="font:400 13px var(--mono);margin:2px 0 18px;color:#9fb0c3">= ${fmtDur(r.tracked)} across ${rawRuns(S.view,days[0]).length||0}${n>1?'+':''} blocks</div>
    <div class="lab" style="color:#8fb4da;margin-bottom:8px">Of ${S.span}</div>${F(`T ÷ ${tot} = <span style="color:#58c4dd">${r.pct.toFixed(1)}%</span>`)}
    <div class="lab" style="color:#8fb4da;margin:18px 0 8px">Share of each pen</div>${F('share<sub>p</sub> = T<sub>p</sub> ÷ T')}
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:5px">${top.map(p=>`<div style="display:flex;align-items:center;gap:8px;font:500 12px var(--mono)"><span style="width:110px">${esc(p.n)}</span><span style="height:9px;background:${mix(p.c,'#ffffff',.3)};width:${Math.max(3,p.m/(top[0].m||1)*190)}px"></span><span>${(p.m/(r.tracked||1)*100).toFixed(0)}%</span></div>`).join('')||'<span style="font:12px var(--mono);color:#9fb0c3">No pens to share yet.</span>'}</div>
    <div class="lab" style="color:#8fb4da;margin:20px 0 8px">What ${S.cell}-minute cells draw</div>${F(`Σ cells × ${S.cell} = <span style="color:#58c4dd">${drawn}</span> min`)}
    <div style="font:400 13px var(--mono);color:#9fb0c3;margin-top:2px">${drawn===r.tracked?'The cells hold every recorded minute.':`Recorded ${r.tracked}. The grid drops ${r.tracked-drawn} min that do not fill half a cell.`}</div>`)}
   ${ab(500,30,520,590,`<svg width="520" height="590" viewBox="0 0 520 590" style="font-family:var(--mono)">
    <text x="${X0}" y="26" fill="#e8eef6" font-size="15" font-family="Cormorant Garamond" font-style="italic">C(t) = tracked minutes up to time t</text>
    <rect x="${X0}" y="${Y0-PH}" width="${PW}" height="${PH}" fill="none" stroke="#ffffff22"/>${ticks}${gap}
    <line x1="${X0}" y1="${Y0}" x2="${X0+PW}" y2="${Y0-PH}" stroke="#9fb0c3" stroke-dasharray="5 5" stroke-width="1.4"/>
    <text x="${X0+PW-6}" y="${Y0-PH+16}" fill="#9fb0c3" font-size="11" text-anchor="end">every minute tracked</text>
    <g>${segs}</g>
    <circle cx="${endx}" cy="${sy(cum)}" r="5" fill="#58c4dd"/><text x="${Math.min(endx+10,X0+PW-110)}" y="${sy(cum)-12}" fill="#58c4dd" font-size="12">${fmtDur(cum)}</text>
    <text x="${X0+PW/2}" y="${Y0+46}" fill="#9fb0c3" font-size="11" text-anchor="middle">${n>1?'day of week':'time of day'}</text>
    <text x="${X0+170}" y="${Y0-34}" fill="#ff9a9a" font-size="12" opacity=".9">untracked</text>
    </svg>`)}
  </div>`}});
</script>
