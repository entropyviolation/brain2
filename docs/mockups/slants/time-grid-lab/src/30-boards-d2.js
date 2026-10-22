<script>
/* ---------------- 2A Escalator ---------------- */
const robotA=(x,y,s=1)=>`<g transform="translate(${x},${y}) scale(${s})" stroke="#15130f" stroke-width="1.4" fill="#e9e4d6cc" stroke-linejoin="round"><rect x="-8" y="-34" width="16" height="14"/><rect x="-11" y="-20" width="22" height="22"/><path d="M-6 2v14M6 2v14M-11 -16h-7v12M11 -16h7v12" fill="none"/><rect x="-4" y="-30" width="8" height="3" fill="#15130f"/></g>`;
const robotB=(x,y,s=1)=>`<g transform="translate(${x},${y}) scale(${s})" stroke="#15130f" stroke-width="1.4" fill="#e9e4d6cc"><circle cx="0" cy="-28" r="8"/><ellipse cx="0" cy="-8" rx="12" ry="14"/><path d="M-5 5c-1 8-2 10-2 12M5 5c1 8 2 10 2 12M-12 -12c-8 2-9 8-6 14M12 -12c8 2 9 8 6 14" fill="none"/><circle cx="-3" cy="-29" r="1.3" fill="#15130f"/><circle cx="3" cy="-29" r="1.3" fill="#15130f"/></g>`;
function stair(d,ox,oy,dx,dy,th){
  const P=pal();let s='';
  const rs=runs(S.view,d,S.cell);
  for(let i=0;i<24;i++){
    const x=ox+i*dx,y=oy-i*dy;
    s+=`<rect x="${x}" y="${y}" width="${dx+.5}" height="${dy+th+2}" fill="#3b372f"/><rect x="${x}" y="${y+th}" width="${dx+.5}" height="${dy}" fill="url(#riser)"/><rect x="${x}" y="${y}" width="${dx+.5}" height="${th}" fill="#bdb6a6"/>`;
  }
  rs.forEach(ru=>{for(let i=Math.floor(ru.s/60);i<=Math.floor((ru.e-1)/60);i++){const a=Math.max(ru.s,i*60),b=Math.min(ru.e,i*60+60),pen=P[ru.k];
    s+=`<rect x="${ox+i*dx+(a-i*60)/60*dx}" y="${oy-i*dy}" width="${Math.max((b-a)/60*dx,.8)}" height="${th}" fill="${pen[1]}" data-tip="${esc(pen[0])} · ${fmtT(ru.s)}–${fmtT(ru.e)} · ${fmtDur(ru.e-ru.s)}"/>`}});
  return s;
}
B({id:'2a',code:'2A',title:'Escalator day',dial:2,lead:'hip',h:640,
 idea:'The day is a moving staircase. Each hour is a step, midnight at the foot, 11 PM at the top. The minutes painted in an hour are colored strips on that tread. Two robots, one angular and one curved, meet at the step where the record stops: now, on today.',
 data:'All blocks, laid on their hour step. The robot pair stands on the last tracked minute of the day, or on now for today. Week view is seven short flights side by side.',
 kept:['Pen color is the only chroma on the treads','Every key remains, in single-weight line type'],
 broke:['Hour axis is a diagonal, not a vertical column','Warm ochre wash over the photo (house bans amber light)','A serif face for the plate title','Two faces, drawn as robots'],
 src:'Black Sabbath, Technical Ecstasy (1976): two robots on an escalator, George Hardie drew the robots and Richard Manning airbrushed them onto a dye-transfer print. Alan Parsons Project, I Robot (1977): escalator tubes at an airport.',
 render(){
  const wk=S.span==='week';let body='';
  const lastEnd=d=>{const r=runs(S.view,d,S.cell);return r.length?r[r.length-1].e:isToday(d)?NOW.min:null};
  const robots=(ox,oy,dx,dy,th,d,sc)=>{const m=isToday(d)?NOW.min:lastEnd(d);if(m==null)return '';const i=Math.min(22,Math.floor(m/60));const x=ox+i*dx+dx/2,y=oy-i*dy;return robotA(x-8*sc,y,sc*.9)+robotB(x+14*sc,y-dy,sc*.9)};
  if(!wk)body=stair(S.day,60,520,35,17,11)+robots(60,520,35,17,11,S.day,1.1);
  else body=DAYS.map((d,i)=>{const ox=30+i*140,oy=420;return `<g>${stair(i,ox,oy,5.3,3.4,5)}${robots(ox,oy,5.3,3.4,5,i,.55)}<text x="${ox}" y="${oy+34}" font-size="10" fill="#15130f" font-family="IBM Plex Mono">${d[0]} ${d[1].slice(4)}</text><text x="${ox}" y="${oy+48}" font-size="10" fill="#15130f" font-family="IBM Plex Mono" font-weight="600">${totals([i]).sum?fmtDur(totals([i]).sum):'—'}</text></g>`}).join('');
  const hrs=!wk?Array.from({length:8},(_,j)=>{const i=j*3+0;return `<text x="${60+i*35+2}" y="${520-i*17+36}" font-size="10" fill="#15130f" font-family="IBM Plex Mono">${fmtH(i)}</text>`}).join(''):'';
  return `<div class="b f-line" style="height:640px;background:linear-gradient(#dcd9cf 0 62%,#d7aea9 62% 63%,#b9a49b 63%);--fg:#15130f;--bg:#e9e4d6">
   <svg width="1040" height="640" viewBox="0 0 1040 640" style="position:absolute;inset:0"><defs><linearGradient id="riser" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a463d"/><stop offset=".5" stop-color="#7d776a"/><stop offset="1" stop-color="#4a463d"/></linearGradient><radialGradient id="vg2" cx=".5" cy=".5" r=".8"><stop offset=".5" stop-color="#0000"/><stop offset="1" stop-color="#000a"/></radialGradient></defs>
    <rect width="1040" height="640" fill="#c9a45c" opacity=".18"/>
    <line x1="${wk?20:50}" y1="${wk?340:140}" x2="${wk?1020:1000}" y2="${wk?340:140}" stroke="none"/>
    ${body}${hrs}<rect width="1040" height="640" fill="url(#vg2)"/></svg>
   ${ab(24,14,990,0,`<div class="row">${viewKeys(true)}</div>`)}
   ${ab(24,56,0,0,navBar())}
   ${ab(24,584,1000,0,`<div class="row" style="gap:10px 22px;align-items:center"><div class="row" style="gap:12px">${pods()}</div><div class="row">${spanKeys()}</div><div class="row">${cellKeys()}</div><div class="row">${toolKeys(false)}</div><div class="row">${flagKeys()}</div></div>`)}
   ${ab(330,96,320,0,`<div style="font:600 34px/1 var(--serif);font-style:italic;color:#15130f;text-align:left">Technical<br>Time</div><div style="font:500 10px var(--mono);letter-spacing:.2em;text-align:left;margin-top:8px;color:#15130f">PLATE 2A · ${esc(spanLab()).toUpperCase()}</div>`)}
   ${isEmpty()?ab(300,260,440,0,`<div style="font:italic 500 20px/1.5 var(--serif);color:#15130f;text-align:center">${esc(emptyText())}</div>`):''}
   <div style="position:absolute;left:24px;top:98px;width:230px">${penRack(6)}</div>
  </div>`}});

/* ---------------- 2B Contact sheet ---------------- */
B({id:'2b',code:'2B',title:'Contact sheet',dial:2,lead:'hip',h:640,
 idea:'The day is a roll of film. One frame per hour, twenty-four frames, each hand-tinted from its minutes. Pick a pen and every frame that holds it gets a red grease-pencil ring, the way a photographer marks a contact sheet. Week view is seven rolls.',
 data:'Every minute, placed inside its hour frame. The grease-pencil rings are the Find results for the selected pen. Frame numbers are the hour of the day.',
 kept:['Pen color remains the only chroma'],
 broke:['Orange edge print (house bans orange light)','Near-black ground instead of cool paper','Rotated, hand-drawn rings','A serif face for the sheet title'],
 src:'Hipgnosis worked from retouched prints: film edge print, sprocket holes, grease pencil. Richard Manning hand-tinted with dyes (Ultimate Classic Rock). Muybridge grids as small multiples of time.',
 render(){
  const wk=S.span==='week',sel=selPen(),P=pal();
  const rolls=wk?DAYS.map((d,i)=>({d:i,title:`${d[0]} ${d[1].slice(4)}`,hrs:Array.from({length:24},(_,k)=>k)})):[0,1,2].map(r=>({d:S.day,title:r?'':dayLab(S.day),hrs:Array.from({length:8},(_,k)=>r*8+k)}));
  const fw=wk?41:122,fh=wk?44:112,gapf=wk?1:4,rollH=fh+(wk?30:42);
  let svg='',y=0;
  rolls.forEach((rl,ri)=>{
    const W=rl.hrs.length*(fw+gapf)+gapf;
    svg+=`<g transform="translate(0,${y})"><text x="0" y="9" font-size="9.5" fill="#d68a46" letter-spacing="2" font-family="IBM Plex Mono">${esc(rl.title).toUpperCase()} · ${fmtDur(totals([rl.d]).sum)} · B2 400TX</text><rect y="14" width="${W}" height="${rollH-14}" fill="#16120d"/>`;
    for(let k=0;k<Math.floor(W/(wk?9:16));k++){const hx=k*(wk?9:16)+3;svg+=`<rect x="${hx}" y="17" width="${wk?4:7}" height="${wk?3:5}" rx="1" fill="#0e0d0c"/><rect x="${hx}" y="${rollH-(wk?6:10)}" width="${wk?4:7}" height="${wk?3:5}" rx="1" fill="#0e0d0c"/>`}
    rl.hrs.forEach((hr,ci)=>{
      const x=gapf+ci*(fw+gapf),fy=wk?23:26;const a=hr*60,b=a+60;
      svg+=`<g transform="translate(${x},${fy})"><rect width="${fw}" height="${fh}" fill="#241d15"/>`;
      let has=false;
      runs(S.view,rl.d,S.cell).forEach(ru=>{const s2=Math.max(ru.s,a),e2=Math.min(ru.e,b);if(e2<=s2)return;const pen=P[ru.k];if(ru.k===sel)has=true;
        svg+=`<rect x="${(s2-a)/60*fw}" y="0" width="${Math.max((e2-s2)/60*fw,.8)}" height="${fh}" fill="${mix(pen[1],'#d9a9a6',.18)}" opacity=".92" data-tip="${esc(pen[0])} · ${fmtT(ru.s)}–${fmtT(ru.e)} · ${fmtDur(ru.e-ru.s)}"/>`});
      if(isToday(rl.d)&&NOW.min>=a&&NOW.min<b)svg+=`<rect x="${(NOW.min-a)/60*fw}" y="0" width="2" height="${fh}" fill="#ece6da"/>`;
      svg+=`<rect width="${fw}" height="${fh}" fill="none" stroke="#000" stroke-opacity=".5"/>`;
      if(has)svg+=`<ellipse cx="${fw/2}" cy="${fh/2}" rx="${fw/2+4}" ry="${fh/2+4}" fill="none" stroke="#e04a3a" stroke-width="2.2" transform="rotate(-4 ${fw/2} ${fh/2})" stroke-dasharray="${fw*3.2} 6" stroke-linecap="round"/>`;
      svg+=`<text x="2" y="${fh+(wk?10:14)}" font-size="${wk?8:10}" fill="#d68a46" font-family="IBM Plex Mono">${wk?hr:hr+' ▸ '+hr+'A'}</text></g>`});
    svg+='</g>';y+=rollH+(wk?4:10);
  });
  return `<div class="b f-film" style="height:640px;background:radial-gradient(ellipse at 50% 30%,#1b1712,#080807 80%)">
   ${ab(16,10,1010,0,`<div class="row" style="gap:2px 8px">${viewKeys(true)}</div>`)}
   ${ab(16,44,1010,0,`<div class="row" style="gap:6px 20px;align-items:center;color:#d68a46">${navBar()}</div>`)}
   ${ab(16,wk?86:92,1008,0,`<svg width="1008" height="${y}" viewBox="0 0 1008 ${y}" style="display:block">${svg}</svg>`)}
   ${wk?'':ab(16,592,1008,0,`<div class="row" style="gap:6px 24px;align-items:flex-start"><div class="row" style="gap:12px">${pods()}</div><div class="col"><span class="lab">Find pen · ring frames</span><div class="row" style="max-width:420px">${totals().list.slice(0,5).map(p=>`<button class="pn${p.k===sel?' on':''}" data-pen="${p.k}" style="width:auto"><i style="background:${p.c}"></i><span>${esc(p.n)}</span></button>`).join('')}</div></div><div class="col"><span class="lab">Cell · Span</span><div class="row">${cellKeys()}${spanKeys()}</div></div></div>`)}
   ${wk?ab(16,630,0,0,''):''}
   ${isEmpty()?ab(120,250,800,0,`<div style="font:italic 500 20px/1.5 var(--serif);color:#a39c90">${esc(emptyText())}</div>`):''}
  </div>`}});

/* ---------------- 2C Pods ---------------- */
B({id:'2c',code:'2C',title:'Tank week',dial:2,lead:'blend',h:640,
 idea:'Each day is a translucent capsule filled to the share of the day that was tracked, the way a phone box fills with water. Layers are pens, widest at the bottom. In day view the hours bubble up the side in time order, so the fill level and the clock both stay readable.',
 data:'Fill height is tracked ÷ 1440 for each day. Layer height is each pen’s minutes. Hour bubbles are the dominant pen of each hour. Empty hours are open rings.',
 kept:['Pen color on every layer','Same keys and states, as gel buttons'],
 broke:['Pearl, ice-blue and glossy highlights (house is matte cool paper)','Rounded capsules, no zebra rows or hour grid','A face font for the buttons that is not mono'],
 src:'Strawbs, Deadlines (1977): a man in a phone box filled with water, fill level as time passing. Y2K and Frutiger Aero translucent shells (iMac G3, Sotagi pod, aibo).',
 render(){
  const wk=S.span==='week',CH=wk?400:440;
  const capsule=(d,cx,cy,w,hh)=>{
    const t=totals([d]),fill=t.sum/1440*hh,r=w/2,P=pal();let yy=cy+hh,layers='';
    t.list.filter(p=>p.m).forEach(p=>{const lh=p.m/1440*hh;yy-=lh;layers+=`<rect x="${cx}" y="${yy}" width="${w}" height="${lh}" fill="${mix(p.c,'#ffffff',.18)}" data-tip="${esc(p.n)} · ${fmtDur(p.m)}"/>`});
    const id='cp'+d+(wk?'w':'d');
    return `<defs><clipPath id="${id}"><rect x="${cx}" y="${cy}" width="${w}" height="${hh}" rx="${r}"/></clipPath><linearGradient id="gl${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient></defs>
     <rect x="${cx}" y="${cy}" width="${w}" height="${hh}" rx="${r}" fill="#ffffff55" stroke="#ffffff" stroke-width="2"/><g clip-path="url(#${id})">${layers}<rect x="${cx}" y="${cy+hh-fill-3}" width="${w}" height="6" fill="#fff" opacity=".55"/></g>
     <rect x="${cx+4}" y="${cy+4}" width="${w-8}" height="${hh-8}" rx="${r-4}" fill="url(#gl${id})"/>`};
  let body='';
  if(wk)body=DAYS.map((d,i)=>{const cx=24+i*118;const t=totals([i]).sum;return `<button data-set="day:${i}" style="position:absolute;left:${cx}px;top:70px;width:104px;height:${CH+60}px;background:none;border:0;cursor:pointer;color:#073047;text-align:center"><svg width="104" height="${CH}" viewBox="0 0 104 ${CH}" style="display:block">${capsule(i,0,0,104,CH)}</svg><div style="font:600 12px var(--sans);margin-top:8px">${d[0]} ${d[1].slice(4)}${isToday(i)?' · today':''}</div><div style="font:500 11px var(--mono)">${t?fmtDur(t):'—'} · ${Math.round(t/14.4)}%</div></button>`}).join('');
  else{
    const hrs=Array.from({length:24},(_,hr)=>{const c=cellsArr(S.view,S.day,S.cell);let best=null,bc=0;const cnt={};for(let m=hr*60;m<hr*60+60;m++){}const rs=rawRuns(S.view,S.day).filter(r=>r.e>hr*60&&r.s<hr*60+60);rs.forEach(r=>{const o=Math.min(r.e,hr*60+60)-Math.max(r.s,hr*60);cnt[r.k]=(cnt[r.k]||0)+o;if(cnt[r.k]>bc){bc=cnt[r.k];best=r.k}});return {hr,k:best,m:bc}});
    body=`<svg width="300" height="${CH+20}" viewBox="0 0 300 ${CH+20}" style="position:absolute;left:60px;top:70px">${capsule(S.day,40,10,220,CH)}</svg>`+
      hrs.map(o=>{const col=o.hr<12?0:1,row=o.hr%12;const x=470+col*120,y=76+row*36;const pen=o.k&&pal()[o.k];return `<div style="position:absolute;left:${x}px;top:${y}px;display:flex;align-items:center;gap:8px;font:500 11px var(--mono);color:#073047"><span class="bob" style="width:24px;height:24px;border-radius:50%;background:${pen?`radial-gradient(circle at 35% 30%,#fff,${mix(pen[1],'#ffffff',.2)} 55%,${pen[1]})`:'none'};border:${pen?'1px solid #ffffffaa':'1.5px solid #0c3a4e66'};box-shadow:${pen?'0 2px 6px #0a4a6a40':'none'}" ${pen?`data-tip="${esc(pen[0])} · ${o.m} min in this hour"`:''}></span>${fmtH(o.hr)}</div>`}).join('')+
      `<div style="position:absolute;left:740px;top:76px;width:270px;font:500 11px var(--mono);color:#073047"><div class="lab" style="margin-bottom:6px">Layers</div>${penRack(8)}</div>`;
  }
  return `<div class="b f-y2k" style="height:640px;background:radial-gradient(circle at 15% 10%,#ffffffaa,#0000 40%),radial-gradient(circle at 85% 90%,#c7b9ff66,#0000 40%),linear-gradient(#7cc9e3,#d4eef7 55%,#bfe3ee)">
   ${[[90,40,60],[860,60,34],[400,570,48],[980,540,70],[300,40,22]].map(([x,y,r])=>`<span class="bob" style="position:absolute;left:${x}px;top:${y}px;width:${r}px;height:${r}px;border-radius:50%;background:radial-gradient(circle at 30% 28%,#fff,#ffffff22 45%,#ffffff55);border:1px solid #fff8"></span>`).join('')}
   ${ab(24,14,1000,0,`<div class="row">${viewKeys(true)}</div>`)}
   ${ab(24,52,1000,0,`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">${navBar()}<div class="row">${spanKeys()}</div></div>`)}
   ${body}
   ${ab(24,wk?570:560,1000,0,`<div class="row" style="gap:10px 20px;align-items:center"><div class="row" style="gap:10px">${pods()}</div><div class="row">${cellKeys()}</div><div class="row">${toolKeys(false)}</div><div class="row">${flagKeys()}</div></div>`)}
   ${isEmpty()?ab(400,260,420,0,`<div style="font:600 15px/1.5 var(--sans);color:#073047;background:#ffffffb0;padding:14px 18px;border-radius:16px">${esc(emptyText())}</div>`):''}
  </div>`}});

/* ---------------- 2D Departures ---------------- */
const flaps=(str,n,delay=0)=>{str=String(str).toUpperCase().padEnd(n,' ').slice(0,n);return `<span style="display:inline-flex;gap:2px">${[...str].map((c,i)=>`<span class="fl flip" style="animation-delay:${delay+i*14}ms">${c===' '?'&nbsp;':esc(c)}</span>`).join('')}</span>`};
B({id:'2d',code:'2D',title:'Departures board',dial:2,lead:'retro',h:640,
 idea:'The day log as a station departures board. Every block is a row of split-flap tiles: when it began, what it was, how long, and whether it is done, running or still assumed. Each redraw flips the tiles. Week view turns the rows into days, each with a one-line strip of its minutes.',
 data:'Day: one row per block at the current cell size. Week: one row per day with tracked time, top pen, share of day, and the day as a strip.',
 kept:['Pen color chip on every row','Every key retained, as embossed label tape'],
 broke:['Near-black ground with a hot red state key (house: warm red for overrun only)','Letter tiles, uppercase only','Rows replace the grid, so no hour scale'],
 src:'Solari split-flap boards, 1950s on, which airports and rail stations used until digital screens replaced them. The noise was part of the appeal (Billy Penn on the Amtrak board; Wikipedia).',
 render(){
  const wk=S.span==='week',P=pal();let rows='';
  if(!wk){
    const rs=runs(S.view,S.day,S.cell);
    rows=rs.map((r,i)=>{const pen=P[r.k],status=isToday(S.day)&&NOW.min>=r.s&&NOW.min<r.e?'NOW':'DONE';
      return `<div class="dr" data-tip="${esc(pen[0])} · ${fmtT(r.s)}–${fmtT(r.e)}"><i style="background:${pen[1]}"></i>${flaps(fmtT(r.s).replace(' ',''),7,i*60)}${flaps(pen[0],15,i*60+80)}${flaps(fmtDur(r.e-r.s).replace(' ',''),6,i*60+160)}${flaps(status,5,i*60+220)}</div>`}).join('')||`<div class="dr">${flaps('NO DEPARTURES TODAY',22)}</div>`;
  }else rows=DAYS.map((d,i)=>{const t=totals([i]),top=t.list[0]&&t.list[0].m?t.list[0]:null;
    const strip=`<svg width="250" height="18" style="display:block;background:#1a1b1d">${runs(S.view,i,S.cell).map(r=>`<rect x="${r.s/1440*250}" width="${Math.max((r.e-r.s)/1440*250,1)}" height="18" fill="${P[r.k][1]}"/>`).join('')}${isToday(i)?`<rect x="${NOW.min/1440*250}" width="2" height="18" fill="#ff5a4a"/>`:''}</svg>`;
    return `<button class="dr" data-set="day:${i}" style="border:0;background:none;color:inherit;cursor:pointer;text-align:left">${flaps(d[0]+' '+d[1].slice(4),7,i*60)}${flaps(t.sum?fmtDur(t.sum).replace(' ',''):'-',6,i*60+60)}${flaps(top?top.n:'NO DATA',13,i*60+120)}${flaps(Math.round(t.sum/14.4)+'%',4,i*60+180)}${strip}</button>`}).join('');
  const head=wk?['DAY','TRACKED','TOP PEN','OF DAY','THE DAY']:['TIME','PEN','LENGTH','STATUS'];
  return `<div class="b f-dymo" style="height:640px;background:#0e0f11;color:#efe9dc">
   <style>.fl{display:inline-flex;width:16px;height:26px;align-items:center;justify-content:center;background:linear-gradient(#26272a 0 49%,#0c0c0d 49% 51%,#1d1e21 51%);border-radius:3px;font:700 16px var(--mono);color:#efe9dc;transform-origin:50% 50%}
   .dr{display:flex;gap:14px;align-items:center;min-height:32px;width:100%;font:inherit}.dr i{width:14px;height:14px;border-radius:2px;flex:none;box-shadow:0 0 0 1px #0008}</style>
   ${ab(24,14,1000,0,`<div class="row">${viewKeys(true)}</div>`)}
   ${ab(24,56,1000,0,`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div style="font:700 28px/1 var(--sans);font-stretch:112%;letter-spacing:.06em">${wk?'WEEK LOG':'DAY LOG'} <span style="font:500 13px var(--mono);letter-spacing:.2em;opacity:.7;margin-left:10px">${esc(spanLab()).toUpperCase()}</span></div>${navBar()}</div>`)}
   ${ab(24,112,700,0,`<div class="lab" style="display:flex;gap:${wk?60:80}px;padding-left:28px;margin-bottom:6px">${head.map(h=>`<span>${h}</span>`).join('')}</div><div style="display:flex;flex-direction:column;gap:5px;max-height:420px;overflow:hidden">${rows}</div>`)}
   ${ab(780,112,244,0,`<div class="col" style="gap:12px"><div class="row" style="gap:12px">${pods()}</div><span class="lab">Span</span><div class="row">${spanKeys()}</div><span class="lab">Cell</span><div class="row">${cellKeys()}</div><span class="lab">Tools</span><div class="row">${toolKeys(false)}</div><span class="lab">Flags</span><div class="row">${flagKeys()}</div><span class="lab">Pens</span>${penRack(5)}</div>`)}
  </div>`}});
</script>
