/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Auto-generate human-readable captions for ARC3 game actions based on frame changes.
Analyzes score changes, pixel changes, and game state transitions to create descriptive captions.
Example: "ACTION2 - Score increased by 5 points, 12 pixels changed"
SRP/DRY check: Pass — single responsibility of caption generation, uses frameAnalysis for change detection.
*/

import { FrameData, GameAction } from '../Arc3ApiClient.ts';
import { countChangedPixels } from './frameAnalysis.ts';

/**
 * Generate a human-readable caption for a game action
 * @param action - The action that was executed
 * @param prevFrame - The frame before the action (null for initial RESET)
 * @param newFrame - The frame after the action
 * @returns Human-readable caption describing what happened
 */
export function generateActionCaption(
  action: GameAction,
  prevFrame: FrameData | null,
  newFrame: FrameData
): string {
  // Handle initial game start
  if (action.action === 'RESET' && !prevFrame) {
    return `Game initialized - Score: ${newFrame.score}/${newFrame.win_score}`;
  }

  // Calculate changes
  const scoreDiff = prevFrame ? newFrame.score - prevFrame.score : 0;
  const pixelsChanged = prevFrame ? countChangedPixels(prevFrame, newFrame) : 0;

  // Build caption parts
  const parts: string[] = [];

  // Add action description
  if (action.action === 'ACTION6' && action.coordinates) {
    parts.push(`${action.action} at (${action.coordinates[0]}, ${action.coordinates[1]})`);
  } else {
    parts.push(action.action);
  }

  // Add score change
  if (scoreDiff > 0) {
    parts.push(`Score +${scoreDiff}`);
  } else if (scoreDiff < 0) {
    parts.push(`Score ${scoreDiff}`);
  }

  // Add pixel change count
  if (pixelsChanged > 0) {
    parts.push(`${pixelsChanged} pixel${pixelsChanged === 1 ? '' : 's'} changed`);
  } else if (pixelsChanged === 0 && scoreDiff === 0) {
    parts.push('No changes');
  }

  // Add state change
  if (newFrame.state === 'WIN') {
    parts.push('🏆 VICTORY!');
  } else if (newFrame.state === 'GAME_OVER') {
    parts.push('❌ Game Over');
  }

  return parts.join(' - ');
}

/**
 * Generate a short caption for inspect actions (no changes expected)
 * @param frame - The current frame being inspected
 * @returns Caption for inspection
 */
export function generateInspectCaption(frame: FrameData): string {
  return `Inspect - Score: ${frame.score}/${frame.win_score}, State: ${frame.state}, Actions: ${frame.action_counter}/${frame.max_actions}`;
}
