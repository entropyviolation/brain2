<script>
/* ---------------- 1A Storyboard week ---------------- */
B({id:'1a',code:'1A',title:'Storyboard week',dial:1,lead:'hip',h:640,
 idea:'The week as seven monochrome frames, like the printed storyboard inside The Lamb Lies Down on Broadway. Each frame is one whole day shrunk to a still. Today steps forward, lit, and the others sit back. A click on a frame opens that day.',
 data:'Every minute of all seven days. Frame caption is the day total. The selected day is shown larger below with the real controls.',
 kept:['Cool paper, graph rule','No new color: frames lose their hue, the lit one keeps it','Doors visible: every frame is a button'],broke:[],
 src:'Genesis, The Lamb Lies Down on Broadway (1974): a black and white storyboard of Rael. Hipgnosis cut and retouched the prints (Richard Manning). Eadweard Muybridge made time into a grid of small multiples; Etienne-Jules Marey merged it on one plate.',
 render(){
  const fr=DAYS.map((d,i)=>{
    const lit=i===S.day,tod=isToday(i),t=totals([i]).sum;
    const g=grid({days:[i],w:132,h:300,lw:0,hh:0,bg:'#e9edf0',line:'#9aa7b333',now:false,color:c=>lit?c:gray(c,'#6b7785',.18),zebra:false,
      nowFn:()=>'' });
    const nowl=tod?`<div style="position:absolute;left:0;right:0;top:${NOW.min/1440*300}px;height:2px;background:#d6402f"></div>`:'';
    return `<button data-set="day:${i}" aria-pressed="${lit}" style="appearance:none;border:0;background:none;padding:0;cursor:pointer;color:inherit;text-align:left;transform:${lit?'translateY(-12px)':'none'};transition:transform .5s cubic-bezier(.2,.7,.1,1);opacity:${lit?1:.78}">
     <div style="width:136px;padding:2px;background:#10151a;box-shadow:${lit?'0 14px 22px #0006':'0 2px 4px #0003'}"><div style="position:relative;width:132px;height:300px;overflow:hidden">${g}${nowl}${t===0&&!tod?'<div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,#0000 0 6px,#0000000d 6px 7px)"></div>':''}</div></div>
     <div style="font:500 10px var(--mono);letter-spacing:.14em;margin-top:6px;color:#17202a;text-transform:uppercase">${d[0]} ${d[1].slice(4)}${tod?' · today':''}</div><div style="font:600 12px var(--mono);color:#17202a">${t?fmtDur(t):'—'}</div></button>`}).join('');
  const g2=grid({w:560,h:200,v:false,lw:0,hh:16,days:[S.day],bg:'#f4f7f9',line:'#9fb0bf88',lab:'#4a5a6a',col:'#fbfdfe',hstep:2});
  return `<div class="b f-house" style="height:640px;${graphBg('#e4eaef','#c3cdd788')}">
   ${ab(16,10,1008,0,`<div class="row">${viewKeys(true)}</div>`)}
   ${ab(32,56,980,370,`<div style="display:flex;gap:14px;justify-content:space-between">${fr}</div>`)}
   ${ab(32,440,0,0,`<div class="lab">Week summary · Oct 19 – Oct 25</div>`)}
   ${ab(32,460,380,160,`<div class="row" style="gap:10px">${pods()}</div><div class="lab" style="margin:14px 0 6px">Tools</div><div class="row">${toolKeys()}</div><div class="lab" style="margin:12px 0 6px">Span · Cell</div><div class="row">${spanKeys()}</div><div class="row" style="margin-top:6px">${cellKeys()}</div>`)}
   ${ab(430,440,582,184,`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">${navBar()}</div><div style="border:2px solid #1b2128;width:fit-content">${g2}</div>`)}
  </div>`}});

/* ---------------- 1B Helicorder ---------------- */
B({id:'1b',code:'1B',title:'Helicorder day',dial:1,lead:'retro',h:640,
 idea:'The day as a chart-recorder sheet, the way a seismograph prints twenty-four hours on one page. One line per hour. The line stays flat until a pen is down, then it steps up and takes the pen color. Week view turns each line into one whole day.',
 data:'Every tracked block as a raised pulse on its hour. Chart speed is the Day or Week key, cell size sets how finely the pulse edges snap.',
 kept:['Cool graph paper and silver chrome','Pen color is the only chroma on the sheet','Same keys, same state'],broke:[],
 src:'Seismic drum recorders and helicorders (USGS: a drum recorder prints the day as a stack of lines; modern displays use 15 or 60 minutes per line). Cassette futurism strip-chart look.',
 render(){
  const wk=S.span==='week',P=pal(),rows=wk?DAYS.map((d,i)=>({lab:d[0]+' '+d[1].slice(4),d:i,a:0,b:1440})):Array.from({length:24},(_,i)=>({lab:fmtH(i),d:S.day,a:i*60,b:i*60+60}));
  const W=730,Hh=520,lw=50,hh=26,rh=(Hh-hh)/rows.length,amp=Math.min(rh*.8,22);
  let s=`<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="display:block;font-family:IBM Plex Mono"><rect width="${W}" height="${Hh}" fill="#eef4f7"/>`;
  const px=t=>lw+t*(W-lw-8);
  for(let i=0;i<=(wk?24:60);i+=(wk?1:5)){const t=i/(wk?24:60);s+=`<line x1="${px(t)}" x2="${px(t)}" y1="${hh}" y2="${Hh}" stroke="${i%(wk?6:15)===0?'#7fa0b5':'#b9cfdb'}" stroke-width="${i%(wk?6:15)===0?1:.6}"/>`;if(i%(wk?3:10)===0)s+=`<text x="${px(t)+2}" y="16" font-size="10" fill="#3f566a">${wk?fmtH(i%24):':'+String(i).padStart(2,'0')}</text>`}
  rows.forEach((r,j)=>{
    const y=hh+j*rh+rh*.78;s+=`<text x="${lw-8}" y="${y}" font-size="10" text-anchor="end" fill="#3f566a">${r.lab}</text><line x1="${lw}" x2="${W-8}" y1="${y}" y2="${y}" stroke="#3f566a55"/>`;
    runs(S.view,r.d,S.cell).forEach(ru=>{const a=Math.max(ru.s,r.a),b=Math.min(ru.e,r.b);if(b<=a)return;const pen=P[ru.k];
      const x1=px((a-r.a)/(r.b-r.a)),x2=px((b-r.a)/(r.b-r.a));
      s+=`<path d="M${x1} ${y}V${y-amp}H${x2}V${y}" fill="${pen[1]}22" stroke="${pen[1]}" stroke-width="2" data-tip="${esc(pen[0])} · ${fmtT(ru.s)}–${fmtT(ru.e)} · ${fmtDur(ru.e-ru.s)}"/>`});
    if(isToday(r.d)&&(wk||Math.floor(NOW.min/60)===j))s+=`<line x1="${px((NOW.min-r.a)/(r.b-r.a))}" x2="${px((NOW.min-r.a)/(r.b-r.a))}" y1="${y-amp-2}" y2="${y+4}" stroke="#d6402f" stroke-width="2"/>`;
  });
  s+='</svg>';
  return `<div class="b f-house" style="height:640px;background:#b4bfc8">
   ${ab(16,12,1008,0,`<div class="row">${viewKeys(true)}</div>`)}
   ${ab(16,52,0,0,navBar())}
   ${ab(16,96,742,528,`<div style="border:3px solid #232a31;border-radius:4px;box-shadow:inset 0 0 0 2px #fff6">${s}</div>`)}
   ${isEmpty()?ab(90,200,600,0,`<div style="font:500 14px/1.7 var(--mono);background:#eef4f7ee;padding:14px;border:1px solid #7fa0b5;color:#17202a">${esc(emptyText())}</div>`):''}
   ${ab(774,96,250,0,`<div class="col" style="gap:10px"><div class="lab">Chart speed</div><div class="row">${spanKeys()}</div><div class="lab">Cell</div><div class="row">${cellKeys()}</div><div class="row" style="gap:8px;margin:6px 0">${pods()}</div><div class="lab">Pens</div><div style="background:#eef4f7;border:1px solid #7a8794">${penRack(6)}</div><div class="lab">Tools</div><div class="row">${toolKeys(false)}</div><div class="lab">Flags</div><div class="row">${flagKeys()}</div></div>`)}
  </div>`}});

/* ---------------- 1C Light-trail week ---------------- */
B({id:'1c',code:'1C',title:'Long exposure',dial:1,lead:'hip',h:640,
 idea:'Each day is one long-exposure photograph. A block is a trail that starts faint and brightens toward its end, so the direction of time reads without a label. Idle hours stay black. Brightness is real minutes, not decoration.',
 data:'Every tracked block as a trail, brightness weighted by block length. The now point is a small bulb at the head of today.',
 kept:['Pen color remains the only chroma','Hour hairlines stay','All keys remain, in film print type'],broke:[],
 src:'Genesis, ...And Then There Were Three... (1978): Storm said the story was told by the traces left by light trails. Marey chronophotography: many exposures merged on one plate.',
 render(){
  const wk=S.span==='week';
  const g=grid({w:wk?820:520,h:540,bg:'#090909',line:'#ffffff14',lab:'#8a8074',col:'#0d0d0d',font:"'IBM Plex Mono'",
   defs:'<defs><filter id="gl" x="-50%" y="-5%" width="200%" height="110%"><feGaussianBlur stdDeviation="3"/></filter></defs>',
   run:(r,{pen,run,k})=>{const id='g'+k+run.s+Math.round(r.x);const dur=run.e-run.s,b=Math.min(1,.45+dur/240);const c=mix(pen[1],'#ffffff',.25);
     return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity="${b}"/></linearGradient></defs><rect x="${r.x+r.w/2-Math.min(r.w*.32,45)}" y="${r.y}" width="${Math.min(r.w*.64,90)}" height="${Math.max(r.h,1.5)}" fill="url(#${id})" filter="url(#gl)" opacity=".9"/><rect x="${r.x+r.w*.4}" y="${r.y}" width="${r.w*.2}" height="${Math.max(r.h,1.5)}" fill="url(#${id})" data-tip="${esc(pen[0])} · ${fmtT(run.s)}–${fmtT(run.e)} · ${fmtDur(dur)}"/>`},
   nowFn:(c,r)=>`<circle cx="${c.x+c.w/2}" cy="${r.y}" r="9" fill="#ece6da" filter="url(#gl)"/><circle cx="${c.x+c.w/2}" cy="${r.y}" r="2.5" fill="#fff"/>`});
  return `<div class="b f-film" style="height:640px;background:radial-gradient(ellipse at 50% 40%,#17140f,#050505 75%)">
   <div style="position:absolute;inset:0;opacity:.2;mix-blend-mode:overlay;background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E&quot;)"></div>
   ${ab(24,16,990,0,`<div class="row" style="gap:2px 10px">${viewKeys(true)}</div>`)}
   ${ab(24,64,0,0,`<div style="color:#d68a46">${navBar()}</div>`)}
   ${ab(24,108,wk?820:520,540,g)}
   ${isEmpty()?ab(60,300,440,0,`<div style="font:italic 500 18px/1.5 var(--serif);color:#a39c90">${esc(emptyText())}</div>`):''}
   ${ab(wk?868:580,108,wk?156:440,0,`<div class="col" style="gap:12px"><div class="row" style="gap:12px">${pods()}</div><span class="lab">Span</span><div class="row">${spanKeys()}</div><span class="lab">Cell</span><div class="row">${cellKeys()}</div><span class="lab">Tools</span><div class="row">${toolKeys(false)}</div><span class="lab">Pens</span><div>${penRack(wk?5:8)}</div><span class="lab">Flags</span><div class="row">${flagKeys()}</div></div>`)}
  </div>`}});
</script>
