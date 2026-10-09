/**
 * Author: Codex
 * Date: 2026-10-08
 * PURPOSE: Share the reviewed ARC-3 training-data resource attribution across the hub,
 *          synthetic-game catalog and ARC-3 reference page. Source: repository README.
 * SRP/DRY check: Pass — one description and destination for each featured resource.
 */
export const SIMON_ARC3_TRAINING_DATA = {
  title: 'Simon Ouellette — ARC-AGI-3 Training Data',
  url: 'https://github.com/SimonOuellette35/ARC-AGI-3-Training-Data',
  desc: 'ARC-AGI-3-style games, solvers and training-demonstration generators. Brings augmented public games, original games, PuzzleScript and other environments into a common 64×64 observation format. Python tools and source code on GitHub.',
} as const;
