#!/usr/bin/env python3
"""
Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Replay unchanged qualified contributed revisions against frozen source QC frames.
KS01 was superseded by a human-requested usability correction; verify its new source hash
and recovery/win suite explicitly instead of attributing the old QC results to new code.
SRP/DRY check: Pass — reuses the existing smoke loader and ARCEngine action protocol.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from smoke_contributed_games import load_game
from arcengine import ActionInput, GameAction, GameState
from check_contributed_recovery import check_ks01

ROOT = Path(__file__).resolve().parents[2]


def digest(grid):
    return hashlib.sha256(np.asarray(grid).tobytes()).hexdigest()


def replay(game_id, recording):
    game = load_game(game_id)()
    frame = game.perform_action(ActionInput(id=GameAction.RESET), raw=True)
    opening = digest(frame.frame[-1])
    transcript = [opening]
    levels = recording['levels'] if 'levels' in recording else [{'actions': recording['actions']}]
    for level in levels:
        for encoded in level['actions']:
            data = {'x': encoded[1], 'y': encoded[2]} if len(encoded) == 3 else {}
            frame = game.perform_action(ActionInput(id=GameAction.from_id(encoded[0]), data=data), raw=True)
            assert frame.game_id == game_id, (game_id, frame.game_id)
            for grid in frame.frame:
                array = np.asarray(grid)
                assert array.shape == (64, 64)
                assert 0 <= array.min() <= array.max() <= 15
                transcript.append(digest(grid))
        if 'level' in level:
            assert frame.levels_completed == level['level'], (game_id, level['level'], frame.levels_completed)
            assert digest(frame.frame[-1]) == level['post_transition_frame_sha256'], (game_id, level['level'], 'frame mismatch')
    assert frame.state.name == recording['expected_state'], (game_id, frame.state)
    if recording['expected_state'] == 'GAME_OVER':
        assert digest(frame.frame[-1]) == recording['terminal_frame_sha256']
        reset = game.perform_action(ActionInput(id=GameAction.RESET), raw=True)
        assert reset.state == GameState.NOT_FINISHED and digest(reset.frame[-1]) == opening
    return transcript


def main():
    release = json.loads((ROOT / 'docs/arc3-contributed-release-20260914.json').read_text(encoding='utf-8'))
    total_frames = 0
    for game_id, record in release['games'].items():
        source = (ROOT / f'server/data/arc3-games/{game_id}.py').read_text(encoding='utf-8')
        if game_id == 'g500':
            revision = json.loads((ROOT / 'docs/arc3-contributed-recovery-20260914.json').read_text())
            assert revision['previous_published_sha256'] == record['published_sha256']
            assert hashlib.sha256(source.encode()).hexdigest() == revision['published_sha256']
            check_ks01()
            continue
        assert hashlib.sha256(source.encode()).hexdigest() == record['published_sha256']
        for outcome, fixture in record['recordings'].items():
            recording = json.loads((ROOT / fixture).read_text(encoding='utf-8'))
            first = replay(game_id, recording)
            second = replay(game_id, recording)
            assert first == second, (game_id, outcome, 'nondeterministic replay')
            total_frames += len(first) + len(second)
        print(f"ok   {record['public_id']} ({game_id}): all 8 levels, recorded loss, reset and frame hashes")
    print(f'ok   {total_frames} frames verified across 12 frozen win/loss replays, plus revised KS01 checks')


if __name__ == '__main__':
    main()
