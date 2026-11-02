#!/usr/bin/env python3.13
"""Author: GPT-6 / Codex
Date: 2026-11-02
PURPOSE: Build the Duck season feature from committed, dated public sources.
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
        result.append(dict(t=ds+'T23:59:00Z',teams=n,top=cut(values,1),gold=cut(values,10+int(n*.002)),silver=cut(values,int(n*.05)),bronze=cut(values,int(n*.1)),r10=cut(values,10),r100=cut(values,100),r500=cut(values,500),source='reconstructed'))
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
        for k in ['r10','r100','r500']:s[k]=idx[s['t'][:10]][k]
for s in series:
    for key in ['top','gold','silver','bronze','r10','r100','r500']:
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
event('2026-09-30T23:59:00Z','Milestone 2 notebooks','notebook',kaggle,'Kaggle deadline: September 30, 23:59 UTC. Mark Barney confirms the simultaneous notebook release firsthand. Franzen’s released submission scored 27.89 and built on the Duck. Daily score observations cannot establish within-day order.')
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
D=dict(built=manifest['checkedAt'],bell='2026-11-02T23:59:00Z',series=series,arc2=daily(b2['history']['snaps']),hist3=distribution(b3),hist2=distribution(b2),events=sorted(events,key=lambda e:e['t']),firstObserved=first,latest=b3['latest']['fetched'],leader=b3['latest']['rows'][0][2],leaderScore=b3['latest']['rows'][0][4],turduckenRank=next(r[0] for r in b3['latest']['rows'] if str(r[1])=='15605182'),qwen4=read('qwen4-search.json'),credit='Tong Hui Kang · arc3.huikang.dev',links=dict(tracker='https://arc3.huikang.dev/leaderboard/',raw='https://tonghuikang--arc3-leaderboard-monitor-get-history.modal.run',franzen=franzen,kaggle=kaggle))
assert len(D['qwen4'])==0, 'Qwen 4 availability changed: update the ending before rebuilding.'
D['turduckenScore']=next(r[4] for r in b3['latest']['rows'] if str(r[1])=='15605182')
assert D['turduckenScore']==56.02, 'Refresh the dated hero caption and team comparison for the new score.'
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
html=(ROOT/'article.template.html').read_text().replace('__DATA__',json.dumps(D,separators=(',',':')).replace('<','\\u003c'))
html=html.replace('__QWEN_CHECK__',datetime.fromisoformat(manifest['checkedAt']).astimezone(timezone.utc).strftime('%H:%M'))
# All photo bytes already exist in the public run-record gallery; never modify them.
for token,name in [('__FLOCK_LEAD__','05a-bird-in-hand.webp'),('__FLOCK_WHITE__','08-white-tom.webp'),('__FLOCK_GROWN__','11-the-flock.webp')]:
    photo=REPO/'client/public/specials/img/flock'/name
    assert photo.exists(), f'Missing article photograph: {name}'
    url='data:image/webp;base64,'+base64.b64encode(photo.read_bytes()).decode() if args.portable else '/specials/img/flock/'+name
    html=html.replace(token,url)
assert '__FLOCK_' not in html and '__DATA__' not in html
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
print(('Checked' if args.check else 'Built'),len(series),'ARC3 daily points;',D['latest'],';',len(html.encode()),'bytes')
print('Census:',D['census'])
