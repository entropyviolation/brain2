import json,collections
d=json.load(open('data/shared-persist.json'))
v=json.loads(d['items']['brain2-timegrid-store'])['state']
E=v['entries']
pn={(s['id'],p['id']):(p.get('name') or p.get('label')) for s in v['scopes'] for p in s.get('pens',[])}
mac=[e for e in E if e['scopeId']=='screentime' and (e.get('generatedBy') or {}).get('kind')=='screentime']
days=sorted({e['date'] for e in mac}); print('AW days',len(days),days[0],days[-1])
byd=collections.defaultdict(list)
for e in mac: byd[e['date']].append(e)
def apps(date,s,t):
    c=collections.Counter()
    for x in byd[date]:
        o=min(t,x['endMin'])-max(s,x['startMin'])
        if o>0: c[pn.get(('screentime',x['penId']),x['penId'])]+=o
    return c
def cov(date,s,t):
    iv=sorted((max(x['startMin'],s),min(x['endMin'],t)) for x in byd[date] if min(x['endMin'],t)>max(x['startMin'],s))
    tot=0;cur=None
    for a,b in iv:
        if cur and a<=cur[1]: cur[1]=max(cur[1],b)
        else:
            if cur: tot+=cur[1]-cur[0]
            cur=[a,b]
    if cur: tot+=cur[1]-cur[0]
    return tot/(t-s)
def truth(scope,minlen=20):
    return [e for e in E if e['scopeId']==scope and e['date'] in byd and not e.get('generatedBy') and e.get('precision')!='estimated' and e['endMin']-e['startMin']>=minlen]
# Q1: among screen activity blocks (cov>=.5), which pen? top app and app-set features, LODO
A=[e for e in truth('activity') if cov(e['date'],e['startMin'],e['endMin'])>=.5]
nm=lambda e:pn.get(('activity',e['penId']),e['penId'])
print('\nQ1 screen blocks',len(A),collections.Counter(nm(e) for e in A).most_common(8))
def feat(e,k=1): return tuple(a for a,_ in apps(e['date'],e['startMin'],e['endMin']).most_common(k))
for k in (1,2):
    hit=base=0
    for e in A:
        tr=[x for x in A if x['date']!=e['date']]
        tb=collections.defaultdict(collections.Counter)
        for x in tr: tb[feat(x,k)][nm(x)]+=1
        mj=collections.Counter(nm(x) for x in tr).most_common(1)[0][0]
        f=feat(e,k); p=tb[f].most_common(1)[0][0] if f in tb else mj
        hit+=p==nm(e); base+=mj==nm(e)
    print(f' top-{k} apps -> pen LODO {hit}/{len(A)}={hit/len(A):.2f} baseline {base/len(A):.2f}')
t=collections.defaultdict(collections.Counter)
for e in A: t[feat(e)[0] if feat(e) else '-'][nm(e)]+=1
for a,c in sorted(t.items(),key=lambda kv:-sum(kv[1].values()))[:7]: print('  ',a,dict(c))
# Q2: Company alone vs with someone, by Mac cover of the hour
C=truth('company',30)
pc=lambda e:pn.get(('company',e['penId']),e['penId'])
print('\nQ2 company blocks on AW days',len(C),collections.Counter(pc(e) for e in C).most_common(6))
g=collections.defaultdict(list)
for e in C: g[pc(e).lower()=='alone'].append(cov(e['date'],e['startMin'],e['endMin']))
for k,xs in g.items(): print('  alone' if k else '  with someone',len(xs),'median cov',sorted(xs)[len(xs)//2] if xs else None,'share>=.5',sum(x>=.5 for x in xs)/max(len(xs),1))
# Q3: Location
L=truth('location',30)
pl=lambda e:pn.get(('location',e['penId']),e['penId'])
print('\nQ3 location blocks',len(L))
g=collections.defaultdict(list)
for e in L: g[pl(e)].append(cov(e['date'],e['startMin'],e['endMin']))
for k,xs in sorted(g.items(),key=lambda kv:-len(kv[1]))[:6]: print(f'  {k:18s}{len(xs):3d} share>=.5 {sum(x>=.5 for x in xs)/len(xs):.2f} any {sum(x>0 for x in xs)/len(xs):.2f}')
# Q4: Mac activity in daily window, first/last use vs sleep
S=[e for e in E if e['scopeId']=='activity' and nm(e)=='Sleep' and not e.get('generatedBy') and e['endMin']-e['startMin']>=180 and e['date'] in byd]
print('\nQ4 sleep blocks',len(S))
for e in S:
    m=apps(e['date'],e['startMin']+30,e['endMin']-30)
    if sum(m.values())>=10: print('  ',e['date'],e['startMin']//60,e['endMin']//60,dict(m.most_common(3)))
print('\nQ2 thresholds (alone iff Mac cover >= th)')
al=[cov(e['date'],e['startMin'],e['endMin']) for e in C if pc(e).lower()=='alone']
ws=[cov(e['date'],e['startMin'],e['endMin']) for e in C if pc(e).lower()!='alone']
for th in (0.01,0.2,0.4):
    ok=sum(x>=th for x in al)+sum(x<th for x in ws); print(f' th={th}: {ok}/{len(C)}={ok/len(C):.2f} baseline {max(len(al),len(ws))/len(C):.2f}  alone-hit {sum(x>=th for x in al)}/{len(al)} with-someone-false-alone {sum(x>=th for x in ws)}/{len(ws)}')
print(' with-someone covers:',[round(x,2) for x in ws])
