<script>
/* ---------------- 4A Dune field ---------------- */
B({id:'4a',code:'4A',title:'Dune field',dial:4,lead:'hip',h:640,
 idea:'The grid is gone. Every tracked cell is one ball set out on a dune, left to right in time, colored by pen, and the bare sand between them is untracked time. The day is three ridges of eight hours. The week is seven ridges receding to the horizon. Cell size is the size of the ball.',
 data:'One ball per tracked cell, so a 15-minute cell makes a ball four times as wide as a 5-minute one. Ridge position is the day, x is the time. Today’s now is a ring with a flag.',
 kept:['Same data, same keys, same states'],
 broke:['No grid, no hour rows, no zebra','Bleached sky and pink horizon','Orange-pink light and warm sand','Serif caption','Controls move into the sky'],
 src:'The Nice, Elegy (1971): about sixty red footballs on Sahara dunes, inflated overnight, land art for a record sleeve (Interview magazine). Storm’s horizon at about 64 percent down.',
 render(){
  const wk=S.span==='week',P=pal(),HZ=410;
  let ridges=[];
  if(wk)DAYS.forEach((d,i)=>ridges.push({d:i,a:0,b:1440,y:HZ+36+i*26,sc:.5+i*.085,lab:d[0]+' '+d[1].slice(4)}));
  else [0,1,2].forEach(j=>ridges.push({d:S.day,a:j*480,b:j*480+480,y:HZ+66+j*62,sc:.8+j*.18,lab:[fmtH(j*8)+' – '+fmtH(j*8+8)][0]}));
  const X0=70,XW=900;let s=`<svg width="1040" height="640" viewBox="0 0 1040 640" style="position:absolute;inset:0"><defs><linearGradient id="sk4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e3df"/><stop offset=".7" stop-color="#d4d1c8"/><stop offset="1" stop-color="#d9a9a6"/></linearGradient><linearGradient id="sd4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98f84"/><stop offset="1" stop-color="#8a5f55"/></linearGradient><radialGradient id="vg4" cx=".5" cy=".55" r=".8"><stop offset=".55" stop-color="#0000"/><stop offset="1" stop-color="#0009"/></radialGradient></defs>
   <rect width="1040" height="${HZ}" fill="url(#sk4)"/><rect y="${HZ}" width="1040" height="${640-HZ}" fill="url(#sd4)"/>`;
  ridges.forEach((rg,ri)=>{
    const ry=x=>rg.y+Math.sin(x/(110*rg.sc)+ri)*6*rg.sc+Math.sin(x/(37*rg.sc))*2.4*rg.sc;
    s+=`<path d="M0 ${ry(0)+30*rg.sc} ${Array.from({length:53},(_,k)=>`L${k*20} ${ry(k*20)}`).join(' ')} L1040 ${ry(1040)+30*rg.sc} Z" fill="#a2786c" opacity=".55"/>`;
    s+=`<text x="${X0-8}" y="${rg.y+4}" text-anchor="end" font-size="${Math.round(9+rg.sc*2)}" fill="#fff9" font-family="IBM Plex Mono">${rg.lab}</text>`;
    const cw=XW*S.cell/(rg.b-rg.a),r=Math.max(2.2,Math.min(cw*.42,16*rg.sc));
    runs(S.view,rg.d,S.cell).forEach(ru=>{const pen=P[ru.k];for(let m=Math.max(ru.s,rg.a);m<Math.min(ru.e,rg.b);m+=S.cell){const x=X0+((m-rg.a)+S.cell/2)/(rg.b-rg.a)*XW,y=ry(x)-r;
      s+=`<ellipse cx="${x+r*.5}" cy="${y+r+1}" rx="${r*1.25}" ry="${r*.28}" fill="#0004"/><circle cx="${x}" cy="${y}" r="${r}" fill="${pen[1]}" data-tip="${esc(pen[0])} · ${fmtT(ru.s)}–${fmtT(ru.e)} · ${fmtDur(ru.e-ru.s)}"/><circle cx="${x-r*.3}" cy="${y-r*.3}" r="${r*.28}" fill="#fff" opacity=".35"/>`}});
    if(isToday(rg.d)&&NOW.min>=rg.a&&NOW.min<rg.b){const x=X0+(NOW.min-rg.a)/(rg.b-rg.a)*XW,y=ry(x);s+=`<line x1="${x}" x2="${x}" y1="${y}" y2="${y-28*rg.sc}" stroke="#e04a3a" stroke-width="2"/><polygon points="${x},${y-28*rg.sc} ${x+12},${y-24*rg.sc} ${x},${y-20*rg.sc}" fill="#e04a3a"/>`}
  });
  s+=`<rect width="1040" height="640" fill="url(#vg4)"/></svg>`;
  return `<div class="b f-line" style="height:640px;--fg:#241a17;--bg:#eadfd6;background:#d4d1c8">${s}
   ${ab(24,16,990,0,`<div class="row">${viewKeys(true)}</div>`)}
   ${ab(24,58,0,0,navBar())}
   ${ab(24,108,520,0,`<div class="row" style="gap:10px 18px">${pods()}</div>`,'color:#241a17')}
   ${ab(24,190,0,0,`<div class="col" style="gap:8px"><span class="lab">Span · Cell</span><div class="row">${spanKeys()}${cellKeys()}</div></div>`)}
   ${ab(24,262,0,0,`<div class="col" style="gap:8px"><span class="lab">Tools</span><div class="row">${toolKeys(false)}</div><span class="lab">Flags</span><div class="row">${flagKeys()}</div></div>`)}
   ${ab(760,100,262,0,`<div style="background:#eadfd6cc;padding:6px;border:1px solid #241a17">${penRack(wk?8:7)}</div>`,'color:#241a17')}
   ${isEmpty()?ab(250,470,560,0,`<div style="font:italic 500 22px/1.4 var(--serif);color:#fff;text-align:center;text-shadow:0 1px 6px #0006">${esc(emptyText())}</div>`):''}
  </div>`}});

/* ---------------- 4B Enhance ---------------- */
B({id:'4b',code:'4B',title:'Enhance',dial:4,lead:'retro',h:640,
 idea:'The grid as a photograph under analysis. The week is the whole print on the right. Switching to Day zooms into one column in steps you can watch, with a bracket moving on the print and a readout counting the enhancement. Cell size is the resolution of the scan.',
 data:'The same blocks at two scales. ENHANCE is 1x for week and 7x for day. The bracket on the thumbnail is the day you are in.',
 kept:['Pen color on blocks, tinted','Every key is a bracketed command'],
 broke:['Cyan phosphor on near-black','Scanlines and corner brackets over the plot','Zoom animation in seven steps, not a smooth slide','Readout text replaces the date bar'],
 src:'The Esper machine in Blade Runner (1982): a photograph analyzed by voice with stepped zoom and a numbered grid. The interface is about showing the process (HUDs+GUIs).',
 render(){
  const wk=S.span==='week',r=read();
  const g=grid({w:688,h:480,bg:'#040a0d',col:'#06100f',line:'#7fe4ff26',lab:'#7fe4ff',font:"'Share Tech Mono',monospace",fs:11,color:c=>mix(c,'#7fe4ff',.18),
   nowFn:(c,rr)=>`<line x1="${c.x}" x2="${c.x+c.w}" y1="${rr.y}" y2="${rr.y}" stroke="#fff" stroke-width="1.5"/>`});
  const mini=grid({days:[0,1,2,3,4,5,6],w:276,h:300,lw:0,hh:0,bg:'#040a0d',col:'#06100f',line:'#7fe4ff18',now:false,font:"'Share Tech Mono'",color:c=>mix(c,'#7fe4ff',.18)});
  const bx=wk?0:S.day*276/7,bw=wk?276:276/7;
  const brk=`<div style="position:absolute;left:${bx}px;top:0;width:${bw}px;height:300px;border:1.5px solid #fff;box-shadow:0 0 12px #7fe4ff88;transition:left .5s steps(6),width .5s steps(6)"></div>`;
  return `<div class="b f-line" style="height:640px;--fg:#7fe4ff;--bg:#05090c;background:#05090c;font-family:'Share Tech Mono',monospace;color:#7fe4ff">
   <div style="position:absolute;inset:0;pointer-events:none;z-index:4;background:repeating-linear-gradient(#0000 0 2px,#00000033 2px 3px)"></div>
   ${ab(24,24,700,520,`<div class="enh" style="position:relative;width:688px;height:480px;margin:6px">${g}</div>${[[0,0],[1,0],[0,1],[1,1]].map(([a,b])=>`<span style="position:absolute;${a?'right':'left'}:0;${b?'bottom':'top'}:0;width:22px;height:22px;border:2px solid #7fe4ff;border-${a?'left':'right'}:0;border-${b?'top':'bottom'}:0"></span>`).join('')}<div style="position:absolute;right:14px;top:12px;font:400 14px 'Share Tech Mono';color:#fff;background:#05090ccc;padding:2px 6px">ENHANCE ${wk?'1':'7'}x · RES ${S.cell}M</div>`,'')}
   ${isEmpty()?ab(80,200,560,0,`<div style="z-index:5;font:400 16px/1.5 'Share Tech Mono';color:#fff;background:#05090cee;border:1px solid #7fe4ff;padding:12px;position:relative">${esc(emptyText().toUpperCase())}</div>`):''}
   ${ab(748,24,276,300,`<div style="position:relative;width:276px;height:300px;outline:1px solid #7fe4ff66">${mini}${brk}</div>`)}
   ${ab(748,336,276,0,`<div style="font:400 14px/1.55 'Share Tech Mono'">FILE&nbsp; B2-TRK-${String(S.day+19).padStart(4,'0')}<br>SPAN&nbsp; ${S.span.toUpperCase()} · ${esc(spanLab()).toUpperCase()}<br>VIEW&nbsp; ${esc(VNAME[S.view]).toUpperCase()}<br>TRK&nbsp;&nbsp; <span style="color:#fff">${fmtDur(r.tracked).toUpperCase()}</span> · ${Math.round(r.pct)}%<br>DAYS&nbsp; ${r.days}/${r.n}</div><div class="lab" style="margin:10px 0 4px">Pens</div>${penRack(4)}`)}
   ${ab(24,562,1000,0,`<div class="row" style="gap:6px 8px">${viewKeys(true)}</div><div class="row" style="gap:6px 10px;margin-top:8px">${navBar()}${spanKeys()}${cellKeys()}</div><div class="row" style="gap:6px 8px;margin-top:8px">${toolKeys(false)}${flagKeys()}${glassKeys()}</div>`)}
  </div>`}});

/* ---------------- 4C Record ---------------- */
const arc=(cx,cy,r1,r2,t0,t1)=>{const p=(r,t)=>[cx+r*Math.sin(t),cy-r*Math.cos(t)];const [a,b]=[p(r2,t0),p(r2,t1)],[c,d]=[p(r1,t1),p(r1,t0)];const lg=t1-t0>Math.PI?1:0;
  return `M${a} A${r2} ${r2} 0 ${lg} 1 ${b} L${c} A${r1} ${r1} 0 ${lg} 0 ${d} Z`};
B({id:'4c',code:'4C',title:'The record',dial:4,lead:'blend',h:640,
 idea:'The week is a record. One groove per day, midnight at twelve o’clock and the hours running clockwise, Monday on the outside, so time spirals in as it does on a disc. Day view is the same record cut into four six-hour grooves. The tonearm sits on now when you are looking at today. The label in the middle holds the readouts.',
 data:'Every block as a painted arc on its groove. The needle is now. The label shows tracked time, percent, and the cell size as the record speed.',
 kept:['Pen color on every arc','All keys in label tape, all states'],
 broke:['No rectangular grid at all','Black vinyl, cream label, red state key','A serif face on the label','Polar axis instead of a time column'],
 src:'Gatefold LP sleeves were “a place to exercise our magic” (Storm Thorgerson, Seconds #46). Marey’s chronophotography wrapped motion onto one plate. Teenage Engineering and Braun put one theory of use on the panel.',
 render(){
  const wk=S.span==='week',P=pal(),cx=350,cy=322,R=290;
  const rings=wk?DAYS.map((d,i)=>({d:i,a:0,b:1440,ro:R-i*25,w:22,lab:d[0]})):[0,1,2,3].map(j=>({d:S.day,a:j*360,b:j*360+360,ro:R-j*44,w:40,lab:fmtH(j*6)}));
  const r=read();let s=`<svg width="700" height="640" viewBox="0 0 700 640" style="position:absolute;left:0;top:0"><defs><radialGradient id="vin" cx=".5" cy=".5" r=".5"><stop offset=".92" stop-color="#1b1b1d"/><stop offset="1" stop-color="#050505"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${R+8}" fill="url(#vin)" stroke="#2a2a2d" stroke-width="2"/>`;
  rings.forEach(rg=>{
    s+=`<circle cx="${cx}" cy="${cy}" r="${rg.ro-rg.w/2}" fill="none" stroke="#2c2c30" stroke-width="${rg.w}"/>`;
    for(let q=0;q<4;q++){const t=q*Math.PI/2;s+=`<line x1="${cx+(rg.ro-rg.w)*Math.sin(t)}" y1="${cy-(rg.ro-rg.w)*Math.cos(t)}" x2="${cx+rg.ro*Math.sin(t)}" y2="${cy-rg.ro*Math.cos(t)}" stroke="#ffffff22"/>`}
    runs(S.view,rg.d,S.cell).forEach(ru=>{const a=Math.max(ru.s,rg.a),b=Math.min(ru.e,rg.b);if(b<=a)return;const pen=P[ru.k],sp=rg.b-rg.a;
      s+=`<path d="${arc(cx,cy,rg.ro-rg.w+1.5,rg.ro-1.5,(a-rg.a)/sp*Math.PI*2,(b-rg.a)/sp*Math.PI*2)}" fill="${mix(pen[1],'#ffffff',.18)}" data-tip="${esc(pen[0])} · ${fmtT(ru.s)}–${fmtT(ru.e)} · ${fmtDur(ru.e-ru.s)}"/>`});
    s+=`<text x="${cx+4}" y="${cy-rg.ro+rg.w*.6}" font-size="${wk?9:11}" fill="#ece6da" font-family="IBM Plex Mono" opacity=".85">${rg.lab}</text>`;
  });
  const ti=wk?NOW.day:Math.floor(NOW.min/360),tr=rings.find(x=>x.d===NOW.day&&NOW.min>=x.a&&NOW.min<x.b);
  const tx=tr?cx+(tr.ro-tr.w/2)*Math.sin((NOW.min-tr.a)/(tr.b-tr.a)*Math.PI*2):cx+R+30,ty=tr?cy-(tr.ro-tr.w/2)*Math.cos((NOW.min-tr.a)/(tr.b-tr.a)*Math.PI*2):cy-R+10;
  s+=`<circle cx="${cx}" cy="${cy}" r="86" fill="#e8e0cc"/><circle cx="${cx}" cy="${cy}" r="86" fill="none" stroke="#0006"/><circle cx="${cx}" cy="${cy}" r="4" fill="#111"/>
   <text x="${cx}" y="${cy-48}" text-anchor="middle" font-size="9" letter-spacing="3" fill="#3a3128" font-family="IBM Plex Mono">SIDE A · ${S.cell} MIN</text>
   <text x="${cx}" y="${cy-22}" text-anchor="middle" font-size="26" fill="#241d15" font-family="Cormorant Garamond" font-style="italic" font-weight="600">${fmtDur(r.tracked)}</text>
   <text x="${cx}" y="${cy+30}" text-anchor="middle" font-size="12" fill="#3a3128" font-family="IBM Plex Mono">${Math.round(r.pct)}% OF ${S.span.toUpperCase()}</text>
   <text x="${cx}" y="${cy+52}" text-anchor="middle" font-size="9" letter-spacing="2" fill="#3a3128" font-family="IBM Plex Mono">${esc(spanLab()).toUpperCase()}</text>
   <line x1="640" y1="50" x2="${tx}" y2="${ty}" stroke="#c9c3b7" stroke-width="5" stroke-linecap="round"/><circle cx="640" cy="50" r="15" fill="#2d2d30" stroke="#8a8a8e" stroke-width="3"/><circle cx="${tx}" cy="${ty}" r="5" fill="#e04a3a" stroke="#fff" stroke-width="1.2"/></svg>`;
  return `<div class="b f-dymo" style="height:640px;background:radial-gradient(ellipse at 35% 50%,#1b1a1c,#070708 75%);color:#ece6da">${s}
   <div class="spin" style="position:absolute;left:${cx-R}px;top:${cy-R}px;width:${R*2}px;height:${R*2}px;border-radius:50%;pointer-events:none;background:conic-gradient(from 20deg,#fff0,#ffffff1f 8%,#fff0 22%,#fff0 50%,#ffffff1f 58%,#fff0 72%)"></div>
   ${ab(716,16,310,0,`<div class="col" style="gap:10px"><div class="row" style="gap:5px">${viewKeys(true)}</div><div style="margin-top:4px">${navBar()}</div><span class="lab">Span · Cell</span><div class="row">${spanKeys()}</div><div class="row">${cellKeys()}</div><span class="lab">Tools</span><div class="row">${toolKeys(false)}</div><span class="lab">Flags</span><div class="row">${flagKeys()}</div><span class="lab">Pens</span><div>${penRack(6)}</div></div>`)}
   ${isEmpty()?ab(150,290,400,0,`<div style="font:italic 500 18px/1.4 var(--serif);color:#e8e0cc;text-align:center;background:#000a;padding:10px">${esc(emptyText())}</div>`):''}
  </div>`}});

/* ---------------- 4D Go 2 ---------------- */
B({id:'4d',code:'4D',title:'This is a time grid',dial:4,lead:'hip',h:640,
 idea:'The screen is a paragraph that says what it is, and the words are the controls. Underneath, the day is set as type: each block is a run of words as wide as the minutes it covers. It uses the real numbers, the real shortcut names, and the real state.',
 data:'Every control from the app as a link in the sentence. The typeset grid: four lines of six hours for a day, seven lines of a day for a week. Block width is minutes.',
 kept:['Every action reachable','The empty state is the same sentence with the numbers filled in'],
 broke:['Black page, white mono, no chrome at all','No keys, no pods, no rack: all text','One size of type'],
 src:'XTC, Go 2 (1978): a sleeve that is only an essay about sleeves. It opens: “This is a RECORD COVER. This writing is the DESIGN upon the record cover.” (Wikipedia). It was re-written for each format.',
 render(){
  const wk=S.span==='week',P=pal(),r=read();
  const lines=wk?DAYS.map((d,i)=>({d:i,a:0,b:1440,lab:d[0]+' '+d[1].slice(4)})):[0,1,2,3].map(j=>({d:S.day,a:j*360,b:j*360+360,lab:fmtH(j*6)+'–'+fmtH(j*6+6)}));
  const LW=900,bh=wk?24:34;
  const set=lines.map(l=>{
    let seg='';runs(S.view,l.d,S.cell).forEach(ru=>{const a=Math.max(ru.s,l.a),b=Math.min(ru.e,l.b);if(b<=a)return;const pen=P[ru.k],w=(b-a)/(l.b-l.a)*LW;
      seg+=`<span data-tip="${esc(pen[0])} · ${fmtT(ru.s)}–${fmtT(ru.e)} · ${fmtDur(ru.e-ru.s)}" style="position:absolute;left:${(a-l.a)/(l.b-l.a)*LW}px;width:${w}px;height:${bh}px;background:${pen[1]};color:${lum(pen[1])>140?'#000':'#fff'};font:500 11px/${bh}px var(--mono);overflow:hidden;white-space:nowrap;text-overflow:clip;padding:0 4px">${w>40?esc(pen[0]):''}</span>`});
    const nw=isToday(l.d)&&NOW.min>=l.a&&NOW.min<l.b?`<span style="position:absolute;left:${(NOW.min-l.a)/(l.b-l.a)*LW}px;top:-3px;width:2px;height:${bh+6}px;background:#fff"></span>`:'';
    const ticks=Array.from({length:(wk?8:6)+1},(_,k)=>{const m=l.a+k*(l.b-l.a)/(wk?8:6);return `<span style="position:absolute;left:${k*LW/(wk?8:6)}px;top:${bh+1}px;font:400 9px var(--mono);color:#888;transform:translateX(-30%)">${fmtH(Math.floor(m/60)%24)}</span>`}).join('');
    return `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${wk?14:20}px"><span style="width:84px;font:400 11px/${bh}px var(--mono);color:#aaa;text-align:right;flex:none">${l.lab}</span><div style="position:relative;width:${LW}px;height:${bh}px;border-bottom:1px solid #444">${seg}${nw}${ticks}</div></div>`}).join('');
  const lk=(label,on,attr)=>`<button class="k${on?' on':''}" ${attr}>${label}</button>`;
  const list=(arr)=>arr.join(', ');
  return `<div class="b f-line" style="height:640px;background:#000;--fg:#fff;--bg:#000;color:#fff;font:400 13.5px/1.75 var(--mono)">
   <style>.b4d .k{display:inline;padding:0 1px;border:0;background:none;color:#fff;text-decoration:underline;text-underline-offset:3px;font:inherit;letter-spacing:0;text-transform:none}.b4d .k.on{background:#fff;color:#000;text-decoration:none}.b4d .nav{display:inline-flex;gap:8px}.b4d .dt{padding:0;min-width:0;font:inherit;letter-spacing:0}.b4d .confirm{display:inline}.b4d .pn{display:inline-flex;width:auto;padding:0 2px;font:inherit;text-decoration:underline}.b4d .pn i{display:none}.b4d .pn.on{background:#fff;color:#000;text-decoration:none}</style>
   <div class="b4d" style="position:absolute;left:32px;top:26px;width:976px">
    <p style="margin:0 0 10px">This is a TIME GRID. This writing is the DESIGN upon the time grid. You are looking at <b>${esc(spanLab())}</b>, one ${S.span}, in ${lk(VNAME[S.view],true,`data-set="view:${S.view}"`)}. ${fmtDur(r.tracked)} of it is tracked, which is ${Math.round(r.pct)}% of the ${S.span}${isEmpty()?'. '+esc(emptyText()):'.'}</p>
    <p style="margin:0 0 10px">Look at ${list(VIEWS.filter(v=>v[0]!==S.view).map(v=>lk(v[1],false,`data-set="view:${v[0]}"`)))} instead. Read it as ${lk('Day',S.span==='day','data-set="span:day"')}, ${lk('Week',S.span==='week','data-set="span:week"')} or ${lk('Scroll ∞',false,'data-act="toast:Infinite scroll is one continuous strip in the app. It is not mocked in this lab."')}, in cells of ${CELLS[S.span].map((n,i,a)=>lk(n+' min',S.cell===n,`data-set="cell:${n}"`)).join(', ')}. Move with ${navBar()}.</p>
    <p style="margin:0 0 10px">To record time, pick ${list(totals().list.slice(0,6).map(p=>`<button class="pn${p.k===selPen()?' on':''}" data-pen="${p.k}">${esc(p.n)}</button>`))} and use ${TOOLS.map((t,i)=>lk(t[1],S.tool===t[0],`data-tool="${t[0]}"`)).join(', ')}. Switch on ${FLAGS.map(f=>lk(f[1],!!S.flags[f[0]],`data-flag="${f[0]}"`)).join(', ')}. The plot is ${lk('Glass',S.glass==='glass','data-glass="glass"')} or ${lk('Paper',S.glass==='paper','data-glass="paper"')}.</p>
    <div style="margin-top:18px">${set}</div>
   </div>
  </div>`.replace('<div class="b f-line"','<div class="b f-line"')}});
</script>
