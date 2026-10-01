/*
Author: GPT-6 / Codex
Date: 2026-09-30
PURPOSE: Execute every local catalog's real served payload with Python and exercise the
affected Arena games with the installed ARCEngine. Detect invalid future-import placement,
missing support modules and regressions in initial rendering, actions and reset.
SRP/DRY check: Pass -- uses the production catalog and real game files/engine; no bundler copy.
*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Arc3MirrorCatalog, AUTHORED_DIR, RESEARCH_DIR, HOLDOUT_DIR, sourceVersionOf } from '../server/services/arc3Mirror/Arc3MirrorCatalog';

test('every local served payload executes and Arena glow-ups render, move and reset', async () => {
  const entries = (await Promise.all([AUTHORED_DIR, RESEARCH_DIR, HOLDOUT_DIR].map(async (directory) => {
    const manifest: { id: string; src_file: string }[] = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
    return manifest.map((entry) => ({ ...entry, directory }));
  }))).flat();
  const sources = [];
  for (const entry of entries) {
    const served = await Arc3MirrorCatalog.getSource(entry.id);
    assert.ok(served, entry.id);
    assert.equal(served.sourceVersion, sourceVersionOf(served.sourceCode));
    const original = await readFile(path.join(entry.directory, entry.src_file), 'utf8');
    // Existing direct-source games must not acquire a wrapper or a new content version.
    if (!served.sourceCode.includes('# --- support modules inlined by arc3Mirror:')) {
      assert.equal(served.sourceCode, original);
    }
    sources.push({ ...served, originalSource: original });
  }

  const result = spawnSync(process.env.ARC3_PYTHON ?? 'python3', ['-c', String.raw`
import copy, json, sys
import numpy as np
from arcengine import ActionInput, GameAction

games = json.load(sys.stdin)
exercised = []
for entry in games:
    gid = entry['gameId']
    namespace = {'__name__': '__main__', '__file__': '/virtual/game.py'}
    # An empty game namespace and no game-directory sys.path match the worker contract.
    exec(compile(entry['sourceCode'], gid + '-served.py', 'exec', dont_inherit=True), namespace)
    cls = namespace[entry['className']]
    assert callable(cls), gid
    if gid not in ['g304', 'g305', 'g306', 'g309', 'g007', 'g001']:
        continue
    game = cls()
    initial = game.perform_action(ActionInput(id=GameAction.RESET))
    reference_namespace = {'__name__': '__main__', '__file__': '/virtual/game.py'}
    exec(compile(entry['originalSource'], gid + '.py', 'exec', dont_inherit=True), reference_namespace)
    reference = reference_namespace[entry['className']]()
    expected_initial = reference.perform_action(ActionInput(id=GameAction.RESET))
    board = np.asarray(initial.frame[-1])
    assert board.shape == (64, 64), (gid, board.shape)
    assert board.min() >= 0 and board.max() <= 15, gid
    assert np.array_equal(board, np.asarray(expected_initial.frame[-1])), (gid, 'opening')
    changed = False
    for aid in initial.available_actions:
        # Test each accepted opening action independently, as the worker's probe does.
        clone = copy.deepcopy(game)
        control = copy.deepcopy(reference)
        moved = clone.perform_action(ActionInput(id=GameAction.from_id(aid), data={'x': 32, 'y': 32}))
        expected_move = control.perform_action(ActionInput(id=GameAction.from_id(aid), data={'x': 32, 'y': 32}))
        assert np.array_equal(np.asarray(moved.frame[-1]), np.asarray(expected_move.frame[-1])), (gid, 'action', aid)
        changed |= not np.array_equal(board, np.asarray(moved.frame[-1]))
        reset = clone.perform_action(ActionInput(id=GameAction.RESET))
        expected_reset = control.perform_action(ActionInput(id=GameAction.RESET))
        # Some games retain an animation beat on reset; compare to the authored behavior.
        assert np.array_equal(np.asarray(expected_reset.frame[-1]), np.asarray(reset.frame[-1])), (gid, 'reset', aid)
        assert reset.state == expected_reset.state and clone.level_index == control.level_index, gid
    assert changed, (gid, 'no opening action visibly responded')
    exercised.append(gid)
assert set(exercised) == {'g304', 'g305', 'g306', 'g309', 'g007', 'g001'}, exercised
print(json.dumps({'executed': len(games), 'renderedMovedReset': exercised}))
`], {
    input: JSON.stringify(sources), encoding: 'utf8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  console.log(result.stdout.trim());
});
