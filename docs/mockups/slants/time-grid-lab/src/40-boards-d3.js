<script>
/* ---------------- 3A LCARS ---------------- */
B({id:'3a',code:'3A',title:'Elbow frame',dial:3,lead:'retro',h:640,
 idea:'The whole tab as one rounded frame where the bars are the controls. View keys run down the left spine. Paint tools and cell size run down the right. The plot sits in the black well between them. Layout and every action stay as they are in the app.',
 data:'All of it. This is a re-skin: same keys, same grid, same readouts, same pen rack.',
 kept:['Keys stay visible, no hidden menus','Pen color is the only chroma inside the plot','Two type sizes inside the well'],
 broke:['Black ground, not cool paper','Peach, lavender and periwinkle bars (one family, three tints, not the house color)','Rounded pill keys','Condensed caps face'],
 src:'LCARS, the Star Trek: The Next Generation interface (Michael Okuda, from 1987): a frame of rounded colored bars that is also the navigation.',
 render(){
  const g=grid({w:660,h:452,bg:'#000',col:'#040404',line:'#ff996644',lab:'#ff9966',font:"'Antonio',sans-serif",fs:12,color:c=>mix(c,'#ffffff',.3)});
  return `<div class="b f-lcars" style="height:640px;background:#000;font-family:'Antonio',sans-serif;color:#ffd8b0">
  <style>.b3a .k{padding:4px 14px!important;font-size:12px!important}.b3a .col .k,.b3a .col2 .k{width:100%}.b3a .col2.col{gap:3px!important}.b3a .pn{font:400 13px 'Antonio';letter-spacing:.06em;text-transform:uppercase}</style>
  <div class="b3a">
   <div style="position:absolute;left:16px;top:16px;width:156px;height:70px;background:#ff9966;border-radius:44px 0 0 0"></div>
   <div style="position:absolute;left:60px;top:42px;width:112px;height:44px;background:#000;border-radius:26px 0 0 0"></div>
   <div style="position:absolute;left:178px;top:16px;width:846px;height:26px;background:#cc99cc;border-radius:0 13px 13px 0;color:#000;font:700 16px/26px Antonio;letter-spacing:.2em;text-transform:uppercase;padding-left:14px">Tracking · Time Grid · ${esc(spanLab())}</div>
   <div style="position:absolute;left:16px;top:92px;width:24px;bottom:16px;background:#ff9966;border-radius:0 0 0 24px"></div>
   ${ab(48,96,124,0,`<div class="col" style="gap:5px">${viewKeys(true)}</div>`)}
   ${ab(184,50,650,0,`<div style="color:#ffd8b0">${navBar()}</div>`)}
   ${ab(178,96,672,460,`<div style="border:3px solid #cc99cc;border-radius:0 0 0 0;width:fit-content">${g}</div>`)}
   ${isEmpty()?ab(210,200,600,0,`<div style="font:700 20px/1.4 Antonio;letter-spacing:.08em;text-transform:uppercase;color:#ff9966;background:#000d;padding:12px">${esc(emptyText())}</div>`):''}
   ${ab(862,50,162,0,`<div class="col2 col" style="gap:5px"><span class="lab">Span</span>${spanKeys()}<span class="lab" style="margin-top:6px">Cell</span>${cellKeys()}<span class="lab" style="margin-top:6px">Tools</span>${toolKeys()}<span class="lab" style="margin-top:6px">Flags</span>${flagKeys()}</div>`)}
   ${ab(184,570,840,0,`<div style="display:flex;gap:24px;align-items:flex-start"><div class="row" style="gap:18px;flex:none">${pods()}</div><div style="flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:0 10px">${penRack(8)}</div></div>`)}
  </div></div>`}});

/* ---------------- 3B Nostromo ---------------- */
const GL=['█','▓','▒','░','#','%','@','&','=','+'];
B({id:'3b',code:'3B',title:'Green screen',dial:3,lead:'retro',h:640,
 idea:'The tab as a ship terminal. Everything is text. Each pen gets its own glyph, so the grid reads in one color: block, shade, hash, percent. Keys are bracketed words. The Now strip becomes the prompt line, with a cursor.',
 data:'Every block as glyphs on the hour rows, five-minute cells as single characters. The legend maps glyph to pen and minutes. The prompt shows the active pen and its start key.',
 kept:['One color family (phosphor green)','Everything stays a real, focusable key','No hover-only controls'],
 broke:['Black ground, bright green on black','Glyphs replace pen color, so pens are told apart by shape','Bitmap face at one size'],
 src:'Nostromo and MU/TH/UR 6000 in Alien (1979), Ron Cobb’s rule that every surface has a plausible engineering label. Cassette futurism.',
 render(){
  const days=spanDays(),P=pal(),keys=Object.keys(P),gl={};keys.forEach((k,i)=>gl[k]=GL[i%GL.length]);
  const per=Math.max(1,60/S.cell);let lines='';
  for(let hr=0;hr<24;hr++){
    let ln=`<span style="opacity:.6">${String(hr).padStart(2,'0')}:00 </span>`;
    days.forEach((d,di)=>{const c=cellsArr(S.view,d,S.cell);let t='';for(let j=0;j<per;j++){const k=c[hr*per+j];t+=k?`<span style="color:#7dff9a" data-tip="${esc(P[k][0])}">${gl[k]}</span>`:'<span style="opacity:.3">·</span>'}ln+=t+'  '});
    if(days.some(d=>isToday(d))&&Math.floor(NOW.min/60)===hr)ln+=` <span style="background:#7dff9a;color:#020805"> NOW </span>`;
    lines+=ln+'\n';
  }
  const hdr=days.length>1?`<span style="opacity:.6">      </span>`+days.map(d=>DAYS[d][0].padEnd(per+2,' ')).join(''):'';
  const r=read();
  return `<div class="b f-term" style="height:640px;background:radial-gradient(ellipse at 50% 40%,#06140b,#020805 80%);font-family:'VT323',monospace;font-size:18px;line-height:20px;color:#7dff9a;text-shadow:0 0 6px #4dff7a66">
   <div style="position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(#0000 0 2px,#0000002e 2px 3px);z-index:3"></div>
   ${ab(24,14,990,0,`<div>MU/TH/UR 6000 · INTERFACE 2037 · TRACKING / TIME GRID</div><div style="opacity:.6">${'─'.repeat(72)}</div><div class="row" style="gap:0 12px;margin-top:4px"><span>VIEW</span>${viewKeys(true)}</div><div class="row" style="gap:0 12px"><span>SPAN</span>${spanKeys()}<span style="margin-left:14px">CELL</span>${cellKeys()}</div><div class="row" style="gap:0 12px">${navBar()}</div>`)}
   ${ab(24,150,640,0,`<pre style="margin:0;font:inherit;white-space:pre">${hdr}\n${lines}</pre>`)}
   ${isEmpty()?ab(110,300,520,0,`<div style="background:#020805;border:1px solid #7dff9a;padding:10px;font-size:20px;line-height:22px">${esc(emptyText().toUpperCase())}</div>`):''}
   ${ab(700,150,320,0,`<div>TRACKED  <span style="font-size:28px">${fmtDur(r.tracked).toUpperCase()}</span></div><div>OF ${S.span.toUpperCase()}  <span style="font-size:28px">${Math.round(r.pct)}%</span></div><div style="opacity:.6;margin:6px 0">${'─'.repeat(28)}</div><div>LEGEND</div>${totals().list.map(p=>`<button class="pn${p.k===selPen()?' on':''}" data-pen="${p.k}" style="width:100%"><span>${gl[p.k]}  ${esc(p.n).toUpperCase()}</span><em>${p.m?fmtDur(p.m).toUpperCase():'—'}</em></button>`).join('')}<div style="opacity:.6;margin:6px 0">${'─'.repeat(28)}</div><div>TOOLS</div><div class="row" style="gap:0 8px">${TOOLS.map(t=>kb(t[1],S.tool===t[0],`data-tool="${t[0]}"`)).join('')}</div><div>FLAGS</div><div class="row" style="gap:0 8px">${flagKeys()}</div><div>DISPLAY</div><div class="row">${glassKeys()}</div>`)}
   ${ab(24,606,990,0,`<div>&gt; NOW: clean house   [ START ]<span style="animation:none">_</span></div>`)}
  </div>`}});

/* ---------------- 3C Black film page ---------------- */
B({id:'3c',code:'3C',title:'Prism and print',dial:3,lead:'hip',h:640,
 idea:'The tab as a black page with film grain. One white beam of time enters a prism and splits into Day, Week and Infinite, and each ray is a button. The plot is a print with hand-tinted pens and a red grease-pencil now line. The selected pen is a Polaroid.',
 data:'All the app’s controls: span rays, cell, tools, flags and view keys. The Polaroid is the selected pen’s name, minutes, and share.',
 kept:['One hot accent at a time: the grease-pencil red','Same keys and layout as the app'],
 broke:['Near-black ground','Full spectrum, on the prism only','Orange film edge print on every label','Serif italic for the Polaroid caption','Grain over the page'],
 src:'Pink Floyd, The Dark Side of the Moon (1973): the prism, drawn by George Hardie. Storm Thorgerson: “All I try to do is represent the music” (Creative Review). Peter Gabriel (1980) smeared SX-70 Polaroid for the print.',
 render(){
  const sel=selPen(),p=sel&&pal()[sel],tt=totals(),selm=(tt.list.find(x=>x.k===sel)||{m:0}).m,r=read();
  const rays=[['span:day','Day','#d0453a',48],['span:week','Week','#5fa36c',108],['data-info','Scroll ∞','#5a7fc4',168]];
  const on=i=>i===0?S.span==='day':i===1?S.span==='week':false;
  const prism=`<svg width="360" height="210" viewBox="0 0 360 210" style="position:absolute;left:0;top:0"><line x1="0" y1="112" x2="146" y2="112" stroke="#fff" stroke-width="3" filter="url(#bl)"/><line x1="0" y1="112" x2="146" y2="112" stroke="#fff" stroke-width="1.5"/><defs><filter id="bl"><feGaussianBlur stdDeviation="3"/></filter></defs>
   <polygon points="150,32 150,190 262,112" fill="#ffffff14" stroke="#ece6da" stroke-width="1.6"/>
   ${rays.map((q,i)=>`<polygon points="262,112 330,${q[3]-5} 330,${q[3]+5}" fill="${q[2]}" opacity="${on(i)?1:.55}"/>`).join('')}</svg>`;
  const rayBtns=rays.map((q,i)=>`<button class="k${on(i)?' on':''}" ${q[0]==='data-info'?'data-act="toast:Infinite scroll is one continuous strip in the app. It is not mocked in this lab."':`data-set="${q[0]}"`} style="position:absolute;left:300px;top:${q[3]-10}px;width:64px;font:500 10px var(--mono);letter-spacing:.12em;color:${on(i)?'#fff':q[2]}">${q[1]}</button>`).join('');
  const g=grid({w:590,h:500,bg:'#0d0c0b',col:'#12100e',line:'#ffffff14',lab:'#a39c90',color:c=>mix(c,'#8a6a4a',.28),zebra:'#ffffff05',
   nowFn:(c,rr)=>`<line x1="${c.x}" x2="${c.x+c.w}" y1="${rr.y}" y2="${rr.y}" stroke="#e04a3a" stroke-width="2" stroke-linecap="round"/>`});
  return `<div class="b f-film" style="height:640px;background:radial-gradient(ellipse at 40% 30%,#1a1612,#060606 78%)">
   <div style="position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay;pointer-events:none;background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E&quot;);z-index:5"></div>
   <div style="position:absolute;left:24px;top:16px;width:370px;height:210px">${prism}${rayBtns}</div>
   ${ab(24,236,370,0,`<div class="col" style="gap:10px"><span class="lab">Cell</span><div class="row">${cellKeys()}</div><span class="lab">Tools</span><div class="row">${toolKeys(false)}</div><span class="lab">Flags</span><div class="row">${flagKeys()}</div><span class="lab">Display</span><div class="row">${glassKeys()}</div></div>`)}
   ${ab(24,430,170,190,`<div style="background:#efe8d8;padding:10px 10px 0;transform:rotate(-2.5deg);box-shadow:0 10px 22px #000a;height:100%;color:#2a2018"><div style="height:110px;background:${p?`linear-gradient(135deg,${mix(p[1],'#d9a9a6',.2)},${mix(p[1],'#000000',.35)})`:'#555'};filter:sepia(.35) contrast(.95)"></div><div style="font:italic 600 20px/1.2 var(--serif);margin-top:8px">${p?esc(p[0]):'no pen'}.</div><div style="font:500 10px var(--mono);letter-spacing:.1em">${fmtDur(selm)} · ${r.tracked?Math.round(selm/r.tracked*100):0}%</div></div>`)}
   ${ab(220,440,180,0,`<div class="col" style="gap:10px"><div class="pod"><span>Tracked</span><b>${fmtDur(r.tracked)}</b><small style="color:#a39c90">T = Σ(eᵢ − sᵢ)</small></div><div class="pod"><span>Of ${S.span==='week'?'week':'day'}</span><b>${Math.round(r.pct)}%</b><small style="color:#a39c90">T ÷ ${1440*r.n}</small></div></div>`)}
   ${ab(420,16,604,0,`<div class="row" style="gap:2px 8px">${viewKeys(true)}</div>`)}
   ${ab(420,66,604,0,`<div style="color:#d68a46">${navBar()}</div>`)}
   ${ab(420,110,590,500,`<div style="box-shadow:0 0 0 1px #3b2a1e,0 14px 30px #000a">${g}</div>`)}
   ${isEmpty()?ab(450,250,520,0,`<div style="font:italic 500 20px/1.5 var(--serif);color:#a39c90">${esc(emptyText())}</div>`):''}
   ${ab(220,590,180,40,`<div style="font:500 9px var(--mono);letter-spacing:.2em;color:#d68a46">PLATE 3C · B2 400TX · ${S.cell}M<br>${esc(spanLab()).toUpperCase()}</div>`)}
  </div>`}});
</script>
