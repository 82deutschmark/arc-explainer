"""
Author: Claude Opus 5 (Bubba sub-agent, label arc3-junk-audit) — copied verbatim 01-Sep-2026
Date: 01-September-2026
PURPOSE: The analyzer that produced the 01-Sep-2026 junk-game audit
(docs/2026-09-01-arc3-junk-game-audit.md) and its results.json. Kept as the historical
artifact the shipped gate is diffed against, NOT as running code: scripts/arc3/
legibility_gate.py is the implementation, and it corrects a hole in this file's Signal A
(the unguarded lose() inside a fail() wrapper was counted as an environmental death, which
hid q718-v1). It reads absolute paths under /tmp that no longer exist. Do not edit it --
its value is being exactly what ran on the day.
SRP/DRY check: Pass — reference artifact, imported by nothing.
"""
import ast,json,os,re
from collections import Counter
D='/tmp/arc3audit/src'
SUS_KEYS={'plan','solution','answer','code','seq','sequence','key','combo','password','order','target','recipe','pattern','moves','steps','path','spell','chord','word','phrase','secret','proof','witness','ritual','script','program','song','melody','route','chain','formula'}
HIST_RE=re.compile(r'\b(history|log|trail|record|moves|inputs|actions_taken|taken|played|typed|entered|buffer|stack|seq|sequence|pressed)\b')
def cint(n): return n.value if isinstance(n,ast.Constant) and isinstance(n.value,int) else None

def collect(stmts, ctx, out):
    """single traversal; out gets (callname, ctx, node). ctx items: ('pos',test) / ('neg',[tests])"""
    for st in stmts:
        if isinstance(st, ast.If):
            chain=[]; cur=st
            while True:
                chain.append(cur.test)
                collect(cur.body, ctx+[('pos',cur.test,None)], out)
                if len(cur.orelse)==1 and isinstance(cur.orelse[0],ast.If):
                    cur=cur.orelse[0]; continue
                if cur.orelse: collect(cur.orelse, ctx+[('neg',None,list(chain))], out)
                break
        elif isinstance(st,(ast.For,ast.While,ast.With,ast.AsyncWith,ast.Try,ast.AsyncFor)):
            for fld in ('body','orelse','finalbody','handlers'):
                b=getattr(st,fld,None) or []
                if fld=='handlers':
                    for h in b: collect(h.body,ctx,out)
                else: collect(b,ctx,out)
            for n in ast.iter_child_nodes(st):
                if isinstance(n,(ast.expr,)):
                    for c in ast.walk(n):
                        if isinstance(c,ast.Call): out.append((cname(c),list(ctx),c))
        else:
            for c in ast.walk(st):
                if isinstance(c,ast.Call): out.append((cname(c),list(ctx),c))

def cname(c):
    f=c.func
    if isinstance(f,ast.Attribute): return f.attr
    if isinstance(f,ast.Name): return f.id
    return None

def terms(node):
    """(self-attrs, string subscript keys) touched"""
    attrs=set(); keys=set()
    for n in ast.walk(node):
        if isinstance(n,ast.Attribute): attrs.add(n.attr)
        elif isinstance(n,ast.Subscript):
            s=n.slice
            if isinstance(s,ast.Constant) and isinstance(s.value,str): keys.add(s.value)
    return attrs,keys

def analyze(path,gid):
    src=open(path).read()
    try: tree=ast.parse(src)
    except SyntaxError as e: return {'gameId':gid,'parse_error':str(e)}
    funcs={}
    for n in ast.walk(tree):
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)): funcs.setdefault(n.name,n)
    lose_helpers=set()
    for _ in range(4):
        ch=False
        for fn_name,fn in funcs.items():
            if fn_name in lose_helpers or fn_name=='lose': continue
            for c in ast.walk(fn):
                if isinstance(c,ast.Call) and isinstance(c.func,ast.Attribute) and (c.func.attr=='lose' or c.func.attr in lose_helpers):
                    lose_helpers.add(fn_name); ch=True; break
        if not ch: break
    LOSE={'lose'}|lose_helpers
    rend_attrs=set(); rend_keys=set()
    for fn_name,fn in funcs.items():
        if fn_name.startswith('render') or 'draw' in fn_name or fn_name.startswith('paint') or fn_name.startswith('blit'):
            a,k=terms(fn); rend_attrs|=a; rend_keys|=k
    step=funcs.get('step')
    if step is None: return {'gameId':gid,'no_step':True}
    actvars=set()
    for n in ast.walk(step):
        if isinstance(n,ast.Assign) and isinstance(n.value,ast.Attribute):
            s=ast.unparse(n.value)
            if 'action' in s and ('.value' in s or s.endswith('.id')):
                for t in n.targets:
                    if isinstance(t,ast.Name): actvars.add(t.id)
    def act_ids(test):
        ids=set()
        for n in ast.walk(test):
            if isinstance(n,ast.Compare):
                l=ast.unparse(n.left)
                if not (l in actvars or ('action' in l and ('.value' in l or '.id' in l))): continue
                for op,cm in zip(n.ops,n.comparators):
                    if isinstance(op,ast.Eq):
                        c=cint(cm)
                        if c is not None: ids.add(c)
                    elif isinstance(op,ast.In) and isinstance(cm,(ast.Tuple,ast.List,ast.Set)):
                        for e in cm.elts:
                            c=cint(e)
                            if c is not None: ids.add(c)
        return ids
    allc=[]
    for fn_name,fn in funcs.items():
        cc=[]; collect(fn.body,[],cc)
        for nm,ctx,node in cc: allc.append((fn_name,nm,ctx,node))
    # dedupe by (fn, name, lineno,col)
    seen=set(); uniq=[]
    for fn_name,nm,ctx,node in allc:
        k=(fn_name,nm,node.lineno,node.col_offset)
        if k in seen: continue
        seen.add(k); uniq.append((fn_name,nm,ctx,node))
    allc=uniq
    lose_sites=[]
    for fn_name,nm,ctx,node in allc:
        if nm not in LOSE: continue
        if fn_name=='lose' or (fn_name in lose_helpers and nm=='lose'):
            # helper wrapper body: classify at call sites instead, but keep if it's the only path
            pass
        commit=False; neutral=False; poss=[]
        for kind,test,chain in ctx:
            if kind=='pos':
                poss.append(test)
                ids=act_ids(test)
                if ids=={6}: commit=True
            else:
                pin=set()
                for t in chain: pin|=act_ids(t)
                if pin: neutral=True
        cls='commit' if commit else ('dispatch_else' if neutral else 'environmental')
        lose_sites.append({'fn':fn_name,'cls':cls,'guard':' && '.join(ast.unparse(t) for t in poss)[:180],'line':node.lineno})
    kinds=Counter(s['cls'] for s in lose_sites)
    sigA = kinds['commit']>0 and kinds['environmental']==0
    # advance guards
    guard_tests=[]
    for fn_name,nm,ctx,node in allc:
        if nm not in ('next_level','win','advance_level','complete_level'): continue
        for kind,test,chain in ctx:
            if kind=='pos': guard_tests.append(test)
    hid_eq=[]; tight=False; loose=False
    for t in guard_tests:
        for n in ast.walk(t):
            if not isinstance(n,ast.Compare): continue
            if not any(isinstance(o,ast.Eq) for o in n.ops): continue
            sides=[n.left]+list(n.comparators)
            a=set(); k=set()
            for s in sides:
                aa,kk=terms(s); a|=aa; k|=kk
            hidden_a={x for x in a if x not in rend_attrs and x not in ('value','id','level_index','action')}
            hidden_k={x for x in k if x not in rend_keys}
            if hidden_a or hidden_k:
                loose=True
            # tight: exact-sequence flavour
            is_seq_lit=any(isinstance(s,(ast.Tuple,ast.List)) and len(s.elts)>=2 and all(isinstance(e,ast.Constant) for e in s.elts) for s in sides)
            sus_key = (hidden_k & SUS_KEYS)
            hist = HIST_RE.search(ast.unparse(n)) is not None and bool(hidden_a|hidden_k)
            if (is_seq_lit or sus_key or hist) and (hidden_a or hidden_k):
                tight=True
                hid_eq.append({'cmp':ast.unparse(n)[:200],'hidden_attrs':sorted(hidden_a),'hidden_keys':sorted(hidden_k),
                               'why':('seq_literal' if is_seq_lit else '')+('|level_key' if sus_key else '')+('|history' if hist else '')})
    return {'gameId':gid,'sigA':sigA,'sigB_tight':tight,'sigB_loose':loose,'sigC':kinds['commit']>0,
            'lose_kinds':dict(kinds),'n_lose':len(lose_sites),'n_adv_guards':len(guard_tests),
            'hidden_eq':hid_eq[:4],'lose_sites':lose_sites[:5],
            'guards':[ast.unparse(t)[:220] for t in guard_tests][:4],'rend_attrs_n':len(rend_attrs)}

games=json.load(open('/tmp/arc3audit/games.json'))['data']['games']
cat={g['gameId']:g['category'] for g in games}
res=[]
for f in sorted(os.listdir(D)):
    gid=f[:-3]; r=analyze(os.path.join(D,f),gid); r['category']=cat.get(gid); res.append(r)
json.dump(res,open('/tmp/arc3audit/results.json','w'),indent=1)
ok=[r for r in res if 'sigA' in r]
print('total',len(res),'analyzable',len(ok),'skipped',[r for r in res if 'sigA' not in r][:5])
print('sigA(commit-only death)',sum(r['sigA'] for r in ok))
print('sigB_tight',sum(r['sigB_tight'] for r in ok),'sigB_loose',sum(r['sigB_loose'] for r in ok))
print('JUNK A&B_tight',sum(r['sigA'] and r['sigB_tight'] for r in ok))
print(Counter((r['category'],'JUNK' if (r['sigA'] and r['sigB_tight']) else '-') for r in ok))
q=[r for r in ok if r['gameId']=='q742-v1'][0]
print(json.dumps(q,indent=1)[:1800])
