"""
Author: Codex (GPT-6)
Date: 2026-09-12
PURPOSE: All-level real-engine and counterfactual checks for the square catacomb.
SRP/DRY check: Pass — uses the published module's transitions and routes.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'server/data/arc3-games'))
import g512 as game
from arcengine import ARCBaseGame,ActionInput,GameAction,GameState


def action(token):
    if isinstance(token,tuple):
        return ActionInput(id=GameAction.ACTION6,data={'x':token[1],'y':token[2]})
    return ActionInput(id=GameAction.from_id(token))


def main():
    assert set(game.DELTAS.values())=={(0,-1),(0,1),(-1,0),(1,0)}
    cls=next(c for c in vars(game).values() if isinstance(c,type) and c is not ARCBaseGame and issubclass(c,ARCBaseGame))
    engine=cls();engine.perform_action(ActionInput(id=GameAction.RESET))
    for index,level in enumerate(game.LEVELS):
        assert engine.level_index==index
        pure,left=game.execute(level,level['witness'])
        assert game.solved(level,pure) and left==0
        # Every aperture provides necessary information; omitting it breaks this route.
        for skip in range(len(level['apertures'])):
            changed=level['witness'][:skip]+level['witness'][skip+1:]
            wrong,_=game.execute(level,changed)
            assert not game.solved(level,wrong)
        state=game.start_state(level)
        for click in level['witness'][:len(level['apertures'])]:state=game.transition(level,state,click)
        neighbour=game._move_cell(state.position,4)
        click=(6,*game.cell_center(neighbour))
        assert game.transition(level,state,click).position==state.position
        for cell in level['cells']:
            x,y=game.cell_center(cell)
            assert 3<=x<=60 and 3<=y<=53
        for token in level['witness']:
            result=engine.perform_action(action(token))
            assert len(result.frame)>1
        print('PASS G512 level',index+1)
    assert engine._state==GameState.WIN and engine._score==8
    level=game.LEVELS[2]
    short=level['witness'][:3]+level['witness'][5:]
    assert not game.solved(level,game.execute(level,short)[0])
    assert game.solved(level,game.execute(level,short,game.without_key_gate)[0])
    print('PASS key-gate counterfactual; full game 8/8')


if __name__=='__main__':main()
