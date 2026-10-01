"""
Author: GPT-6 (Codex)
Date: 2026-09-30
PURPOSE: Execute the stored public winning action sequences against their exact local game
         builds, saving actual before/action/after transitions for reasoning reconstruction.
         Reuses render_public_demo_levels for loading. Agent shorthand is deliberately
         excluded; only recorded moves, provenance and fresh engine observations are read.
SRP/DRY check: Pass — engine execution and evidence export only; no synthetic prose or
         game mechanics are reimplemented. Requires the installed arcengine and Pillow.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import re
from collections import defaultdict
from importlib.metadata import version
from pathlib import Path

from arcengine import ActionInput, GameAction
from render_public_demo_levels import ENV_FILES, GAME_HASHES, REPO, load_game_class


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    source = REPO / 'data/arc3-agent-runs/75d9c8e7-ade9-4a8f-a747-6acbea51bb1b.levels.jsonl'
    out = REPO / 'data/arc3-human-reasoning/evidence'
    out.mkdir(parents=True, exist_ok=True)
    games: dict[str, list[dict]] = defaultdict(list)
    for line in source.read_text().splitlines():
        row = json.loads(line)
        games[row['gameId']].append(row)
    results = []
    for game_id, levels in sorted(games.items()):
        levels.sort(key=lambda row: row['level'])
        if game_id == 'as66' or any(row['build'] != GAME_HASHES[game_id] for row in levels):
            raise ValueError(f'Unsupported game or build: {game_id}')
        game_path = ENV_FILES / game_id / GAME_HASHES[game_id] / f'{game_id}.py'
        game = load_game_class(game_path)()
        frame = game.perform_action(ActionInput(id=GameAction.RESET))
        last_grid = frame.frame[-1]
        checks = []
        evidence_path = out / f'{game_id}.transitions.jsonl.gz'
        # Fixed gzip timestamp makes independently regenerated evidence comparable.
        with evidence_path.open('wb') as raw:
            with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as stream:
                for level in levels:
                    moves = [move for step in level['steps'] for move in step['moves']]
                    if frame.levels_completed != level['level'] - 1:
                        raise ValueError(f'Wrong starting level: {game_id} {level["level"]}')
                    for index, move in enumerate(moves):
                        match = re.fullmatch(r'(RESET|ACTION[1-7])(?:\((\d+),(\d+)\))?', move)
                        if not match:
                            raise ValueError(f'Unrecognized move: {move}')
                        name, x, y = match.groups()
                        data = {'x': int(x), 'y': int(y)} if x is not None else {}
                        before_completed = frame.levels_completed
                        frame = game.perform_action(ActionInput(id=GameAction[name], data=data))
                        if not frame.frame:
                            raise ValueError(f'No transition: {game_id} {level["level"]} {index}')
                        record = {
                            'id': f'{game_id}:L{level["level"]}:A{index + 1}',
                            'gameId': game_id, 'build': level['build'], 'level': level['level'],
                            'actionIndex': index + 1, 'recordedRunGuid': level['guid'],
                            'before': last_grid, 'action': {'id': name, 'data': data},
                            'after': frame.frame[-1], 'state': frame.state.value,
                            'levelsCompletedBefore': before_completed,
                            'levelsCompletedAfter': frame.levels_completed,
                            'levelCleared': frame.levels_completed > before_completed,
                            'verification': 'executed_local_engine',
                        }
                        stream.write((json.dumps(record, separators=(',', ':')) + '\n').encode())
                        last_grid = frame.frame[-1]
                    cleared = frame.levels_completed == level['level']
                    checks.append({'level': level['level'], 'actions': len(moves), 'cleared': cleared})
                    if not cleared:
                        raise ValueError(f'Replay did not clear: {game_id} {level["level"]}')
        result = {
            'gameId': game_id, 'build': levels[0]['build'], 'runGuid': levels[0]['guid'],
            'gameCodeSha256': digest(game_path), 'levels': checks,
            'finalState': frame.state.value, 'transitionsFile': evidence_path.name,
            'transitionsSha256': digest(evidence_path),
        }
        if frame.state.value != 'WIN':
            raise ValueError(f'Replay did not win: {game_id}')
        results.append(result)
        print(f'{game_id}: {len(checks)} levels cleared, {sum(c["actions"] for c in checks)} actions, WIN', flush=True)
    report = {
        'schema': 'arc-explainer/arc3-replay-evidence/v1',
        'arcengineVersion': version('arcengine'), 'actionSource': str(source.relative_to(REPO)),
        'actionSourceSha256': digest(source),
        'agentTextIncluded': False, 'games': results,
    }
    (out / 'replay-verification.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
