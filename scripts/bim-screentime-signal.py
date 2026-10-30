import json,collections,statistics as S
d=json.load(open('data/shared-persist.json'))
v=json.loads(d['items']['brain2-timegrid-store'])['state']
E=v['entries']
pn={(s['id'],p['id']):(p.get('name') or p.get('label')) for s in v['scopes'] for p in s.get('pens',[])}
LO,HI='2026-09-01','2026-10-30'
truth=[e for e in E if e['scopeId']=='activity' and not e.get('generatedBy') and e.get('precision')!='estimated' and LO<=e['date']<=HI and e['endMin']-e['startMin']>=20]
nm=lambda e:pn.get(('activity',e['penId']),e['penId'])
def src(e):
    return e['scopeId']+':'+str((e.get('generatedBy') or {}).get('kind'))
sig=collections.defaultdict(list)
for e in E:
    if e['scopeId'] in('screentime','iphone-screentime'): sig[(e['date'],src(e))].append((e['startMin'],e['endMin']))
for k in sorted({s for _,s in sig}): print(k,len({d for d,s in sig if s==k}),'days',sum(len(v) for (d,s),v in sig.items() if s==k),'entries')
def cov(date,s,t,source):
    iv=sorted((max(a,s),min(b,t)) for a,b in sig.get((date,source),[]) if min(b,t)>max(a,s))
    tot=0;cur=None
    for a,b in iv:
        if cur is None or a>cur[1]:
            if cur: tot+=cur[1]-cur[0]
            cur=[a,b]
        else: cur[1]=max(cur[1],b)
    if cur: tot+=cur[1]-cur[0]
    return tot/(t-s)
for source in ['screentime:screentime','screentime:phone-sync','iphone-screentime:phone-sync']:
    days={d for d,s in sig if s==source}
    rows=[(nm(e),cov(e['date'],e['startMin'],e['endMin'],source)) for e in truth if e['date'] in days]
    print('\n==',source,'truth blocks on days with data:',len(rows))
    g=collections.defaultdict(list)
    for a,c in rows: g[a].append(c)
    for k,xs in sorted(g.items(),key=lambda kv:-len(kv[1]))[:9]:
        print(f'  {k:26s} n={len(xs):2d} median={S.median(xs):.2f} any>0={sum(x>0 for x in xs)/len(xs):.2f} >=.5={sum(x>=.5 for x in xs)/len(xs):.2f}')
    # binary rule: "at the Mac" = cov>=.5 ; truth class = Mac work-ish
    macwork={'Computer Work','Brain2','Foxtide work','making playlists/finding new music','ordering supplies','watching tv'}
    tp=sum(1 for a,c in rows if a in macwork and c>=.5); fp=sum(1 for a,c in rows if a not in macwork and c>=.5)
    fn=sum(1 for a,c in rows if a in macwork and c<.5); tn=sum(1 for a,c in rows if a not in macwork and c<.5)
    print(f'  rule cov>=.5 => at-a-screen-activity: tp={tp} fp={fp} fn={fn} tn={tn}; acc={(tp+tn)/len(rows):.2f} baseline={max(tp+fn,fp+tn)/len(rows):.2f}')

print('\n#### scrolling detector on iPhone Screen Time days')
src2='iphone-screentime:phone-sync'; days={d for d,s in sig if s==src2}
R=[(nm(e),cov(e['date'],e['startMin'],e['endMin'],src2),cov(e['date'],e['startMin'],e['endMin'],'screentime:screentime') if e['date'] in {d for d,s in sig if s=='screentime:screentime'} else None) for e in truth if e['date'] in days]
for th in (0.1,0.3,0.5):
    tp=sum(a=='scrolling' and c>=th for a,c,_ in R);fp=sum(a!='scrolling' and c>=th for a,c,_ in R)
    fn=sum(a=='scrolling' and c<th for a,c,_ in R)
    print(f'th={th}: tp={tp} fp={fp} fn={fn} precision={tp/max(tp+fp,1):.2f} recall={tp/max(tp+fn,1):.2f}; scrolling base rate={sum(a=="scrolling" for a,_,_ in R)/len(R):.2f}')
print('non-scrolling with phone>=.3:',collections.Counter(a for a,c,_ in R if a!='scrolling' and c>=.3).most_common(6))
# leakage check: is Sleep with Mac screentime a real constraint violation?
sl=[(e['date'],e['startMin'],e['endMin']) for e in truth if nm(e)=='Sleep' and e['date'] in {d for d,s in sig if s=='screentime:screentime'}]
print('Sleep blocks on AW days',len(sl),'with Mac minutes >=10:',sum(cov(d,s,t,'screentime:screentime')*(t-s)>=10 for d,s,t in sl))
