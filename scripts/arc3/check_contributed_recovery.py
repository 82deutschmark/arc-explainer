"""Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Play real published engines through the browser recovery helper. Verify KS01's
spatial controls, all eight wins, free exploration, genuine rejection recovery and level
checkpoints across the contributed collection. No fake game or duplicated recovery code.
SRP/DRY check: Pass — imports the exact worker helper and existing published-game loader.
"""
import copy
import importlib.util
import json
import random
import sys
from pathlib import Path

import numpy as np
from smoke_contributed_games import load_game
from arcengine import ActionInput, GameAction, GameState

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('browser_recovery', ROOT / 'client/public/arc3-player-recovery.py')
recovery_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery_module)
Recovery = recovery_module.ContributedRecovery
FIXTURES = ROOT / 'tests/fixtures/arc3-contributed-20260914'


class Session:
    def __init__(self, game_id, enabled=True):
        self.game = load_game(game_id)()
        self.frame = self.game.perform_action(ActionInput(id=GameAction.RESET))
        self.recovery = Recovery(enabled, self.game, self.frame)
        self.undo = []

    def step(self, encoded):
        self.undo.append((copy.deepcopy(self.game), copy.deepcopy(self.frame), 0, 'TEST'))
        if len(self.undo) > 50:
            self.undo.pop(0)
        action = ActionInput(id=GameAction.from_id(encoded[0]), data={
            'x': encoded[1], 'y': encoded[2]} if len(encoded) == 3 else {})
        raw = self.game.perform_action(action)
        self.game, self.frame = self.recovery.after_step(self.game, raw, self.undo, encoded[0])
        if raw.state == GameState.GAME_OVER and self.recovery.enabled:
            assert self.frame.state == GameState.NOT_FINISHED
            assert self.recovery.feedback(self.game)['notice']
            assert len(self.frame.frame) == 1
        return raw

    def retry(self):
        self.game, self.frame = self.recovery.retry(self.undo)
        assert not self.undo and self.frame.state == GameState.NOT_FINISHED


def check_ks01():
    session = Session('g500')
    assert session.game.state[2] == 4
    for a in [4, 4, 7, 7]:
        session.step([a])
        assert session.game.state[2] == 4 and session.frame.state == GameState.NOT_FINISHED
    assert 'no pulse' in session.recovery.feedback(session.game)['notice']
    for action, eye in [(3, 3), (2, 8), (4, 9), (1, 4)]:
        session.step([action])
        assert session.game.state[2] == eye
    # Explore far beyond the former five-move budget, including empty rewinds.
    for _ in range(20):
        for action in [3, 2, 4, 1, 7]:
            session.step([action])
            assert session.frame.state == GameState.NOT_FINISHED
    assert session.recovery.feedback(session.game)['moves_remaining'] is None
    recording = json.loads((FIXTURES / 'g500-recovery-win.json').read_text())
    session.retry()
    for level in recording['levels']:
        for action in level['actions']:
            session.step(action)
        assert session.frame.levels_completed == level['level'], level['level']
        if session.frame.state != GameState.WIN:
            before = np.array(session.frame.frame[-1])
            session.step([4])
            session.retry()
            assert session.frame.levels_completed == level['level']
            assert np.array_equal(session.frame.frame[-1], before)
    assert session.frame.state == GameState.WIN
    # Rules remain solvable directly, independently of the practice wrapper.
    direct = Session('g500', False)
    for level in recording['levels']:
        for action in level['actions']:
            direct.step(action)
        assert direct.frame.levels_completed == level['level']
    assert direct.frame.state == GameState.WIN
    # Sample state-machine exploration in every lesson, including required rewind levels.
    module = sys.modules[direct.game.__class__.__module__]
    rng = random.Random(500)
    for level in module.LEVELS:
        state = module.start_state(level)
        for _ in range(1000):
            state = module.transition(level, state, rng.choice(module.action_tokens(level)))
            assert state[module.TERMINAL_INDEX] != module.LOSS
            if state[module.TERMINAL_INDEX] == module.WIN:
                state = module.start_state(level)
    print('ok KS01: spatial arrows, harmless empty rewind, 100 exploration moves, 8-level wins, checkpoints, 8000 state probes')


def check_recorded_failures():
    for game_id in ['g502', 'g519', 'g542']:
        recording = json.loads((FIXTURES / f'{game_id}-loss.json').read_text())
        session = Session(game_id)
        for action in recording['actions']:
            previous_game = copy.deepcopy(session.game)
            previous_frame = copy.deepcopy(session.frame)
            raw = session.step(action)
            if raw.state == GameState.GAME_OVER:
                assert np.array_equal(session.frame.frame[-1], previous_frame.frame[-1])
                assert session.game.level_index == previous_game.level_index
                # Repeating the same rejected move is still recoverable, without using Undo history.
                depth = len(session.undo)
                again = session.step(action)
                assert again.state == GameState.GAME_OVER and len(session.undo) == depth
        assert session.recovery.recoveries >= 2
        if session.undo:
            session.game, session.frame, _, _ = session.undo.pop()
            session.recovery.after_undo()
            assert session.frame.state == GameState.NOT_FINISHED
            assert session.recovery.notice is None
        session.retry()
        assert session.frame.levels_completed == 0
        strict = Session(game_id, False)
        for action in recording['actions']:
            strict.step(action)
        assert strict.frame.state == GameState.GAME_OVER
        assert strict.recovery.feedback(strict.game) is None
        # Finish a genuine first level, explore the next, and retry without losing progress.
        session = Session(game_id)
        win = json.loads((FIXTURES / f'{game_id}-win.json').read_text())
        for action in win['levels'][0]['actions']:
            session.step(action)
        assert session.frame.levels_completed == 1 and not session.undo
        opening = np.array(session.frame.frame[-1])
        session.step([int(session.frame.available_actions[0])])
        session.retry()
        assert session.frame.levels_completed == 1
        assert np.array_equal(session.frame.frame[-1], opening)
        print(f'ok {game_id}: recorded loss restored twice, strict loss unchanged, next-level retry preserves progress')


def check_collection():
    ids = json.loads((ROOT / 'shared/arc3EvolutionIds.json').read_text())['published_public_ids']
    rng = random.Random(44)
    results = {}
    for game_id in ids:
        session = Session(game_id)
        steps = 0
        for _ in range(150):
            actions = list(session.frame.available_actions)
            if not actions or session.frame.state == GameState.WIN:
                break
            action = int(rng.choice(actions))
            session.step([action, rng.randrange(64), rng.randrange(64)] if action == 6 else [action])
            steps += 1
            assert session.frame.state != GameState.GAME_OVER, game_id
            assert session.recovery.feedback(session.game)['unlimited_retries']
            if session.recovery.recoveries >= 2:
                break
        completed = session.frame.levels_completed
        session.retry()
        assert session.frame.levels_completed == completed, (game_id, completed)
        results[game_id] = {'actions': steps, 'rejections_restored': session.recovery.recoveries - 1}
        print(f'ok {game_id}: {steps} exploratory actions, {results[game_id]["rejections_restored"]} rejected moves recovered', flush=True)
    return results


def main():
    check_ks01()
    check_recorded_failures()
    results = check_collection()
    print(f'ok all {len(results)} contributed games; {sum(r["actions"] for r in results.values())} exploration actions')


if __name__ == '__main__':
    main()
