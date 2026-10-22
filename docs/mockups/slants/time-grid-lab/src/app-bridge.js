<script>
/* Live data for the app: the host page (Tracking → Time Grid → Day tubes) posts the real week and this fills the engine's tables. */
(function(){
  document.body.classList.add('app');
  const cv=document.createElement('canvas').getContext('2d');
  const hexOf=c=>{try{cv.fillStyle='#000';cv.fillStyle=c;const v=cv.fillStyle;if(v[0]==='#')return v;return toHex(v.match(/[\d.]+/g).slice(0,3).map(Number))}catch(e){return '#6b4a86'}};
  const addD=(ds,n)=>{const x=new Date(ds+'T00:00:00');x.setDate(x.getDate()+n);const p=v=>String(v).padStart(2,'0');return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate())};
  const go=date=>parent.postMessage({type:'day-tubes:goto',date},'*');
  let P=null,last='',lastDate='';
  function apply(p){
    const key=JSON.stringify(p);if(key===last)return;last=key;const first=!P;P=p;
    VIEWS.length=0;[PAL,DATA,VNAME].forEach(o=>Object.keys(o).forEach(k=>delete o[k]));
    p.views.forEach(v=>{VIEWS.push([v.id,v.name,v.name]);VNAME[v.id]=v.name;PAL[v.id]={};v.pens.forEach(q=>PAL[v.id][q.id]=[q.name,hexOf(q.color)]);DATA[v.id]=p.days.map(d=>v.runs[d.date]||[])});
    DAYS.length=0;p.days.forEach(d=>DAYS.push([d.wd,d.md]));
    NOW.day=p.todayIdx;NOW.min=p.nowMin;WK0.setTime(new Date(p.days[0].date+'T00:00:00').getTime());
    if(first||p.date!==lastDate){lastDate=p.date;S.day=p.selected}
    if(first){S.fid={};for(let i=0;i<7;i++)S.fid[i]='liquid'}
    if(!PAL[S.view]){S.view=VIEWS[0]?VIEWS[0][0]:S.view;S.pen=null}
    $('#viewchips').innerHTML=VIEWS.map(v=>`<button class="chip" data-set="view:${esc(v[0])}">${esc(v[1])}</button>`).join('');
    document.body.classList.toggle('none',!VIEWS.some(v=>totals(p.days.map((_,i)=>i),v[0]).sum>0));
    document.body.classList.add('live');
    renderAll();
  }
  addEventListener('message',e=>{const m=e.data;if(m&&m.type==='day-tubes:data')apply(m.payload)});
  const _act=act;
  act=function(a){const n=a.split(':')[0];
    if(P&&(n==='prev'||n==='next')){const s=n==='next'?1:-1;
      if(S.span==='week'){go(addD(P.days[0].date,7*s));return}
      const i=S.day+s;if(i<0||i>6){go(addD(P.days[S.day].date,s));return}}
    else if(P&&n==='today'&&NOW.day<0){go(P.today);return}
    _act(a)};
  parent.postMessage({type:'day-tubes:ready'},'*');
})();
</script>
