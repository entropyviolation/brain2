"""Browser (Chrome history) signals vs confirmed Activity/Company/Location. Run: python3 scripts/bim-screentime-browser.py"""
import json,collections,re,statistics as S
d=json.load(open('data/shared-persist.json'))
v=json.loads(d['items']['brain2-timegrid-store'])['state']
E=v['entries']
pn={(s['id'],p['id']):p.get('name') for s in v['scopes'] for p in s.get('pens',[])}
LO,HI='2026-09-01','2026-10-30'
ch=[e for e in E if e['scopeId']=='screentime' and (e.get('generatedBy') or {}).get('kind')=='phone-sync' and LO<=e['date']<=HI]
site=lambda e:pn.get(('screentime',e['penId']),e['penId'])
pages=lambda e:int((re.search(r'Pages \((\d+)\)',e.get('notes') or '') or [0,1])[1])
byd=collections.defaultdict(list)
for e in ch: byd[e['date']].append(e)
days=sorted(byd); print('chrome days',len(days),'sessions',len(ch))
def truth(sc,ml=20): return [e for e in E if e['scopeId']==sc and LO<=e['date']<=HI and e['date'] in byd and not e.get('generatedBy') and e.get('precision')!='estimated' and e['endMin']-e['startMin']>=ml]
def hit(e):  # sessions overlapping block
    return [x for x in byd[e['date']] if min(x['endMin'],e['endMin'])>max(x['startMin'],e['startMin'])]
A=truth('activity'); nm=lambda e:pn.get(('activity',e['penId']),e['penId'])
print('activity blocks on chrome days',len(A))
print('\nQ1 pages/hour inside block, by activity (median, share with any session)')
g=collections.defaultdict(list)
for e in A: g[nm(e)].append((sum(pages(x) for x in hit(e))/((e['endMin']-e['startMin'])/60), bool(hit(e))))
for k,xs in sorted(g.items(),key=lambda kv:-len(kv[1]))[:12]:
    print(f'  {k:26s}n={len(xs):3d} median pages/h={S.median(a for a,_ in xs):5.1f} any={sum(b for _,b in xs)/len(xs):.2f}')
# Q2 rule: pages/h >= th => screen activity ; truth screen set from Mac cover learned earlier is person-specific; use pens whose chrome any>=.6 as "screen" learned LODO
print('\nQ2 site -> activity (LODO)')
def sites(e): return tuple(sorted({site(x) for x in hit(e)}))
Cand=[e for e in A if hit(e)]
print(' blocks with a session',len(Cand))
for mode in ('top','set'):
    ok=base=0
    for e in Cand:
        tr=[x for x in Cand if x['date']!=e['date']]
        def f(x):
            c=collections.Counter()
            for y in hit(x): c[site(y)]+=y['endMin']-y['startMin']
            return c.most_common(1)[0][0] if mode=='top' else sites(x)
        tb=collections.defaultdict(collections.Counter)
        for x in tr: tb[f(x)][nm(x)]+=1
        mj=collections.Counter(nm(x) for x in tr).most_common(1)[0][0]
        p=tb[f(e)].most_common(1)[0][0] if f(e) in tb else mj
        ok+=p==nm(e); base+=mj==nm(e)
    print(f' {mode}: {ok}/{len(Cand)}={ok/len(Cand):.2f} baseline {base/len(Cand):.2f}')
t=collections.defaultdict(collections.Counter)
for e in Cand:
    c=collections.Counter()
    for y in hit(e): c[site(y)]+=y['endMin']-y['startMin']
    t[c.most_common(1)[0][0]][nm(e)]+=1
for a,c in sorted(t.items(),key=lambda kv:-sum(kv[1].values()))[:8]: print('  ',a,dict(c.most_common(4)))
# Q3 sleep constraint
S_=[e for e in E if e['scopeId']=='activity' and nm(e)=='Sleep' and not e.get('generatedBy') and e['endMin']-e['startMin']>=180 and e['date'] in byd and LO<=e['date']<=HI]
inside=[e for e in S_ if any(min(x['endMin'],e['endMin']-30)>max(x['startMin'],e['startMin']+30) for x in byd[e['date']])]
print('\nQ3 sleep blocks',len(S_),'with a Chrome session inside (30 min trimmed):',len(inside))
# Q4 company
C=truth('company',30); pc=lambda e:pn.get(('company',e['penId']),e['penId'])
print('\nQ4 company blocks',len(C))
for lab,f in (('alone',lambda e:pc(e).lower()=='alone'),('with someone',lambda e:pc(e).lower()!='alone')):
    xs=[e for e in C if f(e)]; print(f'  {lab:13s}n={len(xs)} any session={sum(bool(hit(e)) for e in xs)/max(len(xs),1):.2f} median pages/h={S.median([sum(pages(x) for x in hit(e))/((e["endMin"]-e["startMin"])/60) for e in xs]) if xs else 0:.1f}')
# Q5 location
L=truth('location',30); pl=lambda e:pn.get(('location',e['penId']),e['penId'])
print('\nQ5 location blocks',len(L))
for k in ('Home',):
    for lab,f in ((k,lambda e:pl(e)==k),('not '+k,lambda e:pl(e)!=k)):
        xs=[e for e in L if f(e)]; print(f'  {lab:10s}n={len(xs)} any session={sum(bool(hit(e)) for e in xs)/max(len(xs),1):.2f}')
print('\nRules')
def acc(blocks,pos,lab):
    tp=sum(bool(hit(e)) and pos(e) for e in blocks); fp=sum(bool(hit(e)) and not pos(e) for e in blocks)
    fn=sum(not hit(e) and pos(e) for e in blocks); tn=sum(not hit(e) and not pos(e) for e in blocks)
    n=len(blocks); print(f' {lab}: session=>{lab.split()[0]}: acc {(tp+tn)/n:.2f} vs baseline {max(tp+fn,fp+tn)/n:.2f}; session precision {tp}/{tp+fp}; no-session precision (not) {tn}/{tn+fn}')
acc(C,lambda e:pc(e).lower()=='alone','alone')
acc(L,lambda e:pl(e)=='Home','Home')
for e in inside: print(' sleep with session inside:',e['date'],e['startMin']//60,e['endMin']//60,[ (site(x),x['startMin']//60) for x in byd[e['date']] if x['endMin']>e['startMin']+30 and x['startMin']<e['endMin']-30])
