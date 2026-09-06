import json,re,os,collections
CANON={0:'white',1:'off-white',2:'gray',3:'dark gray',4:'darker gray',5:'black',6:'pink',7:'light pink',
       8:'red',9:'blue',10:'light blue',11:'yellow',12:'orange',13:'dark red',14:'green',15:'purple'}
WORD2IDX={'white':{0,1},'off-white':{0,1},'light gray':{1,2},'light grey':{1,2},'gray':{2,3,4},'grey':{2,3,4},
 'dark gray':{3,4},'dark grey':{3,4},'black':{5},'pink':{6,7},'magenta':{6,7},'fuchsia':{6,7},
 'red':{8,13},'crimson':{8,13},'maroon':{13},'blue':{9,10},'cyan':{10},'teal':{10},'azure':{10},
 'yellow':{11},'gold':{11},'orange':{12},'green':{14},'lime':{14},'purple':{15},'violet':{15}}
W='(?:off-white|light gray|light grey|dark gray|dark grey|white|gray|grey|black|pink|magenta|fuchsia|crimson|maroon|red|cyan|teal|azure|blue|yellow|gold|orange|green|lime|purple|violet)'
# STRICT: "<colour> ... at (x,y)"  or "(x,y) is <colour>" or "<colour> at x27 y41"
S1=re.compile(rf'\b({W})\b[^.;\n]{{0,40}}?\bat\b[^.;\n]{{0,12}}?[\(\[]?\s*x?\s*(\d{{1,2}})\s*[, ]\s*y?\s*(\d{{1,2}})\s*[\)\]]?',re.I)
S2=re.compile(rf'[\(\[]\s*(\d{{1,2}})\s*,\s*(\d{{1,2}})\s*[\)\]][^.;\n]{{0,25}}?\b(?:is|=|:)\s+(?:a|the|an)?\s*({W})\b',re.I)
NAMED=re.compile(rf'\b({W})[\s\-]*\(?(\d{{1,2}})\)?(?![\d,)])',re.I)
IDXN =re.compile(rf'\b(?:colou?r|value|index)[\s=:]*(\d{{1,2}})\s*\(?\s*({W})\)?',re.I)
ODD=re.compile(r"(player\s?\d+|object [A-Z]\b|the developer\b|developers\b|the user\b|user'?s\b|colleagues?\b|AI API\b|system (?:prompt|message)\b|only include the summary|original observation|verified player data)",re.I)

def texts(recs):
    for i,d in enumerate(recs):
        ai=d.get('action_input') or {}
        raw=ai.get('reasoning')
        if not raw: continue
        try: r=json.loads(raw) if isinstance(raw,str) else raw
        except Exception: continue
        prev=recs[i-1].get('frame') if i>0 else None
        prev=prev[-1] if prev else None
        yield i,ai.get('id'),(r.get('output') or ''),(r.get('reasoning') or ''),(r.get('usage') or {}),prev

def run(path,label):
    recs=[json.loads(l).get('data',{}) for l in open(path)]
    st=dict(label=label,n=0,n_out=0,n_sum=0,rows=[],named=[],odd=collections.Counter(),odd_ex={})
    for i,aid,out,summ,u,prev in texts(recs):
        st['n']+=1
        if out.strip(): st['n_out']+=1
        if summ.strip(): st['n_sum']+=1
        blob=out+"\n"+summ
        for m in ODD.finditer(blob):
            k=m.group(1).lower(); st['odd'][k]+=1
            st['odd_ex'].setdefault(k,(i,blob[max(0,m.start()-120):m.start()+160]))
        for m in NAMED.finditer(blob):
            w,ix=m.group(1).lower(),int(m.group(2))
            if ix<=15: st['named'].append((i,w,ix,ix in WORD2IDX.get(w,set())))
        for m in IDXN.finditer(blob):
            ix,w=int(m.group(1)),m.group(2).lower()
            if ix<=15: st['named'].append((i,w,ix,ix in WORD2IDX.get(w,set())))
        if prev is None: continue
        for rx,order in ((S1,'wxy'),(S2,'xyw')):
            for m in rx.finditer(blob):
                if order=='wxy': w,x,y=m.group(1).lower(),int(m.group(2)),int(m.group(3))
                else: x,y,w=int(m.group(1)),int(m.group(2)),m.group(3).lower()
                if not(0<=x<64 and 0<=y<64): continue
                v=prev[y][x]
                st['rows'].append((i,w,x,y,v,CANON[v],v in WORD2IDX.get(w,set())))
    return st

out=[]
for f in sorted(os.listdir('/tmp/astra')):
    if f.endswith('.ndjson'): out.append(run('/tmp/astra/'+f,f[:-7]))
for s in out:
    r=s['rows']; ok=sum(1 for x in r if x[6]); nm=s['named']; nok=sum(1 for x in nm if x[3])
    print(f"\n### {s['label']}: {s['n']} actions | prose-output {s['n_out']} | reasoning-summary {s['n_sum']}")
    print(f"  STRICT colour@coord claims: {len(r)}  correct: {ok}" + (f" ({ok/len(r)*100:.0f}%)" if r else ""))
    if r: print("   claimed->actual:",collections.Counter((x[1],x[5]) for x in r).most_common(6))
    print(f"  colour+index pairs: {len(nm)}  consistent: {nok}")
    if nm: print("   ",collections.Counter((x[1],x[2]) for x in nm).most_common(6))
    print("  odd phrases:",dict(s['odd'].most_common(12)))
json.dump([{k:(dict(v) if isinstance(v,collections.Counter) else v) for k,v in s.items()} for s in out],open('/tmp/astra/out/audit.json','w'),indent=1)
