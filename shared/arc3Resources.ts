/**
 * Author: Codex
 * Date: 2026-10-10 (Claude Sonnet 5.5: adds Felix's synthetic games and NVIDIA DreamTeam)
 * PURPOSE: Share the reviewed ARC-3 training-data and synthetic-game resource attribution across the hub,
 *          synthetic-game catalog and ARC-3 reference page. Source: repository README.
 * SRP/DRY check: Pass — one description and destination for each featured resource.
 */
export const SIMON_ARC3_TRAINING_DATA = {
  title: 'Simon Ouellette — ARC-AGI-3 Training Data',
  url: 'https://github.com/SimonOuellette35/ARC-AGI-3-Training-Data',
  desc: 'ARC-AGI-3-style games, solvers and training-demonstration generators. Brings augmented public games, original games, PuzzleScript and other environments into a common 64×64 observation format. Python tools and source code on GitHub.',
} as const;

export const FELIX_ARC3_SYNTHETIC_GAMES = {
  title: 'Felix561 — ARC3 Synthetic Games & Agent Trajectories',
  url: 'https://github.com/Felix561/arc3-synthetic-games',
  desc: 'Fifty abstract ARC-3-compatible games, seven levels each, with a browser player and a recorded AI solution for every game. The recordings were made by agents that could read the game code, so they show solutions rather than rule discovery. MIT licensed. Independent, not official ARC Prize games.',
} as const;

export const NVIDIA_DREAMTEAM = {
  title: 'NVIDIA DreamTeam — ARC-AGI-3 solver and game creator',
  url: 'https://github.com/NVIDIA/dream-team/tree/main/arc_agi_3',
  desc: 'A multi-agent solver for interactive ARC-AGI-3 environments, with a game-creator that produces synthetic games. Apache-2.0.',
} as const;
