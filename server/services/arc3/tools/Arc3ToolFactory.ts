/*
Author: Cascade
Date: 2026-01-03
PURPOSE: Factory for creating ARC3 agent tools. Eliminates duplication between run() and runWithStreaming().
         Tools are created with a context object that provides access to mutable game state and services.
SRP/DRY check: Pass — single responsibility is tool creation, shared between both run modes.
*/

import { tool } from '@openai/agents';
import { z } from 'zod';
import type { FrameData, GameAction } from '../Arc3ApiClient.ts';
import type { Arc3ApiClient } from '../Arc3ApiClient.ts';
import { extractLayerStack, extractGrid, analyzeFrameChanges, countChangedPixels } from '../helpers/frameAnalysis.ts';
import { calculateColorDistribution } from '../helpers/colorAnalysis.ts';
import { renderArc3FrameToPng } from '../arc3GridImageService.ts';
import { executeGridAnalysis } from '../helpers/gridAnalyzer.ts';
import { unpackFrames } from '../helpers/frameUnpacker.ts';
import { generateActionCaption } from '../helpers/captionGenerator.ts';
import { saveFrame } from '../persistence/framePersistence.ts';
import { logger } from '../../../utils/logger.ts';

/**
 * Mutable context for ARC3 tools. Tools read and modify this state.
 */
export interface Arc3ToolContext {
  // Game state (mutable)
  currentFrame: FrameData | null;
  prevFrame: FrameData | null;
  gameGuid: string | null;
  frames: FrameData[];
  currentFrameNumber: number;
  
  // Session info (read-only after init)
  gameId: string;
  scorecardId: string;
  dbSessionId: number | null;
  
  // Services
  apiClient: Arc3ApiClient;
  
  // Callbacks
  updateNoScoreProgress: (prev: FrameData | null, curr: FrameData | null) => void;
  
  // Streaming support (optional)
  streaming?: {
    harness: Arc3StreamHarness;
    state: {
      accumulatedReasoning: string;
      reasoningSequence: number;
    };
    agentName: string;
  };
}

/**
 * Stream harness interface for emitting events during streaming runs.
 */
export interface Arc3StreamHarness {
  sessionId: string;
  emit: (chunk: any) => void;
  emitEvent: (event: string, data: any) => void;
  end: (summary: any) => void;
  metadata: {
    game_id: string;
    agentName: string;
  };
}

/**
 * Persist unpacked animation frames to database.
 */
async function persistUnpackedFrames(
  dbSessionId: number | null,
  unpackedFrames: FrameData[],
  action: GameAction,
  prevFrame: FrameData | null,
  currentFrameNumber: number
): Promise<number> {
  if (!dbSessionId || unpackedFrames.length === 0) {
    return currentFrameNumber;
  }

  let frameNum = currentFrameNumber;

  try {
    for (let i = 0; i < unpackedFrames.length; i++) {
      const frame = unpackedFrames[i];
      const isLastFrame = i === unpackedFrames.length - 1;
      const pixelsChanged = isLastFrame && prevFrame
        ? countChangedPixels(prevFrame, frame)
        : 0;

      let caption = generateActionCaption(action, prevFrame, frame);
      if (unpackedFrames.length > 1) {
        caption += ` (frame ${i + 1}/${unpackedFrames.length})`;
      }

      await saveFrame(dbSessionId, frameNum, frame, action, caption, pixelsChanged);
      frameNum++;
    }
  } catch (error) {
    logger.warn(
      `[Arc3Tools] Failed to persist unpacked frames: ${error instanceof Error ? error.message : String(error)}`,
      'arc3'
    );
  }

  return frameNum;
}

/**
 * Create the inspect_game_state tool.
 */
export function createInspectTool(ctx: Arc3ToolContext) {
  return tool({
    name: 'inspect_game_state',
    description: 'Inspect the current game state visually. Returns a PNG image (frameImage) showing exactly what you see, plus structured analysis. The changes object shows what pixels changed since your last action - use this to understand action effects. Always call this before making decisions. For programmatic grid analysis, use the analyze_grid tool instead.',
    parameters: z.object({
      note: z
        .string()
        .max(240)
        .nullable()
        .describe('Optional reason for requesting a snapshot (used in the activity log). Use null to omit.'),
    }),
    execute: async (input) => {
      const logPrefix = ctx.streaming ? '[ARC3 TOOL STREAM]' : '[ARC3 TOOL]';
      logger.info(`${logPrefix} inspect_game_state called with note: "${input.note}"`, 'arc3');

      if (!ctx.currentFrame) {
        logger.error(`${logPrefix} ERROR: currentFrame is null!`, 'arc3');
        throw new Error('Game session not initialized yet.');
      }

      // Emit tool call event (streaming only)
      if (ctx.streaming) {
        ctx.streaming.harness.emitEvent("agent.tool_call", {
          tool: 'inspect_game_state',
          arguments: input,
          timestamp: Date.now(),
        });
      }

      const layerStack = extractLayerStack(ctx.currentFrame);
      const imageResult = await renderArc3FrameToPng(layerStack);
      const frameImage = imageResult?.dataUrl ?? null;

      if (frameImage) {
        logger.info(`${logPrefix} Generated frame image: ${imageResult!.width}x${imageResult!.height}px`, 'arc3');
      } else {
        logger.warn(`${logPrefix} Failed to generate frame image, returning numeric data only`, 'arc3');
      }

      const grid2D = extractGrid(ctx.currentFrame);
      const colorDistribution = calculateColorDistribution(grid2D);
      const changes = analyzeFrameChanges(ctx.prevFrame, ctx.currentFrame);

      const result = {
        gameGuid: ctx.currentFrame.guid,
        gameId: ctx.currentFrame.game_id,
        frameImage,
        colorDistribution,
        changes,
        score: ctx.currentFrame.score,
        state: ctx.currentFrame.state,
        action_counter: ctx.currentFrame.action_counter,
        max_actions: ctx.currentFrame.max_actions,
        win_score: ctx.currentFrame.win_score,
        note: input.note ?? null,
      };

      logger.info(
        `${logPrefix} inspect_game_state returning: state=${result.state}, score=${result.score}, ` +
        `actions=${result.action_counter}/${result.max_actions}, colors=${colorDistribution.length}, ` +
        `changes=${changes?.pixelsChanged ?? 'N/A'}`,
        'arc3'
      );

      // Emit tool result event (streaming only)
      if (ctx.streaming) {
        ctx.streaming.harness.emitEvent("agent.tool_result", {
          tool: 'inspect_game_state',
          result,
          timestamp: Date.now(),
        });
      }

      return result;
    },
  });
}

/**
 * Create the analyze_grid tool.
 */
export function createAnalyzeGridTool(ctx: Arc3ToolContext) {
  return tool({
    name: 'analyze_grid',
    description: 'Execute Python code to analyze the current game grid programmatically. The code runs in a sandboxed environment with numpy, scipy.ndimage available. You have access to: `grid` (3D numpy array of all layers), `current_layer` (2D array of latest layer), and helper functions: find_connected_components(layer, color=None), detect_symmetry(layer), get_bounding_box(layer, exclude_color=0), color_counts(layer). Use print() to output results - stdout is captured and returned. 10 second timeout.',
    parameters: z.object({
      code: z
        .string()
        .min(5)
        .max(4000)
        .describe('Python code to execute. Must use print() to output results.'),
      note: z
        .string()
        .max(120)
        .nullable()
        .describe('Optional note explaining the purpose of this analysis.'),
    }),
    execute: async ({ code, note }) => {
      const logPrefix = ctx.streaming ? '[ARC3 TOOL STREAM]' : '[ARC3 TOOL]';
      logger.info(`${logPrefix} analyze_grid called with note: "${note}"`, 'arc3');

      if (!ctx.currentFrame) {
        throw new Error('Game session not initialized yet.');
      }

      // Emit tool call event (streaming only)
      if (ctx.streaming) {
        ctx.streaming.harness.emitEvent("agent.tool_call", {
          tool: 'analyze_grid',
          arguments: { code: code.slice(0, 200) + '...', note },
          timestamp: Date.now(),
        });
      }

      const gridStack = extractLayerStack(ctx.currentFrame);
      const result = await executeGridAnalysis(gridStack, code);

      const toolResult = {
        success: result.success,
        output: result.output,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
        note: note ?? null,
      };

      logger.info(
        `${logPrefix} analyze_grid completed: success=${result.success}, ` +
        `time=${result.executionTimeMs}ms`,
        'arc3'
      );

      // Emit tool result event (streaming only)
      if (ctx.streaming) {
        ctx.streaming.harness.emitEvent("agent.tool_result", {
          tool: 'analyze_grid',
          result: toolResult,
          timestamp: Date.now(),
        });
      }

      return toolResult;
    },
  });
}

/**
 * Create the reset_game tool (non-streaming only).
 */
export function createResetGameTool(ctx: Arc3ToolContext) {
  return tool({
    name: 'reset_game',
    description: 'Reset the current ARC3 game session by issuing the RESET command. Use to restart a level or recover from GAME_OVER states.',
    parameters: z.object({}),
    execute: async () => {
      logger.info('[ARC3 TOOL] reset_game called', 'arc3');
      if (!ctx.gameGuid) throw new Error('Game session not initialized yet.');

      ctx.prevFrame = ctx.currentFrame;
      const resetFrameData = await ctx.apiClient.executeAction(ctx.gameId, ctx.gameGuid, { action: 'RESET' }, undefined, ctx.scorecardId);

      const unpackedResetFrames = unpackFrames(resetFrameData);
      if (unpackedResetFrames.length > 1) {
        logger.info(`[ARC3 TOOL] reset_game returned ${unpackedResetFrames.length} animation frames`, 'arc3');
      }

      ctx.currentFrame = unpackedResetFrames[unpackedResetFrames.length - 1];
      ctx.gameGuid = ctx.currentFrame.guid;
      ctx.frames.push(...unpackedResetFrames);
      ctx.updateNoScoreProgress(ctx.prevFrame, ctx.currentFrame);

      logger.info(
        `[ARC3 TOOL] reset_game executed: state=${ctx.currentFrame.state}, score=${ctx.currentFrame.score} ` +
        `(${unpackedResetFrames.length} frame(s))`,
        'arc3'
      );

      if (ctx.dbSessionId) {
        ctx.currentFrameNumber = await persistUnpackedFrames(
          ctx.dbSessionId,
          unpackedResetFrames,
          { action: 'RESET' },
          ctx.prevFrame,
          ctx.currentFrameNumber
        );
      }

      return ctx.currentFrame;
    }
  });
}

/**
 * Create a simple action tool (ACTION1-5).
 */
export function createSimpleActionTool(ctx: Arc3ToolContext, name: 'ACTION1'|'ACTION2'|'ACTION3'|'ACTION4'|'ACTION5') {
  return tool({
    name,
    description: `Send simple input ${name}.`,
    parameters: z.object({}),
    execute: async () => {
      const logPrefix = ctx.streaming ? '[ARC3 TOOL STREAM]' : '[ARC3 TOOL]';
      logger.info(`${logPrefix} ${name} called`, 'arc3');
      if (!ctx.gameGuid) throw new Error('Game session not initialized yet.');

      // Emit tool call (streaming only)
      if (ctx.streaming) {
        ctx.streaming.harness.emitEvent("agent.tool_call", { tool: name, arguments: {}, timestamp: Date.now() });
      }

      // Build reasoning payload for streaming
      const reasoningPayload = ctx.streaming?.state.accumulatedReasoning
        ? {
            type: 'agent_reasoning',
            agentName: ctx.streaming.agentName,
            game_id: ctx.gameId,
            gameGuid: ctx.gameGuid,
            step: ctx.frames.length,
            text: ctx.streaming.state.accumulatedReasoning.slice(0, 8000),
          }
        : undefined;

      ctx.prevFrame = ctx.currentFrame;
      const actionFrameData = await ctx.apiClient.executeAction(ctx.gameId, ctx.gameGuid, { action: name }, reasoningPayload, ctx.scorecardId);

      const unpackedActionFrames = unpackFrames(actionFrameData);
      if (unpackedActionFrames.length > 1) {
        logger.info(`${logPrefix} ${name} returned ${unpackedActionFrames.length} animation frames`, 'arc3');
      }

      ctx.currentFrame = unpackedActionFrames[unpackedActionFrames.length - 1];
      ctx.frames.push(...unpackedActionFrames);
      ctx.updateNoScoreProgress(ctx.prevFrame, ctx.currentFrame);

      logger.info(
        `${logPrefix} ${name} executed: state=${ctx.currentFrame.state}, score=${ctx.currentFrame.score} ` +
        `(${unpackedActionFrames.length} frame(s))`,
        'arc3'
      );

      // Persist frames
      if (ctx.dbSessionId && ctx.prevFrame) {
        ctx.currentFrameNumber = await persistUnpackedFrames(
          ctx.dbSessionId,
          unpackedActionFrames,
          { action: name },
          ctx.prevFrame,
          ctx.currentFrameNumber
        );
      }

      // Emit frame updates (streaming only)
      if (ctx.streaming) {
        for (let i = 0; i < unpackedActionFrames.length; i++) {
          const frame = unpackedActionFrames[i];
          const isLastFrame = i === unpackedActionFrames.length - 1;
          let caption = generateActionCaption({ action: name }, ctx.prevFrame, frame);
          if (unpackedActionFrames.length > 1) {
            caption += ` (frame ${i + 1}/${unpackedActionFrames.length})`;
          }

          ctx.streaming.harness.emitEvent("game.frame_update", {
            frameIndex: String(ctx.currentFrameNumber - unpackedActionFrames.length + i),
            frameData: frame,
            caption,
            action: { type: name },
            isAnimation: unpackedActionFrames.length > 1,
            animationFrame: i,
            animationTotalFrames: unpackedActionFrames.length,
            isLastAnimationFrame: isLastFrame,
            timestamp: Date.now()
          });
        }
      }

      return ctx.currentFrame;
    }
  });
}

/**
 * Create the ACTION6 tool (click/point with coordinates).
 */
export function createAction6Tool(ctx: Arc3ToolContext) {
  return tool({
    name: 'ACTION6',
    description: 'Send complex input with coordinates (Click/Point).',
    parameters: z.object({ x: z.number().int(), y: z.number().int() }),
    execute: async ({ x, y }) => {
      const logPrefix = ctx.streaming ? '[ARC3 TOOL STREAM]' : '[ARC3 TOOL]';
      logger.info(`${logPrefix} ACTION6 called with coordinates: (${x}, ${y})`, 'arc3');
      if (!ctx.gameGuid) throw new Error('Game session not initialized yet.');

      // Emit tool call (streaming only)
      if (ctx.streaming) {
        ctx.streaming.harness.emitEvent("agent.tool_call", { tool: 'ACTION6', arguments: { x, y }, timestamp: Date.now() });
      }

      // Build reasoning payload for streaming
      const reasoningPayload = ctx.streaming?.state.accumulatedReasoning
        ? {
            type: 'agent_reasoning',
            agentName: ctx.streaming.agentName,
            game_id: ctx.gameId,
            gameGuid: ctx.gameGuid,
            step: ctx.frames.length,
            text: ctx.streaming.state.accumulatedReasoning.slice(0, 8000),
          }
        : undefined;

      ctx.prevFrame = ctx.currentFrame;
      const action6FrameData = await ctx.apiClient.executeAction(ctx.gameId, ctx.gameGuid, { action: 'ACTION6', coordinates: [x, y] }, reasoningPayload, ctx.scorecardId);

      const unpackedAction6Frames = unpackFrames(action6FrameData);
      if (unpackedAction6Frames.length > 1) {
        logger.info(`${logPrefix} ACTION6 returned ${unpackedAction6Frames.length} animation frames`, 'arc3');
      }

      ctx.currentFrame = unpackedAction6Frames[unpackedAction6Frames.length - 1];
      ctx.frames.push(...unpackedAction6Frames);
      ctx.updateNoScoreProgress(ctx.prevFrame, ctx.currentFrame);

      logger.info(
        `${logPrefix} ACTION6(${x},${y}) executed: state=${ctx.currentFrame.state}, score=${ctx.currentFrame.score} ` +
        `(${unpackedAction6Frames.length} frame(s))`,
        'arc3'
      );

      // Persist frames
      if (ctx.dbSessionId && ctx.prevFrame) {
        ctx.currentFrameNumber = await persistUnpackedFrames(
          ctx.dbSessionId,
          unpackedAction6Frames,
          { action: 'ACTION6', coordinates: [x, y] },
          ctx.prevFrame,
          ctx.currentFrameNumber
        );
      }

      // Emit frame updates (streaming only)
      if (ctx.streaming) {
        for (let i = 0; i < unpackedAction6Frames.length; i++) {
          const frame = unpackedAction6Frames[i];
          const isLastFrame = i === unpackedAction6Frames.length - 1;
          let caption = generateActionCaption({ action: 'ACTION6', coordinates: [x, y] }, ctx.prevFrame, frame);
          if (unpackedAction6Frames.length > 1) {
            caption += ` (frame ${i + 1}/${unpackedAction6Frames.length})`;
          }

          ctx.streaming.harness.emitEvent("game.frame_update", {
            frameIndex: String(ctx.currentFrameNumber - unpackedAction6Frames.length + i),
            frameData: frame,
            caption,
            action: { type: 'ACTION6', coordinates: [x, y] },
            isAnimation: unpackedAction6Frames.length > 1,
            animationFrame: i,
            animationTotalFrames: unpackedAction6Frames.length,
            isLastAnimationFrame: isLastFrame,
            timestamp: Date.now()
          });
        }
      }

      return ctx.currentFrame;
    }
  });
}

/**
 * Create all ARC3 tools for an agent run.
 * @param ctx Tool context with mutable game state and services
 * @param includeResetTool Whether to include reset_game tool (only for non-streaming runs)
 */
export function createArc3Tools(ctx: Arc3ToolContext, includeResetTool: boolean = false) {
  const tools = [
    createInspectTool(ctx),
    createAnalyzeGridTool(ctx),
    createSimpleActionTool(ctx, 'ACTION1'),
    createSimpleActionTool(ctx, 'ACTION2'),
    createSimpleActionTool(ctx, 'ACTION3'),
    createSimpleActionTool(ctx, 'ACTION4'),
    createSimpleActionTool(ctx, 'ACTION5'),
    createAction6Tool(ctx),
  ];

  if (includeResetTool) {
    tools.splice(2, 0, createResetGameTool(ctx)); // Insert after analyze_grid
  }

  return tools;
}
