/*
 * Author: GPT-6 (Codex)
 * Date: 2026-09-30
 * PURPOSE: Package complete human-inspired ARC-3 trajectories, chronological training
 *          decisions, screenshots and real engine transitions into a committed release.
 *          Validates source hashes, replay chains and the published game write-ups.
 * SRP/DRY check: Pass — packaging only; source registry, prose construction and engine
 *          execution are delegated to their existing focused modules.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { buildArc3GameDatasetBundle } from '../../server/services/arc3/arc3GameDataset';
import { buildArc3GameMechanicsDoc } from '../../server/services/arc3/arc3GameMechanicsDoc';
import { buildHumanReasoningDataset, renderTraceCollection, sha256, type ReasoningTrace, type ReplayVerification } from './human_reasoning_dataset';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = join(root, 'data/arc3-human-reasoning');
const { values } = parseArgs({ options: { out: { type: 'string' } }, strict: true });
const output = resolve(values.out ?? join(base, 'release'));
const annotationText = await readFile(join(base, 'annotations.json'), 'utf8');
const annotationFile = JSON.parse(annotationText) as { schema: string; traces: ReasoningTrace[] };
if (annotationFile.schema !== 'arc-explainer/arc3-human-reasoning-annotations/v2') throw new Error('Unsupported annotations.');
const replayText = await readFile(join(base, 'evidence/replay-verification.json'), 'utf8');
const replay = JSON.parse(replayText) as ReplayVerification;
const sourceUrl = 'https://arc3.markbarney.net/arc3/games.md';
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
const published = await response.text();
if (published !== buildArc3GameMechanicsDoc()) throw new Error('Published source differs from local registry.');

const bundle = buildArc3GameDatasetBundle();
const dataset = buildHumanReasoningDataset(bundle, annotationFile.traces, replay);
const artifacts = new Map<string, Buffer>();
const add = (name: string, content: string | Buffer) => artifacts.set(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
const jsonl = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
const train = dataset.episodes.filter((row) => row.split === 'train');
const validation = dataset.episodes.filter((row) => row.split === 'validation');
add('sources.jsonl', jsonl(dataset.sources));
add('train.jsonl', jsonl(train));
add('validation.jsonl', jsonl(validation));
add('decisions-train.jsonl', jsonl(dataset.decisions.filter((row) => row.split === 'train')));
add('decisions-validation.jsonl', jsonl(dataset.decisions.filter((row) => row.split === 'validation')));
add('TRACE_WRITEUP.md', renderTraceCollection(dataset));
const card = await readFile(join(base, 'README.md'), 'utf8');
add('DATASET_CARD.md', card.replaceAll('](release/)', '](./)').replaceAll('](release/', ']('));
add('evidence/replay-verification.json', replayText);

let transitions = 0;
let clears = 0;
for (const game of replay.games) {
  const bytes = await readFile(join(base, 'evidence', game.transitionsFile));
  if (sha256(bytes) !== game.transitionsSha256) throw new Error(`Replay checksum: ${game.gameId}`);
  const code = await readFile(join(root, 'external/ARCEngine/environment_files', game.gameId, game.build, `${game.gameId}.py`));
  if (sha256(code) !== game.gameCodeSha256) throw new Error(`Game code changed: ${game.gameId}`);
  const rows = gunzipSync(bytes).toString('utf8').trim().split('\n').map((line) => JSON.parse(line));
  let previous: (typeof rows)[number] | undefined;
  const counts = new Map<number, number>();
  const validGrid = (grid: unknown): boolean => Array.isArray(grid) && grid.length === 64 && grid.every((line) =>
    Array.isArray(line) && line.length === 64 && line.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 15));
  for (const row of rows) {
    const index = (counts.get(row.level) ?? 0) + 1;
    if (row.gameId !== game.gameId || row.build !== game.build ||
        row.id !== `${game.gameId}:L${row.level}:A${index}` || row.actionIndex !== index ||
        !validGrid(row.before) || !validGrid(row.after) || row.verification !== 'executed_local_engine') {
      throw new Error(`Invalid transition: ${row.id}`);
    }
    if (previous && JSON.stringify(previous.after) !== JSON.stringify(row.before)) throw new Error(`Broken replay chain: ${row.id}`);
    if (row.levelCleared !== (row.levelsCompletedAfter > row.levelsCompletedBefore)) throw new Error(`Invalid clear: ${row.id}`);
    if (row.levelCleared) clears++;
    counts.set(row.level, index);
    previous = row;
  }
  for (const level of game.levels) if (counts.get(level.level) !== level.actions) throw new Error(`Replay action count: ${game.gameId}`);
  if (previous?.state !== 'WIN') throw new Error(`Replay does not end in WIN: ${game.gameId}`);
  transitions += rows.length;
  add(`evidence/${game.transitionsFile}`, bytes);
}
for (const episode of dataset.episodes) {
  for (const image of episode.evidence.images) {
    if (!artifacts.has(image.localPath)) add(image.localPath, await readFile(join(root, 'client/public', new URL(image.url).pathname)));
  }
}
const report = {
  schema: 'arc-explainer/arc3-human-reasoning-validation/v2',
  sourceObservations: dataset.sources.length,
  completeTrajectories: dataset.episodes.length,
  games: new Set(dataset.episodes.map((row) => row.gameId)).size,
  trainTrajectories: train.length, validationTrajectories: validation.length,
  trainDecisions: dataset.decisions.filter((row) => row.split === 'train').length,
  validationDecisions: dataset.decisions.filter((row) => row.split === 'validation').length,
  replayGames: replay.games.length, replayLevelsCleared: clears, executedTransitions: transitions,
  images: [...artifacts.keys()].filter((name) => name.startsWith('assets/')).length,
  trainGames: [...new Set(train.map((row) => row.gameId))].sort(),
  validationGames: [...new Set(validation.map((row) => row.gameId))].sort(),
  checks: {
    allSourceNotesReconstructed: dataset.episodes.length === dataset.sources.length,
    publishedMarkdownMatchesLocal: true, sourceAndCodeHashesVerified: true,
    replayChainsVerified: true, replayFrames64x64: true,
    allGamesWonByReplayedDemonstrations: true,
    outcomeAppearsAfterInitialDecision: true,
    narrativeActionsAlignedToExactHumanFrames: false,
    agentShorthandIncludedInTraining: false,
  },
};
add('validation-report.json', JSON.stringify(report, null, 2) + '\n');
for (const [name, bytes] of artifacts) if (name.endsWith('.jsonl')) bytes.toString('utf8').trim().split('\n').forEach((line) => JSON.parse(line));
const manifest = {
  schema: 'arc-explainer/arc3-human-reasoning-manifest/v2',
  generatedAt: new Date().toISOString(), sourceUrl, sourceMarkdownSha256: sha256(published),
  registrySnapshotSha256: sha256(JSON.stringify(bundle.games)), annotationSha256: sha256(annotationText),
  sourceGitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  generatorSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  builderSha256: sha256(await readFile(join(root, 'scripts/arc3/human_reasoning_dataset.ts'))),
  replayVerifierSha256: sha256(await readFile(join(root, 'scripts/arc3/verify_reasoning_replays.py'))),
  files: Object.fromEntries([...artifacts].map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: bytes.length }])),
};
await mkdir(output, { recursive: true });
for (const [name, bytes] of artifacts) {
  await mkdir(dirname(join(output, name)), { recursive: true });
  await writeFile(join(output, name), bytes);
}
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, ...report }, null, 2));
