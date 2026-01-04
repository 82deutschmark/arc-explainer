/*
Author: Cascade (GPT-5.2 medium reasoning)
Date: 2026-01-03
PURPOSE: Qualitative, cause-effect harness for Codex ARC3 runs. Builds concise narratives about what changed after actions
         (movement, appearance/disappearance, score deltas) to pair with multimodal PNG frames.
SRP/DRY check: Pass — isolated qualitative summarization; does not alter existing math harness.
*/

import type { FrameData } from "../Arc3ApiClient.ts";
import { analyzeFrameChanges, type FrameChanges } from "./frameAnalysis.ts";

export interface CascadeHarnessContext {
  turn: number;
  lastAction?: string;
  scoreDelta?: number;
  state?: string;
  movementSummary?: string;
  newObjects?: string[];
  disappearedObjects?: string[];
  blocked?: boolean;
}

// Lightweight qualitative summary derived from existing change analysis.
export function buildCascadeContext(params: {
  prevFrame: FrameData | null;
  currentFrame: FrameData | null;
  lastAction?: string;
  turn: number;
}): CascadeHarnessContext | null {
  const { prevFrame, currentFrame, lastAction, turn } = params;
  if (!currentFrame) return null;

  const summary: CascadeHarnessContext = {
    turn,
    lastAction,
    state: currentFrame.state,
    scoreDelta: prevFrame ? currentFrame.score - (prevFrame.score ?? 0) : undefined,
  };

  const changes = analyzeFrameChanges(prevFrame, currentFrame, 6);
  if (changes) {
    const changedCells = changes.changedCells?.length ?? 0;
    if (changedCells > 0) {
      const region = changes.regions?.[0];
      summary.movementSummary = region
        ? `${changedCells} cells changed in ${region.width}x${region.height} zone near (${region.left},${region.top})`
        : `${changedCells} cells changed`;
    } else {
      summary.movementSummary = "No visible change";
      summary.blocked = true;
    }
  }

  return summary;
}

export function stringifyCascadeContext(ctx: CascadeHarnessContext | null): string {
  if (!ctx) return "";
  const parts: string[] = [];
  parts.push(`Turn ${ctx.turn}${ctx.lastAction ? ` after ${ctx.lastAction}` : ""}`);
  if (ctx.state) parts.push(`State: ${ctx.state}`);
  if (ctx.scoreDelta !== undefined) {
    parts.push(`Score change: ${ctx.scoreDelta >= 0 ? "+" : ""}${ctx.scoreDelta}`);
  }
  if (ctx.movementSummary) parts.push(`Movement: ${ctx.movementSummary}`);
  if (ctx.newObjects?.length) parts.push(`Appeared: ${ctx.newObjects.join(", ")}`);
  if (ctx.disappearedObjects?.length) parts.push(`Disappeared: ${ctx.disappearedObjects.join(", ")}`);
  if (ctx.blocked) parts.push("Observation: Action appeared blocked (no visible change).");
  return parts.join(" | ");
}
