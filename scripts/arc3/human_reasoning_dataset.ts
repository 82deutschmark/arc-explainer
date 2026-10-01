/*
 * Author: GPT-6 (Codex)
 * Date: 2026-09-30
 * PURPOSE: Build complete synthetic play trajectories from all of Mark Barney's ARC-3
 *          observations, reviewed reconstructions, screenshots and engine replay evidence.
 *          Produces chronological training conversations without leaking outcomes before
 *          decisions. Source accounts and synthetic reconstruction remain distinguishable.
 * SRP/DRY check: Pass — pure dataset construction; canonical game metadata comes from
 *          arc3GameDataset and actual replay execution from verify_reasoning_replays.py.
 */

import { createHash } from 'node:crypto';
import type { Arc3GameDatasetBundle, Arc3DatasetObservation } from '../../server/services/arc3/arc3GameDataset';

export interface ReasoningTrace {
  sourceId: string;
  sourceSha256: string;
  gameId: string;
  sourceLevel: number | null;
  scenarioLevel: number;
  observation: string;
  hypothesis: string;
  action: string;
  expected: string;
  outcome: string;
  revision: string;
  nextAction: string;
  outcomeBasis: 'human_report' | 'mechanics_reconstruction';
  authorship: string;
}

export interface ReplayVerification {
  schema: string;
  arcengineVersion: string;
  actionSource: string;
  actionSourceSha256: string;
  agentTextIncluded: boolean;
  games: {
    gameId: string;
    build: string;
    runGuid: string;
    gameCodeSha256: string;
    levels: { level: number; actions: number; cleared: boolean }[];
    finalState: string;
    transitionsFile: string;
    transitionsSha256: string;
  }[];
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function evidenceHash(level: number | null, note: Arc3DatasetObservation): string {
  return sha256(JSON.stringify({ level, ...note }));
}

export function gameSplit(gameId: string): 'train' | 'validation' {
  return parseInt(sha256(`arc3-human-reasoning-v1:${gameId}`).slice(0, 8), 16) % 5 === 0
    ? 'validation' : 'train';
}

export const TRACE_FIELDS = ['observation', 'hypothesis', 'action', 'expected', 'outcome', 'revision', 'nextAction'] as const;

export function buildHumanReasoningDataset(
  bundle: Arc3GameDatasetBundle,
  traces: ReasoningTrace[],
  replay: ReplayVerification,
) {
  if (bundle.games.some((game) => game.gameId === 'as66')) throw new Error('as66 must never enter training.');
  if (replay.schema !== 'arc-explainer/arc3-replay-evidence/v1' || replay.agentTextIncluded) {
    throw new Error('Replay evidence must contain executed actions without agent text.');
  }
  const sources = bundle.games.flatMap((game) => [
    ...game.observationsAnyLevel.map((evidence) => ({ level: null, evidence })),
    ...game.levels.flatMap((level) => level.observations.map((evidence) => ({ level: level.level, evidence }))),
  ].map(({ level, evidence }) => {
    const sourceSha256 = evidenceHash(level, evidence);
    return {
      id: `${game.gameId}:${sourceSha256.slice(0, 16)}`,
      gameId: game.gameId, level, sourceSha256, evidence,
      sourceUrl: `https://arc3.markbarney.net/arc3/games/${game.gameId}`,
      registryFile: `shared/arc3Games/${game.gameId}.ts`,
      representation: 'curated_human_play_account',
    };
  }));
  const seen = new Set<string>();
  const episodes = traces.map((trace) => {
    const source = sources.find((row) => row.id === trace.sourceId);
    if (!source || source.gameId !== trace.gameId || source.level !== trace.sourceLevel) {
      throw new Error(`Unresolved source: ${trace.sourceId}`);
    }
    if (source.sourceSha256 !== trace.sourceSha256) throw new Error(`Source changed: ${trace.sourceId}`);
    if (seen.has(source.id)) throw new Error(`Duplicate trace: ${source.id}`);
    seen.add(source.id);
    if (!TRACE_FIELDS.every((key) => typeof trace[key] === 'string' && trace[key].trim().length > 0)) {
      throw new Error(`Incomplete trace: ${source.id}`);
    }
    const game = bundle.games.find((row) => row.gameId === source.gameId)!;
    const level = game.levels.find((row) => row.level === trace.scenarioLevel);
    const verified = replay.games.find((row) => row.gameId === game.gameId);
    const verifiedLevel = verified?.levels.find((row) => row.level === trace.scenarioLevel);
    if (!level || !verified || verified.build !== game.build || verified.finalState !== 'WIN' || !verifiedLevel?.cleared) {
      throw new Error(`Missing verified current-build level: ${source.id}`);
    }
    const images = level.images.map((image) => ({
      ...image,
      localPath: `assets${new URL(image.url).pathname}`,
      relation: image.kind === 'human' ? 'human_capture_of_this_level_not_action_aligned' : 'opening_state_of_reconstruction_level',
    }));
    const initial = [
      `Game: ${game.informalName ?? game.officialTitle} (${game.gameId}), level ${level.level}.`,
      `Situation: ${trace.observation}`,
      `Available inputs: ${game.controls.map((control) => control.action).join(', ')}, RESET.`,
      'Explain your working hypothesis, what to try, and what you expect before seeing the result.',
    ].join('\n\n');
    const decision = `Hypothesis: ${trace.hypothesis}\nAction: ${trace.action}\nExpected: ${trace.expected}`;
    const update = `Updated understanding: ${trace.revision}\nNext move: ${trace.nextAction}`;
    // The outcome enters only after the first assistant decision. Privileged provenance
    // and rule references never enter that first policy input.
    const messages = [
      { role: 'system', content: 'You are playing an unfamiliar interactive puzzle. Explain your decisions clearly, test useful hypotheses, and update your understanding from the observed result.' },
      { role: 'user', content: initial },
      { role: 'assistant', content: decision },
      { role: 'user', content: `Result: ${trace.outcome}\nWhat have you learned, and what should you do next?` },
      { role: 'assistant', content: update },
    ];
    return {
      schema: 'arc-explainer/arc3-human-reasoning/v2',
      id: source.id, gameId: game.gameId, gameName: game.informalName ?? game.officialTitle,
      build: game.build, sourceLevel: source.level, scenarioLevel: level.level,
      split: gameSplit(game.gameId),
      trace: Object.fromEntries(TRACE_FIELDS.map((key) => [key, trace[key]])),
      messages,
      provenance: {
        sourceId: source.id, sourceSha256: source.sourceSha256, sourceUrl: source.sourceUrl,
        sourceCredit: 'Mark Barney / ARC Explainer',
        synthesisCredit: trace.authorship,
        kind: 'complete_synthetic_reconstruction',
        actionOrigin: source.evidence.did ? 'expanded_from_recorded_action' : 'inferred_from_game_evidence',
        expectationOrigin: source.evidence.expected ? 'expanded_from_recorded_expectation' : 'inferred_from_game_evidence',
        outcomeBasis: trace.outcomeBasis,
        exactHumanActionAlignment: false,
        scenarioLevelAssignment: source.level === null ? 'selected_worked_example_for_game_wide_note' : 'recorded_level',
      },
      evidence: {
        images,
        rules: game.levels.filter((row) => row.level <= level.level).flatMap((row) => row.newRules.map((rule) => ({ introducedOnLevel: row.level, ...rule }))),
        verifiedDemonstration: {
          relation: 'independent_winning_demonstration_of_same_game_and_level',
          runGuid: verified.runGuid, gameCodeSha256: verified.gameCodeSha256,
          file: `evidence/${verified.transitionsFile}`,
          filter: { gameId: game.gameId, level: level.level },
          actions: verifiedLevel.actions, levelCleared: true,
          firstTransitionId: `${game.gameId}:L${level.level}:A1`,
          lastTransitionId: `${game.gameId}:L${level.level}:A${verifiedLevel.actions}`,
        },
      },
    };
  });
  if (seen.size !== sources.length) throw new Error('Every source observation needs one complete reconstruction.');
  if (new Set(sources.map((row) => row.id)).size !== sources.length) throw new Error('Duplicate source observations.');

  // Two trainable decisions per complete trajectory. The second is conditioned on the
  // first decision and its result; all variants inherit the parent game's partition.
  const decisions = episodes.flatMap((episode) => [2, 4].map((targetIndex) => ({
    schema: 'arc-explainer/arc3-reasoning-decision/v2',
    id: `${episode.id}:${targetIndex === 2 ? 'act' : 'update'}`,
    episodeId: episode.id, gameId: episode.gameId, split: episode.split,
    prompt: episode.messages.slice(0, targetIndex),
    response: episode.messages[targetIndex].content,
    stage: targetIndex === 2 ? 'before_outcome' : 'after_outcome',
    synthetic: true,
  })));
  return { sources, episodes, decisions };
}

export function renderTraceCollection(dataset: ReturnType<typeof buildHumanReasoningDataset>): string {
  const lines = [
    '# Mark Barney’s ARC-3 reasoning traces',
    '',
    '66 complete synthetic reconstructions across 25 games. Prepared by GPT-6 (Codex), 30 September 2026.',
    '',
    'These traces expand Mark’s accounts using screenshots and game mechanics. Missing actions and expectations are reconstructed. Each entry links an independently replayed winning demonstration of the same level; that demonstration is not claimed to be Mark’s exact action sequence.',
    '',
  ];
  let lastGame = '';
  const labels = ['Situation', 'Working hypothesis', 'Action', 'Expected result', 'Result', 'Revised understanding', 'Next move'];
  for (const episode of dataset.episodes) {
    if (episode.gameId !== lastGame) {
      lines.push(`## ${episode.gameName} (${episode.gameId})`, '', `[Game write-up](${episode.provenance.sourceUrl})`, '');
      lastGame = episode.gameId;
    }
    lines.push(`### Level ${episode.scenarioLevel} — ${episode.id}`, '');
    const original = dataset.sources.find((row) => row.id === episode.id)!;
    lines.push(`**Source note:** ${original.evidence.saw} ${original.evidence.happened}`, '');
    const image = episode.evidence.images.find((row) => row.kind === 'human') ?? episode.evidence.images[0];
    if (image) lines.push(`![${image.caption ?? `${episode.gameId} level ${episode.scenarioLevel} opening frame`}](${image.localPath})`, '');
    TRACE_FIELDS.forEach((key, index) => lines.push(`**${labels[index]}.** ${episode.trace[key]}`, ''));
    lines.push(`**Reconstruction:** action ${episode.provenance.actionOrigin}; expectation ${episode.provenance.expectationOrigin}; result ${episode.provenance.outcomeBasis}.`, '');
    lines.push(`**Executable example:** [verified replay transitions](${episode.evidence.verifiedDemonstration.file}), level ${episode.scenarioLevel}, ${episode.evidence.verifiedDemonstration.actions} actions. Filter by the level field; the final transition records the clear.`, '');
  }
  return lines.join('\n');
}
