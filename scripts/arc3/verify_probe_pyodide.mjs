/*
Author: Claude Opus 5
Date: 07-September-2026
PURPOSE: Run click-to-move under the contract the player's browser actually imposes: real
         Pyodide 0.27.4, the real arcengine wheel fetched and extracted at runtime, and the
         REAL client/public/pyodide-game-worker.js -- not a re-implementation of it. The
         worker file is evaluated as-is (importScripts stubbed to the npm build of Pyodide,
         `self` stubbed to a message sink) and its own handleLoadGame / handleStep /
         handleProbeMove are the functions under test.

         Every server-side check can pass while the site is broken. That has happened twice
         on this page: micropip vs the wheel fetch, and GameAction(int) vs GameAction
         .from_id(), both invisible outside a browser. This closes that gap for the probe.

         It replays the fixture emitted by verify_probe_move.py --fixture: the same walk,
         the same clicked cells, the same expected action ids. CPython and WASM must agree.

         Run: mkdir /tmp/pyodide-check && cd /tmp/pyodide-check && npm i pyodide@0.27.4
              PYODIDE_MODULE=/tmp/pyodide-check/node_modules/pyodide/pyodide.mjs \
                node scripts/arc3/verify_probe_pyodide.mjs /tmp/arc3fixture
         Needs network access to PyPI for the arcengine wheel, exactly as the browser does.

SRP/DRY check: Pass -- verification only, and it re-implements nothing: the algorithm is
         read out of the shipped worker by evaluating that file.
*/

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Resolved at runtime rather than imported by bare name, and NOT added to package.json:
// this is a one-off verification dependency (~30MB of WASM) that no build, test or deploy
// path needs. PYODIDE_MODULE points at an install made anywhere -- `npm i pyodide@0.27.4`
// in a scratch directory -- so the repo does not carry it.
const pyodideSpec = process.env.PYODIDE_MODULE || 'pyodide';
const { loadPyodide } = await import(pyodideSpec);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.resolve(HERE, '../../client/public/pyodide-game-worker.js');
const fixtureDir = process.argv[2];
if (!fixtureDir) {
  console.error('usage: node verify_probe_pyodide.mjs <fixtureDir>');
  process.exit(2);
}

/** The shipped worker, executed. importScripts is what makes it a Worker file and is the
 *  only thing swapped: the npm Pyodide build provides the same loadPyodide the CDN does. */
async function loadWorker() {
  const src = await readFile(WORKER, 'utf-8');
  const body = src.replace(/^importScripts\(.*$/m, '// importScripts stubbed by the harness');
  const messages = [];
  const selfStub = { postMessage: (m) => messages.push(m) };
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'self', 'loadPyodide', 'fetch',
    `${body}\nreturn { handleInit, handleLoadGame, handleStep, handleProbeMove, messages: arguments[3] };`,
  );
  return { api: factory(selfStub, loadPyodide, globalThis.fetch, messages), messages };
}

const fixture = JSON.parse(await readFile(path.join(fixtureDir, 'fixture.json'), 'utf-8'));
const { api } = await loadWorker();

process.stdout.write('booting pyodide + arcengine (real wheel fetch)... ');
await api.handleInit(0);
console.log('ready');

const rows = [];
for (const game of fixture) {
  const source = await readFile(path.join(fixtureDir, `${game.game}.py`), 'utf-8');
  const row = { game: game.game, agree: 0, disagree: 0, mismatches: [], clean: true, ms: [], error: null };
  try {
    // Each game is probed from its own fresh load, replaying the fixture's walk. A walk is
    // replayed in full per probe rather than incrementally, because handleStep pushes the
    // undo stack and the fixture records absolute prefixes.
    for (const probe of game.probes) {
      await api.handleLoadGame(0, source, game.className);
      for (const step of probe.afterSteps) {
        if (step[0] === 'dir') await api.handleStep(0, `ACTION${step[1]}`, null);
        else await api.handleStep(0, 'ACTION6', { x: step[1], y: step[2] });
      }
      const t0 = performance.now();
      const res = await api.handleProbeMove(0, probe.x, probe.y, game.candidates);
      row.ms.push(performance.now() - t0);
      if (res.clean === false) row.clean = false;
      if (res.action === probe.expect) row.agree += 1;
      else {
        row.disagree += 1;
        if (row.mismatches.length < 5) {
          row.mismatches.push({ at: [probe.x, probe.y], expect: probe.expect, got: res.action, why: res.reason });
        }
      }
    }
    // A click nothing moves must still do nothing here.
    await api.handleLoadGame(0, source, game.className);
    row.rejectsFarClick = (await api.handleProbeMove(0, -9999, -9999, game.candidates)).action === null;
  } catch (err) {
    row.error = `${err?.name}: ${err?.message}`;
  }
  row.msPerProbe = row.ms.length ? Math.round((row.ms.reduce((a, b) => a + b, 0) / row.ms.length) * 10) / 10 : null;
  row.msWorst = row.ms.length ? Math.round(Math.max(...row.ms) * 10) / 10 : null;
  delete row.ms;
  rows.push(row);
  console.log(
    `${row.game.padEnd(6)} agree ${String(row.agree).padStart(3)}/${String(row.agree + row.disagree).padEnd(3)} ` +
    `no-op-click ${String(row.rejectsFarClick).padEnd(5)} clean ${String(row.clean).padEnd(5)} ` +
    `ms/probe ${String(row.msPerProbe).padStart(6)} worst ${String(row.msWorst).padStart(6)}` +
    (row.error ? `  ERROR ${row.error}` : '') +
    (row.mismatches.length ? `  MISMATCH ${JSON.stringify(row.mismatches)}` : ''),
  );
}

const bad = rows.filter((r) => r.error || r.disagree || !r.clean || r.rejectsFarClick !== true);
console.log(`\n${rows.length - bad.length}/${rows.length} games agree with the CPython run under real Pyodide.`);
process.exit(bad.length ? 1 : 0);
