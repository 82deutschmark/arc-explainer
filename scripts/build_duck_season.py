#!/usr/bin/env python3.13
"""Author: GPT-6 / Codex; rewritten around named teams by Claude Opus 5.5 Medium
Date: 2026-11-02
PURPOSE: Build the Duck season feature from committed, dated public sources: named teams'
day-by-day scores and places, how many teams doubled their score each day, and the current spread.
SRP/DRY check: Pass — follows leaderboard_backfill.py's daily carry-forward reconstruction;
adds honest missing cutoffs for small fields, fixed ranks, source boundaries and review assertions.
The default build is deterministic and offline. --refresh explicitly refreshes public snapshots; no sends or Git operations.
"""
import json, bisect, math, base64, gzip, argparse, urllib.request
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
REPO=Path(__file__).resolve().parents[1]
ROOT=REPO/'content/news/features/2026-11-02-duck'
SRC=ROOT/'sources'
OUTPUT=REPO/'client/public/specials/2026-11-02-the-duck-that-launched-a-thousand-ships.html'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--refresh',action='store_true',help='Refresh public board/tracker/Qwen snapshots before building; review resulting article changes.')
parser.add_argument('--output',type=Path,default=OUTPUT)
parser.add_argument('--portable',action='store_true',help='Embed the selected photographs for a single-file reading copy.')
parser.add_argument('--check',action='store_true',help='Check the committed output matches the template and frozen sources without writing.')
args=parser.parse_args()
if args.check and args.refresh: parser.error('--check and --refresh cannot be combined')
manifest=json.loads((SRC/'manifest.json').read_text())
if args.refresh:
    # Fetch every input successfully before replacing any frozen snapshot.
    fetched={}
    for name,url in manifest['sources'].items():
        if name=='qwen27-initial-tree.json': continue
        with urllib.request.urlopen(url,timeout=60) as response: data=json.load(response)
        payload=json.dumps(data,separators=(',',':')).encode()
        fetched[name]=gzip.compress(payload,mtime=0) if name.endswith('.gz') else payload
    for name,payload in fetched.items(): (SRC/name).write_bytes(payload)
    manifest['checkedAt']=datetime.now(timezone.utc).isoformat()
    (SRC/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
def read(n):
    if n=='notebook-census.json':
        return json.loads((REPO/'docs/newsroom/2026-11-02-public-notebook-census/census.json').read_text())
    path=SRC/n
    if path.exists(): return json.loads(path.read_text())
    return json.loads(gzip.decompress((SRC/(n+'.gz')).read_bytes()))
def cut(scores, rank): return scores[rank-1] if 1 <= rank <= len(scores) else None

def reconstruct(raw, last):
    history={tid: sorted((day[:10],float(v[0])) for day,v in h.items()) for tid,h in raw['history'].items() if h}
    days_by={tid:[x[0] for x in h] for tid,h in history.items()}
    day=date.fromisoformat(min(h[0][0] for h in history.values()))
    result=[]
    while day.isoformat() < last:
        ds=day.isoformat(); values=[]
        for tid,h in history.items():
            i=bisect.bisect_right(days_by[tid],ds)-1
            if i>=0: values.append(h[i][1])
        values.sort(reverse=True);n=len(values)
        result.append(dict(t=ds+'T23:59:00Z',teams=n,top=cut(values,1),gold=cut(values,10+int(n*.002)),silver=cut(values,int(n*.05)),bronze=cut(values,int(n*.1)),r10=cut(values,10),r100=cut(values,100),r500=cut(values,500),r1000=cut(values,1000),source='reconstructed'))
        day+=timedelta(days=1)
    return result

def daily(snaps):
    days={}
    for s in sorted(snaps,key=lambda s:s['t']): days[s['t'][:10]]={**s,'source':'observed'}
    return list(days.values())
raw=read('tong-history.json'); b3=read('arc3-board.json');b2=read('arc2-board.json')
first=b3['history']['snaps'][0]['t'][:10]
series=reconstruct(raw,first)+daily(b3['history']['snaps'])
# An observed aggregate snapshot has no whole-field score rows for fixed ranks.
# Keep those ranks absent instead of guessing them from truncated top-300 trails.
recon_all=reconstruct(raw, max(k for h in raw['history'].values() for k in h)[:10])
idx={s['t'][:10]:s for s in recon_all}
for s in series:
    if s['source']=='observed' and s['t'][:10] in idx:
        s['fixedSource']='reconstructed'
        for k in ['r10','r100','r500','r1000']:s[k]=idx[s['t'][:10]][k]
for s in series:
    for key in ['top','gold','silver','bronze','r10','r100','r500','r1000']:
        v=s.get(key)
        assert v is None or math.isfinite(v) and 0<=v<=100
lookup={s['t'][:10]:s for s in series}
assert lookup['2026-09-30']['bronze']==4.04 and lookup['2026-10-02']['bronze']==25.04
assert lookup['2026-10-02']['silver']==27.89
assert lookup['2026-06-30']['gold']==.7 and lookup['2026-07-05']['gold']==1.32

def distribution(board):
    rows=board['latest']['rows'];scores=[r[4] for r in rows]
    bins=[sum(lo<=s<(lo+5) or lo==95 and s==100 for s in scores) for lo in range(0,100,5)]
    assert sum(bins)==len(rows)
    return dict(t=board['latest']['fetched'],teams=len(rows),bins=bins,under5=bins[0],middle=sum(bins[5:7]),above35=sum(s>35 for s in scores),at35=sum(s==35 for s in scores))
qwen='https://github.com/QwenLM/Qwen3.8#news'
kaggle='https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/overview/timeline'
franzen='https://github.com/da-fr/arc-agi-3-solution/blob/main/WRITEUP.md'
events=[]
def event(t,label,lane,url,note):events.append(dict(t=t,label=label,lane=lane,url=url,note=note))
event('2026-04-22T00:00:00Z','Qwen 3.6 27B','model',qwen,'Developer release announcement; calendar day, not a precise public-access timestamp.')
event('2026-07-01T00:00:00Z','The Duck opens','notebook','https://github.com/Tufalabs/duck-harness','Around July 1, following the June 30 Milestone 1 deadline. Approximate release date; Tufa won the first milestone using Qwen 3.6 27B.')
event('2026-08-14T00:00:00Z','Qwen 3.8 27B','model',qwen,'Developer announcement: August 14. August 5 was repository creation; its initial tree contains only README.md and .gitattributes. We do not call that a weights release.')
event('2026-08-26T00:00:00Z','Flash Next','model','https://github.com/QwenLM/Qwen3.8-Flash-Next#news','Developer release announcement: August 26; weight-upload commit also dates to August 26. August 24 metadata is not evidence of public weights.')
event('2026-09-30T23:59:00Z','Milestone 2 notebooks','notebook',kaggle,'Kaggle deadline: September 30, 23:59 UTC. The Boss confirms the simultaneous notebook release firsthand. Franzen’s released submission scored 27.89 and built on the Duck. Daily score observations cannot establish within-day order.')
for t,label,url,note in [
 ('2026-04-23','GPT-5.5','https://openai.com/index/introducing-gpt-5-5/','ChatGPT and Codex launch April 23; API April 24.'),
 ('2026-06-09','Fable 5','https://www.anthropic.com/news/claude-fable-5-mythos-5','Developer launch June 9; availability was interrupted June 12 and later restored.'),
 ('2026-07-09','GPT-5.6','https://help.openai.com/en/articles/9624314-model-release-notes','Developer rollout announcement July 9.'),
 ('2026-07-24','Opus 5','https://www.anthropic.com/claude/opus','Developer announcement listing July 24.'),
 ('2026-09-01','Fable 5.1','https://platform.claude.com/docs/en/models/fable-5-1/overview','Developer release date September 1.'),
 ('2026-09-03','GPT-6 Astra','https://openai.com/index/safety-overview-gpt-6-astra/','Developer launch documentation September 3; broad rollout followed. Not the September 4 OpenRouter listing date.'),
 ('2026-09-22','Opus 5.5','https://www.anthropic.com/claude-opus-5-5','Developer announcement September 22.'),
 ('2026-09-22','GPT-6 Sol','https://openai.com/index/introducing-gpt-6-sol-and-luna/','Developer announcement September 22.'),
 ('2026-09-28','Sonnet 5.5','https://www.anthropic.com/claude-sonnet-5-5','Developer announcement September 28.'),
 ('2026-09-29','GPT-6.1 Sol','https://openai.com/index/devday-2026-recap/','Developer launch at DevDay September 29.'),
 ('2026-10-26','GPT-6.1 Terra','https://help.openai.com/en/articles/9624314-model-release-notes','Developer release notes October 26.')]:event(t+'T00:00:00Z',label,'coding',url,note+' Context only: tools for writing code, not models running in the offline competition notebook; no team adoption inferred.')
D=dict(built=manifest['checkedAt'],series=series,hist3=distribution(b3),events=sorted(events,key=lambda e:e['t']),latest=b3['latest']['fetched'],credit='Tong Hui Kang · arc3.huikang.dev',links=dict(tracker='https://arc3.huikang.dev/leaderboard/',franzen=franzen,kaggle=kaggle))
# Named teams, day by day: each team's public best carried forward, and its place among every
# team on the board that day. Names come from the tracker, or from our board's trails for teams
# that later merged away (Franzen's team left the board after October).
names={str(p[0]):p[1] for p in raw['positions']}
for tid,trail in b3['history']['trails'].items(): names.setdefault(str(tid),trail.get('name'))
hist={tid:sorted((day[:10],float(v[0])) for day,v in h.items()) for tid,h in raw['history'].items() if h}
hdays={tid:[x[0] for x in h] for tid,h in hist.items()}
def on(tid,ds):
    i=bisect.bisect_right(hdays[tid],ds)-1
    return hist[tid][i][1] if i>=0 else None
# Franzen's own team merged into The ARChitects at the end of October, so his line carries on as theirs.
TEAMS=['15486995','15499660','15770880','16384837','15605182','15487093','15629613','15823039']
FRANZEN,ARCHITECTS='16384837','16032816'
assert names[FRANZEN]=='Daniel Franzen' and names['15605182']=='Team Turducken' and names['15770880']=='NVARC3'
merged=hdays[FRANZEN][-1]
def on_team(tid,ds):
    if tid==FRANZEN and ds>merged: return on(ARCHITECTS,ds)
    return on(tid,ds)
def last_day(tid): return hdays[ARCHITECTS][-1] if tid==FRANZEN else hdays[tid][-1]
day=date(2026,4,1); last=max(k for h in raw['history'].values() for k in h)[:10]
D['teams']=[dict(id=t,name='Franzen → The ARChitects' if t==FRANZEN else names[t].replace(' @ Fields Model',''),pts=[]) for t in TEAMS]
D['merge']=dict(day=merged,note='Daniel Franzen joined The ARChitects')
D['doubling']=[];fields={}
while day.isoformat()<=last:
    ds=day.isoformat(); prev=(day-timedelta(days=1)).isoformat()
    field=sorted((v for v in (on(t,ds) for t in hist) if v is not None),reverse=True); fields[ds]=field
    neg=[-x for x in field]
    for team in D['teams']:
        v=on_team(team['id'],ds)
        # Stop a line on the team's last tracker day, so merged-away teams don't run on forever.
        if v is not None and ds<=last_day(team['id']): team['pts'].append([ds,v,bisect.bisect_left(neg,-v)+1])
    # A team "doubled" when its best at least doubled overnight from a score of 0.2 or more,
    # which keeps near-zero noise out of the early months.
    doubled=sum(1 for t in hist if (a:=on(t,prev)) is not None and a>=.2 and (b:=on(t,ds)) is not None and b>=2*a)
    D['doubling'].append([ds,doubled,len(field)])
    day+=timedelta(days=1)
dd={d:n for d,n,_ in D['doubling']}
assert dd['2026-10-01']==279 and dd['2026-10-02']==141
tt={p[0]:p for p in D['teams'][4]['pts']}
assert tt['2026-09-30'][1:]==[18.99,18] and tt['2026-10-02'][1:]==[18.99,491]

# The tables. Each one holds either scores or places, never both, except Table 4, whose whole job
# is to translate a score into the place it earned. A place is always written as #N.
rows_now={str(r[1]):r for r in b3['latest']['rows']}
now_scores=[r[4] for r in b3['latest']['rows']]
def place_in(field,v): return 1+sum(1 for x in field if x>v)
def now(tid):
    r=rows_now[ARCHITECTS if tid==FRANZEN else tid]; return r[4],r[0]
place_days=['2026-09-25','2026-09-30','2026-10-01','2026-10-02','2026-10-15']
places=[]
for t,team in zip(TEAMS,D['teams']):
    row=[]
    for ds in place_days:
        v=on_team(t,ds); row.append(place_in(fields[ds],v) if v is not None and ds<=last_day(t) else None)
    places.append(dict(name=team['name'],v=row+[now(t)[1]]))
places.sort(key=lambda r:r['v'][-1])
score_days=['2026-08-14','2026-08-26','2026-09-15','2026-09-25','2026-09-30','2026-10-02']
S={x['t'][:10]:x for x in series}
scores=[dict(name=team['name'],v=[on_team(t,ds) if ds<=last_day(t) else None for ds in score_days]+[now(t)[0]]) for t,team in zip(TEAMS,D['teams'])]
scores.sort(key=lambda r:-r['v'][-1])
scores+=[dict(name='100th-best score',v=[S[ds]['r100'] for ds in score_days]+[sorted(now_scores,reverse=True)[99]]),dict(name='1,000th-best score',v=[S[ds]['r1000'] for ds in score_days]+[sorted(now_scores,reverse=True)[999]])]
def stretch(label,a,b2):
    w=[(n,tot) for d,n,tot in D['doubling'] if a<=d<=b2]
    n=sum(x for x,_ in w)/len(w); tot=sum(y for _,y in w)/len(w)
    return dict(label=label,a=a,b=b2,teams=round(tot),per_day=n,per_1000=n/tot*1000)
doubling_table=[stretch('After Qwen 3.6, before the Duck','2026-04-22','2026-06-29'),stretch('Duck week','2026-06-30','2026-07-06'),
 stretch('After Qwen 3.8','2026-08-14','2026-08-25'),stretch('After Flash Next, to the deadline','2026-08-26','2026-09-30'),
 stretch('October 1','2026-10-01','2026-10-01'),stretch('October 2','2026-10-02','2026-10-02'),stretch('Rest of October','2026-10-03','2026-10-31')]
worth=[dict(label=lab,v=[place_in(fields['2026-09-30'],v),place_in(fields['2026-10-02'],v),place_in(now_scores,v)]) for v,lab in [(10,'10'),(20,'20'),(27.89,'27.89, Franzen’s notebook'),(40,'40'),(50,'50')]]
D['tables']=dict(places=places,scores=scores,doubling=doubling_table,worth=worth)
NOWLABEL='Now'
D['turduckenScore']=next(r[4] for r in b3['latest']['rows'] if str(r[1])=='15605182')
assert D['turduckenScore']==56.02, 'Refresh the dated captions for the new score.'
# One label per notebook, preserving the census's named/inferred distinction.
census=read('notebook-census.json')
c3=[r for r in census if r['contest'].endswith('-3')]
c2=[r for r in census if r['contest'].endswith('-2')]
unassigned={'Nothing attached','Opaque attachments, no model name','Off-topic work'}
llm=[r for r in c3 if r['lineage'] not in unassigned]
qwen_rows=[r for r in llm if r['lineage'].startswith(('Qwen','Duck'))]
flash=[r for r in c3 if r['lineage']=='Qwen 3.8 Flash Next']
franzen_row=next(r for r in c3 if r['ref']=='dfranzen/arc-agi-3-milestone-2-solution')
same_inputs=[r for r in c3 if r['fingerprint']==franzen_row['fingerprint']]
D['census']=dict(arc3=len(c3),arc2=len(c2),llmAssigned=len(llm),qwen=len(qwen_rows),qwenNamed=sum(r['lineage_evidence']=='named' for r in qwen_rows),flash=len(flash),flashNamed=sum(r['lineage_evidence']=='named' for r in flash),arc2Qwen4b=sum(r['lineage']=='Qwen 3 4B' for r in c2),franzenMatches=len(same_inputs),franzenAuthors=len({r['author'] for r in same_inputs}))
assert D['census']==dict(arc3=300,arc2=150,llmAssigned=139,qwen=129,qwenNamed=75,flash=70,flashNamed=49,arc2Qwen4b=77,franzenMatches=43,franzenAuthors=36)

def f2(v): return '—' if v is None else f'{v:.2f}'
def pl(v): return '—' if v is None else f'#{v:,}'
def md(ds): return datetime.fromisoformat(ds).strftime('%b %-d')
def cls(name): return ' class="us"' if name=='Team Turducken' else (' class="ref"' if name.endswith('-best score') else '')
def table(cap,head,rows):
    return f'<figure class="tbl"><figcaption class="tcap">{cap}</figcaption><div class="tscroll"><table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div></figure>'
NOWH='Now*'
T1=table('<b>Table 1. Places on the board.</b> Places only. #1 is the top.',
 '<th>Team</th>'+''.join(f'<th>{md(d)}</th>' for d in place_days)+f'<th>{NOWH}</th>',
 ''.join(f'<tr{cls(r["name"])}><td>{r["name"]}</td>'+''.join(f'<td>{pl(v)}</td>' for v in r['v'])+'</tr>' for r in places))
T2=table('<b>Table 2. Scores.</b> Scores only, out of 100. Qwen 3.8 came out August 14 and Flash Next on August 26; no new Qwen came after that. The milestone notebooks went public at the end of September 30.',
 '<th>Team</th>'+''.join(f'<th>{md(d)}</th>' for d in score_days)+f'<th>{NOWH}</th>',
 ''.join(f'<tr{cls(r["name"])}><td>{r["name"]}</td>'+''.join(f'<td>{f2(v)}</td>' for v in r['v'])+'</tr>' for r in scores))
T3=table('<b>Table 3. Teams that doubled their score in a day.</b> Average per day over each stretch. Figure 2 shows every day.',
 '<th>Stretch</th><th>Dates</th><th>Teams on the board</th><th>Doubled, per day</th><th>Doubled, per 1,000 teams</th>',
 ''.join(f'<tr><td>{r["label"]}</td><td>{md(r["a"])}'+('' if r['a']==r['b'] else f'–{md(r["b"])}')+f'</td><td>{r["teams"]:,}</td><td>{r["per_day"]:.0f}</td><td>{r["per_1000"]:.1f}</td></tr>' for r in doubling_table))
T4=table('<b>Table 4. The same score, a different place.</b> The place a given score would have earned on the board.',
 f'<th>Score</th><th>Sep 30</th><th>Oct 2</th><th>{NOWH}</th>',
 ''.join(f'<tr><td>{r["label"]}</td>'+''.join(f'<td>{pl(v)}</td>' for v in r['v'])+'</tr>' for r in worth))
html=(ROOT/'article.template.html').read_text().replace('__DATA__',json.dumps(D,separators=(',',':')).replace('<','\\u003c'))
for token,value in [('__T1__',T1),('__T2__',T2),('__T3__',T3),('__T4__',T4),('__NOW__',datetime.fromisoformat(D['latest']).astimezone(timezone.utc).strftime('%H:%M UTC')),('__TEAMS_NOW__',f"{len(b3['latest']['rows']):,}")]:
    assert token in html, token
    html=html.replace(token,value)
# All photo bytes already exist in the public run-record gallery; never modify them.
# The Boss's farm photos, each placed beside the act whose date it shares (dates from his photo library).
for token,name in [('__FLOCK_APR25__','05a-bird-in-hand.webp'),('__FLOCK_JUL01__','12-jul01-young-turkey.webp'),('__FLOCK_OCT01__','13-oct01-squash-patch.webp'),('__FLOCK_OCT24__','14-oct24-door-and-desk.webp'),('__FLOCK_NOV01__','15-nov01-the-boss-and-flock.webp')]:
    photo=REPO/'client/public/specials/img/flock'/name
    assert photo.exists(), f'Missing article photograph: {name}'
    url='data:image/webp;base64,'+base64.b64encode(photo.read_bytes()).decode() if args.portable else '/specials/img/flock/'+name
    html=html.replace(token,url)
assert '__FLOCK_' not in html and '__DATA__' not in html and '__T' not in html
assert all(x not in html for x in ['127.0.0.1','localhost','/team/arc2-runs','WORKING DRAFT','NOT PUBLISHED','Editor’s preview notes'])
datafile=REPO/'client/public/specials/data/duck-season.json'
data_json=json.dumps(D,indent=2)+'\n'
if args.check:
    assert args.output.read_text()==html, 'Generated page differs: run python3.13 scripts/build_duck_season.py'
    assert datafile.read_text()==data_json, 'Generated chart data differs: run python3.13 scripts/build_duck_season.py'
else:
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(html)
    datafile.parent.mkdir(parents=True,exist_ok=True)
    datafile.write_text(data_json)
print(('Checked' if args.check else 'Built'),len(series),'ARC3 daily points,',len(D['teams']),'named teams;',D['latest'],';',len(html.encode()),'bytes')
print('Census:',D['census'])
