"""
Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Gate the separate research catalog using fixed solutions through the real ARC engine.
The authoring verifier supplies replays only after independent source/dist and mutation checks.
SRP/DRY check: Pass — validates packaged execution; does not reimplement any game rules.
"""
import ast
import importlib.util
import json
from pathlib import Path
import re
import sys
import numpy as np
from arcengine import ActionInput,GameAction,GameState
from strip_authoring_text import strip_authoring_text

ROOT=Path(__file__).resolve().parents[2]
GAMES=ROOT/'server/data/arc3-research-games'


def act(game,a):
    aid,x,y=a
    return game.perform_action(ActionInput(id=GameAction.from_id(aid),data={'x':x,'y':y} if aid==6 else {}))


def main():
    entries=json.loads((GAMES/'manifest.json').read_text(encoding='utf-8'))
    replays=json.loads((GAMES/'replays.json').read_text(encoding='utf-8'))
    failures=json.loads((GAMES/'failure-replays.json').read_text(encoding='utf-8'))
    ids={e['id'] for e in entries}
    assert len(entries)==len(ids)==25,'research catalog must have 25 unique games'
    assert ids==set(replays),'every game must have a replay'
    assert ids==set(failures),'every game must have a failure replay'
    assert ids=={p.stem for p in GAMES.glob('*.py')},'catalog/file mismatch'
    checked=0
    for e in entries:
        gid=e['id'];assert re.fullmatch('[a-z]{2}[0-9]{2}',gid)
        assert e['src_file']==gid+'.py' and e['category']=='research'
        path=GAMES/e['src_file'];text=path.read_text(encoding='utf-8')
        body=text.partition('\n')[2].lstrip('\n')
        assert strip_authoring_text(body)==body,(gid,'packaged prose')
        tree=ast.parse(text)
        assert not any(isinstance(n,ast.Expr) and isinstance(n.value,ast.Constant)
                       and isinstance(n.value.value,str) for n in ast.walk(tree)),(gid,'embedded authoring prose')
        assert not any(isinstance(n,ast.ImportFrom) and n.module=='core' for n in ast.walk(tree)),(gid,'unbundled support')
        spec=importlib.util.spec_from_file_location('research_'+gid,path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        cls=getattr(module,e['class_name'])
        for seed,levels in replays[gid].items():
            assert len(levels)==5
            game=cls(seed=int(seed));frame=act(game,(0,0,0))
            assert len(frame.frame)==1
            for index,actions in enumerate(levels):
                assert actions and game.level_index==index
                for action in actions:
                    frame=act(game,action)
                    assert 1<len(frame.frame)<1000,(gid,'missing/unbounded animation')
                    for raw in frame.frame:
                        f=np.asarray(raw);assert f.shape==(64,64) and f.min()>=0 and f.max()<=15
                assert frame.levels_completed==index+1,(gid,seed,index,'score did not advance')
                checked+=1
            assert frame.state==GameState.WIN
            act(game,(0,0,0));assert game.level_index==0 and game.model.errors==0
        bad=failures[gid];game=cls(seed=bad['seed']);act(game,(0,0,0));game.set_level(bad['level_index'])
        for action in bad['actions']:frame=act(game,action)
        assert frame.state==GameState.GAME_OVER and frame.levels_completed==0,(gid,'invalid failure path')
        reset=act(game,(0,0,0));assert reset.state==GameState.NOT_FINISHED and reset.levels_completed==0
        assert game.level_index==bad['level_index'] and game.model.errors==0
        reset=act(game,(0,0,0));assert game.level_index==0 and reset.full_reset
        print(gid,'PASS',flush=True)
    print(f'{len(entries)} research games, {checked} level replays, correct score/reset/palette/animation')


if __name__=='__main__':main()
