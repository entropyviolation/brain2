"""File creation/modification by folder and name vs confirmed Activity. Read-only.
Run: python3 scripts/bim-screentime-files.py   (scans ~ once, caches to /tmp/brain2-files.json)"""
import os,json,sys,time,datetime
HOME=os.path.expanduser('~'); CACHE='/tmp/brain2-files.json'
LO=datetime.datetime(2026,9,1).timestamp(); HI=datetime.datetime(2026,10,31).timestamp()
SKIP={'node_modules','.git','.next','Library','.Trash','.cache','.npm','Brain2Backups','cogs-backups','Applications','Applications (Parallels)','Parallels','.cursor','.claude','google-cloud-sdk','Resilio Sync','__pycache__','.venv','venv','dist','build','.turbo','.DS_Store','Creative Cloud Files','nltk_data'}
def scan():
    out=[]
    for root,dirs,files in os.walk(HOME):
        dirs[:]=[d for d in dirs if d not in SKIP and not d.startswith('.')]
        for f in files:
            if f.startswith('.'): continue
            p=os.path.join(root,f)
            try: st=os.stat(p)
            except OSError: continue
            b=getattr(st,'st_birthtime',st.st_ctime)
            if LO<=st.st_mtime<HI or LO<=b<HI:
                out.append([os.path.relpath(p,HOME),st.st_mtime,b,st.st_size])
    return out
if not os.path.exists(CACHE) or '--rescan' in sys.argv:
    t=time.time(); r=scan(); json.dump(r,open(CACHE,'w')); print('scanned',len(r),'files in',round(time.time()-t),'s')
F=json.load(open(CACHE)); print('files',len(F))

import collections,statistics as S,datetime as dt
d=json.load(open('data/shared-persist.json')); v=json.loads(d['items']['brain2-timegrid-store'])['state']; E=v['entries']
pn={(s['id'],p['id']):p.get('name') for s in v['scopes'] for p in s.get('pens',[])}
def loc(ts): x=dt.datetime.fromtimestamp(ts); return x.strftime('%Y-%m-%d'), x.hour*60+x.minute
ev=collections.defaultdict(list)   # date -> [(min, kind, top, sub, ext)]
seen=set()
for rel,m,b,sz in F:
    parts=rel.split('/'); top=parts[0] if len(parts)>1 else '(home)'; sub=parts[1] if len(parts)>2 else ''
    ext=os.path.splitext(rel)[1].lower()
    for kind,ts in (('mod',m),('new',b)):
        if not (LO<=ts<HI): continue
        dd,mm=loc(ts); k=(dd,mm,top,kind)
        ev[dd].append((mm,kind,top,sub,ext,rel))
# collapse bulk: >100 events in the same (date,minute,top) -> one
for dd in ev:
    c=collections.Counter((e[0],e[2]) for e in ev[dd]); bulk={k for k,n in c.items() if n>100}
    ev[dd]=[e for e in ev[dd] if (e[0],e[2]) not in bulk]
days=sorted(ev); print('days with file events',len(days))
tp=collections.Counter(e[2] for dd in ev for e in ev[dd]); print('events by top folder',tp.most_common(14))
nm=lambda e:pn.get(('activity',e['penId']),e['penId'])
A=[e for e in E if e['scopeId']=='activity' and not e.get('generatedBy') and e.get('precision')!='estimated' and '2026-09-01'<=e['date']<='2026-10-30' and e['endMin']-e['startMin']>=20]
print('activity blocks',len(A))
def inside(e,kind=None,trim=0):
    return [x for x in ev.get(e['date'],[]) if e['startMin']+trim<=x[0]<e['endMin']-trim and (kind is None or x[1]==kind)]
print('\nQ1 share of blocks with any file event, by pen')
g=collections.defaultdict(list)
for e in A: g[nm(e)].append(inside(e))
for k,xs in sorted(g.items(),key=lambda kv:-len(kv[1]))[:12]:
    print(f'  {k:26s}n={len(xs):3d} any={sum(bool(x) for x in xs)/len(xs):.2f} median events={S.median(len(x) for x in xs):.0f}  tops={collections.Counter(t for x in xs for t in {y[2] for y in x}).most_common(3)}')
print('\nQ2 top folder -> pen, LODO (blocks with events)')
C=[e for e in A if inside(e)]
def top1(e): return collections.Counter(y[2] for y in inside(e)).most_common(1)[0][0]
ok=base=0
for e in C:
    tr=[x for x in C if x['date']!=e['date']]; tb=collections.defaultdict(collections.Counter)
    for x in tr: tb[top1(x)][nm(x)]+=1
    mj=collections.Counter(nm(x) for x in tr).most_common(1)[0][0]
    p=tb[top1(e)].most_common(1)[0][0] if top1(e) in tb else mj; ok+=p==nm(e); base+=mj==nm(e)
print(f'  {len(C)} blocks: {ok}/{len(C)}={ok/len(C):.2f} vs baseline {base/len(C):.2f}')
t=collections.defaultdict(collections.Counter)
for e in C: t[top1(e)][nm(e)]+=1
for a,c in sorted(t.items(),key=lambda kv:-sum(kv[1].values()))[:9]: print('   ',a,dict(c.most_common(4)))
print('\nQ3 sleep constraint (30 min trimmed)')
Sl=[e for e in A if nm(e)=='Sleep' and e['endMin']-e['startMin']>=180]
bad=[e for e in Sl if inside(e,trim=30)]
print(f'  {len(Sl)} sleep blocks, {len(bad)} with a file event inside')
for e in bad[:6]: print('   ',e['date'],e['startMin']//60,e['endMin']//60,collections.Counter(y[2]+' '+y[1] for y in inside(e,trim=30)).most_common(3))
print('\nQ4 ext by pen (blocks with a new/modified file of ext)')
for ext in ('.psd','.ai','.png','.jpg','.mp3','.wav','.ts','.tsx','.md','.py'):
    r={k:sum(any(y[4]==ext for y in inside(e)) for e in A if nm(e)==k) for k in ('Computer Work','Brain2','Foxtide work','scrolling','Sleep')}
    print(' ',ext,r)
print('\nQ5 new files (creation) in Downloads/Pictures/Desktop by pen')
for e0 in ('Downloads','Pictures','Desktop','Documents'):
    r=collections.Counter(nm(e) for e in A if any(y[1]=='new' and y[2]==e0 for y in inside(e)))
    print(' ',e0,r.most_common(5))
print('\nQ6 any file event => at a screen (Company/Location)')
def prc(sc,pos,ml=30):
    B=[e for e in E if e['scopeId']==sc and '2026-09-01'<=e['date']<='2026-10-30' and not e.get('generatedBy') and e.get('precision')!='estimated' and e['endMin']-e['startMin']>=ml and e['date'] in ev]
    pn2=lambda e:pn.get((sc,e['penId']),e['penId'])
    tp=sum(bool(inside(e)) and pos(pn2(e)) for e in B); fp=sum(bool(inside(e)) and not pos(pn2(e)) for e in B); fn=sum(not inside(e) and pos(pn2(e)) for e in B); tn=sum(not inside(e) and not pos(pn2(e)) for e in B)
    n=len(B); print(f'  {sc}: n={n} acc {(tp+tn)/n:.2f} baseline {max(tp+fn,fp+tn)/n:.2f}  event=>pos {tp}/{tp+fp}  none=>not {tn}/{tn+fn}')
prc('company',lambda p:p.lower()=='alone'); prc('location',lambda p:p=='Home')

print('\nQ7 which folders are reliable (events landing in blocks that are clearly not at the computer)')
away={'Sleep','driving','walking','hanging out with someone','scrolling','watching tv','youtube'}
for top in [t for t,_ in tp.most_common(8)]:
    bl=[e for e in A if any(y[2]==top for y in inside(e))]
    print(f'  {top:18s} blocks={len(bl):3d} in away pens={sum(nm(e) in away for e in bl):3d} ({sum(nm(e) in away for e in bl)/max(len(bl),1):.2f})')
print('\nQ8 rule: >=3 file events in the block (excluding noisy folders) => a work pen')
noisy={'websites'}
cnt=lambda e:len([y for y in inside(e) if y[2] not in noisy])
rate=collections.defaultdict(lambda:[0,0])
for e in A: rate[nm(e)][1]+=1; rate[nm(e)][0]+=cnt(e)>=3
work={k for k,(a,n) in rate.items() if n>=5 and a/n>=.6}; print('  learned work pens',sorted(work))
for th in (1,3):
    tpp=sum(cnt(e)>=th and nm(e) in work for e in A); fp=sum(cnt(e)>=th and nm(e) not in work for e in A)
    fn=sum(cnt(e)<th and nm(e) in work for e in A); tn=sum(cnt(e)<th and nm(e) not in work for e in A); n=len(A)
    print(f'  th={th}: acc {(tpp+tn)/n:.2f} vs baseline {max(tpp+fn,fp+tn)/n:.2f}; events=>work {tpp}/{tpp+fp}; none=>not work {tn}/{tn+fn}')
