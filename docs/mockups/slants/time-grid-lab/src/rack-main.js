<script>
let undoList=null,toastT=null;
const RACK=board.find(b=>b.id==='1d');
function renderAll(){
  memo={};const el=$('#st-1d');el.style.height=RACK.h+'px';el.innerHTML=RACK.render();
  $$('.bench [data-set]').forEach(b=>{const[k,v]=b.dataset.set.split(':');b.classList.toggle('on',String(S[k])===v)});
  $('#cellchips').innerHTML=CELLS[S.span].map(n=>`<button class="chip${S.cell===n?' on':''}" data-set="cell:${n}">${n}m</button>`).join('');
  $('#daylab').textContent=S.span==='week'?'Oct 19–25':DAYS[S.day][0]+' '+DAYS[S.day][1].slice(4);
  fit();
}
function fit(){const w=$('#w-1d'),sc=w.clientWidth/1040;$('#st-1d').style.transform=`scale(${sc})`;w.style.height=(RACK.h*sc)+'px'}
function toast(msg,undo){const t=$('#toast');t.innerHTML=esc(msg)+(undo?' <button data-act="undo">Undo</button>':'');t.style.display='flex';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',4800)}
function setState(k,v){S.confirm=false;
  if(k==='span'){S.span=v;if(!CELLS[v].includes(S.cell))S.cell=v==='week'?60:5}
  else if(k==='cell')S.cell=+v;else if(k==='view'){S.view=v;S.pen=null}else if(k==='day')S.day=+v;else if(k==='lay')S.lay=v;else if(k==='shape')S.shape=v;else if(k==='eng')S.eng=v;else if(k==='ends')S.ends=v;else if(k==='scope')S.scope=v;else if(k==='zg')S.zg=v==='1';else if(k==='multi')S.multi=v==='1';else if(k==='ink')S.ink=v;else if(k==='sm')S.sm=v}
function act(a){
  const n=a.split(':')[0],arg=a.slice(a.indexOf(':')+1);
  if(n==='prev'||n==='next'){if(S.span==='week')return toast('Only this week is sampled.');S.day=Math.max(0,Math.min(6,S.day+(n==='next'?1:-1)));S.confirm=false}
  else if(n==='today'){S.day=NOW.day;S.confirm=false}
  else if(n==='clear')S.confirm=true;else if(n==='clear-no')S.confirm=false;
  else if(n==='clear-go'){const r=read(),lab=spanLab();undoList=spanDays().map(d=>S.view+':'+d).filter(k=>!S.cleared[k]);undoList.forEach(k=>S.cleared[k]=true);S.confirm=false;toast(`Cleared ${fmtDur(r.tracked)} on ${lab}.`,true)}
  else if(n==='undo'){(undoList||[]).forEach(k=>delete S.cleared[k]);undoList=null;$('#toast').style.display='none'}
  else if(n==='reset')resetTubes();
  else if(n==='toast')return toast(arg);
  renderAll();
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-set],[data-act],[data-pen],[data-tool],[data-flag],[data-glass],[data-fid]');if(!t)return;const d=t.dataset;
  if(d.fid){const[a,m]=d.fid.split(':');(a==='all'?[0,1,2,3,4,5,6]:[+a]).forEach(x=>{if(m==='grid')delete S.fid[x];else S.fid[x]=m})}
  else if(d.set){const i=d.set.indexOf(':');setState(d.set.slice(0,i),d.set.slice(i+1))}
  else if(d.pen)S.pen=d.pen;else if(d.tool)S.tool=(d.tool==='point'&&S.tool==='point')?'draw':d.tool;else if(d.flag)S.flags[d.flag]=!S.flags[d.flag];else if(d.glass)S.glass=d.glass;
  else if(d.act){act(d.act);return}
  renderAll();
});
$('#mathsw').addEventListener('change',e=>document.body.classList.toggle('math',e.target.checked));
const tip=$('#tip');
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]');if(t){tip.textContent=t.dataset.tip;tip.style.display='block'}});
document.addEventListener('mousemove',e=>{if(tip.style.display==='block'){tip.style.left=Math.min(e.clientX+14,innerWidth-250)+'px';tip.style.top=(e.clientY+16)+'px'}});
document.addEventListener('mouseout',e=>{if(e.target.closest('[data-tip]'))tip.style.display='none'});
window.addEventListener('resize',fit);
$('#mathnote').textContent=RACK.math;
renderAll();
</script>
