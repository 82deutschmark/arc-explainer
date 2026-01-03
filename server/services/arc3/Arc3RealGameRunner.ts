/*
Author: Claude Haiku 4.5
Date: 2025-12-20 (CRITICAL FIX: Multi-frame animation unpacking)
PURPOSE: Runs OpenAI Agents SDK workflows against the real ARC-AGI-3 API with PostgreSQL frame persistence.

CRITICAL CHANGES (2025-12-20):
- Integrated frameUnpacker.ts to detect and unpack multi-frame animation responses from ARC-AGI-3 API
- When an action returns 4D frame data [frameIdx][layerIdx][height][width], unpacks into individual 3D frames
- Each unpacked frame is persisted separately to database for complete frame history
- Streaming mode emits each animation frame individually with metadata (animationFrame, animationTotalFrames, isLastAnimationFrame)
- Prevents data loss from lossy frame storage and ensures accurate action efficiency scoring

PREV VERSION ISSUES (FIXED):
- Treated 4D multi-frame responses as single frames
- Lost animation data (e.g., 3-frame movement sequence collapsed to 1)
- Incomplete database history (missing intermediate frames)
- Inaccurate replay data (animations not visible)
- Potential scoring errors (didn't count intermediate frames)

Architecture:
- Delegates to frameUnpacker for dimensionality detection
- Uses persistUnpackedFrames() helper for consistent frame persistence
- Both sync (run) and async (runWithStreaming) methods fully support unpacking
- All action tools (RESET, ACTION1-5, ACTION6) unpack before processing
- Agent always reasons about final "settled" frame, but database has complete history

SRP/DRY check: Pass — frame unpacking separated into dedicated module, reusable across both methods.
*/

import { randomUUID, createHash } from 'node:crypto';
import { Agent, run, tool, extractAllTextOutput } from '@openai/agents';
import { z } from 'zod';
import { Arc3ApiClient, type FrameData, type GameAction } from './Arc3ApiClient.ts';
import type { Arc3AgentRunConfig, Arc3AgentRunResult, Arc3RunTimelineEntry, Arc3RunSummary, Arc3GameState } from './types.ts';
import { buildArc3DefaultPrompt } from './prompts.ts';
import { DEFAULT_MODEL, DEFAULT_MAX_TURNS, DEFAULT_GAME_ID } from './utils/constants.ts';
import { processRunItems, processRunItemsWithReasoning } from './utils/timelineProcessor.ts';
import { generateActionCaption, generateInspectCaption } from './helpers/captionGenerator.ts';
import { countChangedPixels, analyzeFrameChanges, extractGrid, extractLayerStack } from './helpers/frameAnalysis.ts';
import { calculateColorDistribution } from './helpers/colorAnalysis.ts';
import { unpackFrames, summarizeFrameStructure } from './helpers/frameUnpacker.ts';
import { createSession } from './persistence/sessionManager.ts';
import { saveFrame } from './persistence/framePersistence.ts';
import { renderArc3FrameToPng } from './arc3GridImageService.ts';
import { executeGridAnalysis } from './helpers/gridAnalyzer.ts';
import { logger } from '../../utils/logger.ts';

export interface Arc3StreamHarness {
  sessionId: string;
  emit: (chunk: any) => void;
  emitEvent: (event: string, data: any) => void;
  end: (summary: any) => void;
  metadata: {
    game_id: string;  // Match API property name
    agentName: string;
  };
}

export class Arc3RealGameRunner {
  constructor(private readonly apiClient: Arc3ApiClient) {}

  private computeFrameHash(frame: number[][][] | undefined): string | undefined {
    if (!frame || frame.length === 0) return undefined;
    try {
      return createHash('sha256').update(JSON.stringify(frame)).digest('hex').slice(0, 16);
    } catch {
      return undefined;
    }
  }

  /**
   * CRITICAL FIX: Persist unpacked animation frames to database.
   *
   * When an ARC-AGI-3 action returns animation (multiple frames), we unpack them
   * and persist each frame individually to the database. This ensures:
   * - Complete frame history (not lossy)
   * - Proper action efficiency scoring (counts all frames)
   * - Accurate replay data (animation visible)
   * - Agent context (can see state transitions)
   *
   * @param dbSessionId - Database session ID
   * @param unpackedFrames - Array of FrameData objects from unpackFrames()
   * @param action - The action that produced these frames
   * @param prevFrame - Previous frame for pixel diff calculation
   * @param currentFrameNumber - Starting frame number for this action
   * @returns Updated frame number after persistence
   */
  private async persistUnpackedFrames(
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

        // Only compare pixel changes for final frame of animation
        // Intermediate frames are IN_PROGRESS, so pixel diff is less meaningful
        const isLastFrame = i === unpackedFrames.length - 1;
        const pixelsChanged = isLastFrame && prevFrame
          ? countChangedPixels(prevFrame, frame)
          : 0;

        // Generate caption (include animation sequence info if multi-frame)
        let caption = generateActionCaption(action, prevFrame, frame);
        if (unpackedFrames.length > 1) {
          caption += ` (frame ${i + 1}/${unpackedFrames.length})`;
        }

        await saveFrame(dbSessionId, frameNum, frame, action, caption, pixelsChanged);

        logger.debug(
          `[Frame Persistence] Saved frame ${frameNum} (animation ${i + 1}/${unpackedFrames.length}): ` +
          `${caption}`,
          'arc3'
        );

        frameNum++;
      }
    } catch (error) {
      logger.warn(
        `[Frame Persistence] Failed to persist unpacked frames: ` +
        `${error instanceof Error ? error.message : String(error)}`,
        'arc3'
      );
    }

    return frameNum;
  }

  /**
   * Continue an existing game session WITHOUT executing any actions.
   * CRITICAL: We must NOT execute actions just to "fetch" state - that changes the game!
   * Instead, we rely on the cached frame passed from the frontend.
   * If no cached frame is provided, we throw an error rather than corrupting game state.
   */
  private validateContinuationFrame(seedFrame: FrameData | undefined, gameId: string, gameGuid: string): FrameData {
    if (!seedFrame) {
      throw new Error(
        `[ARC3] Cannot continue game session ${gameGuid} without a seed frame. ` +
        `The frontend must provide the last known frame state when continuing. ` +
        `Executing actions to "fetch" state would corrupt the game!`
      );
    }

    if (seedFrame.guid !== gameGuid) {
      logger.warn(
        `[ARC3] Seed frame guid (${seedFrame.guid}) doesn't match expected guid (${gameGuid}). Using seed frame anyway.`,
        'arc3'
      );
    }

    logger.info(
      `[ARC3] Continuing game session: ${gameGuid} at state=${seedFrame.state}, score=${seedFrame.score}, actions=${seedFrame.action_counter}/${seedFrame.max_actions}`,
      'arc3'
    );

    return seedFrame;
  }

  async run(config: Arc3AgentRunConfig): Promise<Arc3AgentRunResult> {
    const agentName = config.agentName?.trim() || 'ARC3 Real Game Operator';
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    const gameId = config.game_id ?? DEFAULT_GAME_ID;
    const scorecardId = await this.apiClient.openScorecard(
      ['arc-explainer', 'agent-run'],
      'https://github.com/arc-explainer/arc-explainer',
      { source: 'arc-explainer', mode: 'agent-run', game_id: gameId, agentName }
    );

    let gameGuid: string | null = null;
    let currentFrame: FrameData | null = null;
    let prevFrame: FrameData | null = null;
    const frames: FrameData[] = [];
    let dbSessionId: number | null = null;

    // Start a fresh session OR continue an existing one
    // CRITICAL: When continuing, we MUST have a seed frame - we can't execute actions to "fetch" state
    const initialFrame = config.existingGameGuid
      ? this.validateContinuationFrame(config.seedFrame, gameId, config.existingGameGuid)
      : config.seedFrame
        ? config.seedFrame
        : await this.apiClient.startGame(gameId, undefined, scorecardId);

    gameGuid = initialFrame.guid;

    // CRITICAL FIX: Unpack initial frame if it's an animation (4D array)
    const unpackedInitialFrames = unpackFrames(initialFrame);
    if (unpackedInitialFrames.length > 1) {
      logger.info(
        `[ARC3] Initial RESET returned ${unpackedInitialFrames.length} animation frames: ` +
        summarizeFrameStructure(initialFrame),
        'arc3'
      );
    }

    currentFrame = unpackedInitialFrames[unpackedInitialFrames.length - 1]; // Final frame is settled state
    frames.push(...unpackedInitialFrames); // Add all unpacked frames

    // Create database session for frame persistence (only for new games)
    let currentFrameNumber = 0;
    try {
      if (!config.existingGameGuid) {
        dbSessionId = await createSession(gameId, gameGuid, currentFrame.win_score);

        // Persist all unpacked initial frames
        currentFrameNumber = await this.persistUnpackedFrames(
          dbSessionId,
          unpackedInitialFrames,
          { action: 'RESET' },
          null,
          0
        );

        logger.info(
          `Created session ${dbSessionId} for game ${gameId} ` +
          `(${unpackedInitialFrames.length} initial frame(s))`,
          'arc3'
        );
      } else {
        logger.info(`[ARC3] Continuing game session ${gameGuid} on game ${gameId}`, 'arc3');
      }
    } catch (error) {
      logger.warn(`Failed to create database session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    }

    // Track score progress to detect if agent is stuck
    let noScoreProgressStreak = 0;
    const updateNoScoreProgress = (prev: FrameData | null, curr: FrameData | null) => {
      if (!prev || !curr) return;
      if (curr.score === prev.score) {
        noScoreProgressStreak += 1;
      } else {
        noScoreProgressStreak = 0;
      }
    };

    const inspectTool = tool({
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
        logger.info(`[ARC3 TOOL] inspect_game_state called with note: "${input.note}"`, 'arc3');

        if (!currentFrame) {
          logger.error('[ARC3 TOOL] ERROR: currentFrame is null!', 'arc3');
          throw new Error('Game session not initialized yet.');
        }

        // Normalize frame data to a 3D layer stack for rendering
        const layerStack = extractLayerStack(currentFrame);

        // Generate base64 PNG image of the current frame
        const imageResult = await renderArc3FrameToPng(layerStack);
        const frameImage = imageResult?.dataUrl ?? null;
        if (frameImage) {
          logger.info(`[ARC3 TOOL] Generated frame image: ${imageResult!.width}x${imageResult!.height}px`, 'arc3');
        } else {
          logger.warn('[ARC3 TOOL] Failed to generate frame image, returning numeric data only', 'arc3');
        }

        // Calculate color distribution from the latest 2D layer
        const grid2D = extractGrid(currentFrame);
        const colorDistribution = calculateColorDistribution(grid2D);

        // Analyze changes since previous frame
        const changes = analyzeFrameChanges(prevFrame, currentFrame);

        // Return visual representation and analysis (no raw grid - use analyze_grid for that)
        const result = {
          gameGuid: currentFrame.guid,
          gameId: currentFrame.game_id,
          frameImage,  // Base64 PNG data URL - THIS is what you should look at
          colorDistribution,  // Quick summary of which colors exist
          changes,  // What changed since last action - critical for understanding effects
          score: currentFrame.score,
          state: currentFrame.state,
          action_counter: currentFrame.action_counter,
          max_actions: currentFrame.max_actions,
          win_score: currentFrame.win_score,
          note: input.note ?? null,
        };

        logger.info(
          `[ARC3 TOOL] inspect_game_state returning: state=${result.state}, score=${result.score}, ` +
          `actions=${result.action_counter}/${result.max_actions}, colors=${colorDistribution.length}, ` +
          `changes=${changes?.pixelsChanged ?? 'N/A'}`,
          'arc3'
        );
        return result;
      },
    });

    const analyzeGridTool = tool({
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
        logger.info(`[ARC3 TOOL] analyze_grid called with note: "${note}"`, 'arc3');

        if (!currentFrame) {
          throw new Error('Game session not initialized yet.');
        }

        const gridStack = extractLayerStack(currentFrame);
        const result = await executeGridAnalysis(gridStack, code);

        logger.info(
          `[ARC3 TOOL] analyze_grid completed: success=${result.success}, ` +
          `time=${result.executionTimeMs}ms`,
          'arc3'
        );

        return {
          success: result.success,
          output: result.output,
          error: result.error,
          executionTimeMs: result.executionTimeMs,
          note: note ?? null,
        };
      },
    });

    const resetGameTool = tool({
      name: 'reset_game',
      description: 'Reset the current ARC3 game session by issuing the RESET command. Use to restart a level or recover from GAME_OVER states.',
      parameters: z.object({}),
      execute: async () => {
        logger.info('[ARC3 TOOL] reset_game called', 'arc3');
        if (!gameGuid) throw new Error('Game session not initialized yet.');

        prevFrame = currentFrame;
        const resetFrameData = await this.apiClient.executeAction(gameId, gameGuid, { action: 'RESET' }, undefined, scorecardId);

        // CRITICAL FIX: Unpack animation frames from RESET response
        const unpackedResetFrames = unpackFrames(resetFrameData);
        if (unpackedResetFrames.length > 1) {
          logger.info(
            `[ARC3 TOOL] reset_game returned ${unpackedResetFrames.length} animation frames`,
            'arc3'
          );
        }

        currentFrame = unpackedResetFrames[unpackedResetFrames.length - 1]; // Final frame is settled
        gameGuid = currentFrame.guid;
        frames.push(...unpackedResetFrames); // Add all unpacked frames
        updateNoScoreProgress(prevFrame, currentFrame);

        logger.info(
          `[ARC3 TOOL] reset_game executed: state=${currentFrame.state}, score=${currentFrame.score} ` +
          `(${unpackedResetFrames.length} frame(s))`,
          'arc3'
        );

        // Persist unpacked reset frames
        if (dbSessionId) {
          currentFrameNumber = await this.persistUnpackedFrames(
            dbSessionId,
            unpackedResetFrames,
            { action: 'RESET' },
            prevFrame,
            currentFrameNumber
          );
        }

        return currentFrame;
      }
    });

    // Define individual action tools to match ARC3 reference (ACTION1-6)
    const simpleAction = (name: 'ACTION1'|'ACTION2'|'ACTION3'|'ACTION4'|'ACTION5') => tool({
      name,
      description: `Send simple input ${name}.`,
      parameters: z.object({}),
      execute: async () => {
        logger.info(`[ARC3 TOOL] ${name} called`, 'arc3');
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        prevFrame = currentFrame;

        const actionFrameData = await this.apiClient.executeAction(gameId, gameGuid, { action: name });

        // CRITICAL FIX: Unpack animation frames from action response
        const unpackedActionFrames = unpackFrames(actionFrameData);
        if (unpackedActionFrames.length > 1) {
          logger.info(
            `[ARC3 TOOL] ${name} returned ${unpackedActionFrames.length} animation frames`,
            'arc3'
          );
        }

        currentFrame = unpackedActionFrames[unpackedActionFrames.length - 1]; // Final frame is settled
        frames.push(...unpackedActionFrames); // Add all unpacked frames
        updateNoScoreProgress(prevFrame, currentFrame);

        logger.info(
          `[ARC3 TOOL] ${name} executed: state=${currentFrame.state}, score=${currentFrame.score} ` +
          `(${unpackedActionFrames.length} frame(s))`,
          'arc3'
        );

        // Persist unpacked action frames
        if (dbSessionId && prevFrame) {
          currentFrameNumber = await this.persistUnpackedFrames(
            dbSessionId,
            unpackedActionFrames,
            { action: name },
            prevFrame,
            currentFrameNumber
          );
        }

        return currentFrame;
      }
    });

    const action6Tool = tool({
      name: 'ACTION6',
      description: 'Send complex input with coordinates (Click/Point).',
      parameters: z.object({ x: z.number().int(), y: z.number().int() }),
      execute: async ({ x, y }) => {
        logger.info(`[ARC3 TOOL] ACTION6 called with coordinates: (${x}, ${y})`, 'arc3');
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        prevFrame = currentFrame;

        const action6FrameData = await this.apiClient.executeAction(gameId, gameGuid, { action: 'ACTION6', coordinates: [x, y] });

        // CRITICAL FIX: Unpack animation frames from ACTION6 response
        const unpackedAction6Frames = unpackFrames(action6FrameData);
        if (unpackedAction6Frames.length > 1) {
          logger.info(
            `[ARC3 TOOL] ACTION6 returned ${unpackedAction6Frames.length} animation frames`,
            'arc3'
          );
        }

        currentFrame = unpackedAction6Frames[unpackedAction6Frames.length - 1]; // Final frame is settled
        frames.push(...unpackedAction6Frames); // Add all unpacked frames
        updateNoScoreProgress(prevFrame, currentFrame);

        logger.info(
          `[ARC3 TOOL] ACTION6(${x},${y}) executed: state=${currentFrame.state}, score=${currentFrame.score} ` +
          `(${unpackedAction6Frames.length} frame(s))`,
          'arc3'
        );

        // Persist unpacked ACTION6 frames
        if (dbSessionId && prevFrame) {
          currentFrameNumber = await this.persistUnpackedFrames(
            dbSessionId,
            unpackedAction6Frames,
            { action: 'ACTION6', coordinates: [x, y] },
            prevFrame,
            currentFrameNumber
          );
        }

        return currentFrame;
      }
    });

    const selectSystemPrompt = (): string => {
      const explicit = config.systemPrompt?.trim() || '';
      const skipDefault = config.skipDefaultSystemPrompt === true;

      if (skipDefault) {
        return explicit;
      }

      if (explicit) {
        return explicit;
      }

      return buildArc3DefaultPrompt();
    };

    const baseSystemPrompt = selectSystemPrompt();
    const operatorGuidance = config.instructions?.trim();
    const combinedInstructions = operatorGuidance
      ? (baseSystemPrompt
          ? `${baseSystemPrompt}\n\nOperator guidance: ${operatorGuidance}`
          : operatorGuidance)
      : baseSystemPrompt || '';

    const storeResponse = config.storeResponse ?? true;
    const frameHash = currentFrame ? this.computeFrameHash(extractLayerStack(currentFrame)) : undefined;
    const metadata = {
      sessionId: config.sessionId,
      gameGuid: gameGuid || undefined,
      frameHash,
      frameIndex: String(frames.length - 1),
      previousResponseId: config.previousResponseId ?? null,
      systemPromptPresetId: config.systemPromptPresetId ?? null,
      skipDefaultSystemPrompt: String(config.skipDefaultSystemPrompt ?? false),
    };

    const agent = new Agent({
      name: agentName,
      instructions: combinedInstructions,
      handoffDescription: 'Operates the ARC-AGI-3 real game interface.',
      model: config.model ?? DEFAULT_MODEL,
      modelSettings: {
        reasoning: {
          effort: (config.reasoningEffort ?? 'high') as 'minimal' | 'low' | 'medium' | 'high',
          summary: 'detailed',
        },
        text: { verbosity: 'medium' },
        store: storeResponse,
        providerData: {
          metadata,
        },
      },
      tools: [inspectTool, analyzeGridTool, resetGameTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
    });

    const result = await run(
      agent,
      `Start playing the ARC-AGI-3 game "${gameId}". Narrate before every tool call, then execute it. Keep using the What I see / What it means / Next move format until you deliver the Final Report.`,
      {
        maxTurns,
        previousResponseId: config.previousResponseId,
      },
    );

    // Process timeline entries using extracted utility (eliminates duplication)
    const timeline = processRunItems(result.newItems, agentName);

    // Close scorecard when game reaches terminal state (per audit: must close after WIN/GAME_OVER)
    // Sessions remain open for continuations ONLY if game is still in progress
    if (currentFrame && (currentFrame.state === 'WIN' || currentFrame.state === 'GAME_OVER')) {
      try {
        await this.apiClient.closeScorecard(scorecardId);
        logger.info(`[ARC3] Closed scorecard ${scorecardId} - game ended with ${currentFrame.state}`, 'arc3');
      } catch (error) {
        logger.warn(`[ARC3] Failed to close scorecard ${scorecardId}: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
      }
    }

    const usage = result.state._context.usage;
    const providerResponseId = result.lastResponseId ?? null;
    const finalOutputCandidate = result.finalOutput;
    const finalOutput = typeof finalOutputCandidate === 'string'
      ? finalOutputCandidate
      : extractAllTextOutput(result.newItems);

    // Map ARC3 API state strings to Arc3GameState type
    const mapState = (state: string): Arc3GameState => {
      if (state === 'NOT_PLAYED') return 'NOT_PLAYED';
      if (state === 'IN_PROGRESS') return 'IN_PROGRESS';
      if (state === 'WIN') return 'WIN';
      if (state === 'GAME_OVER') return 'GAME_OVER';
      if (state === 'NOT_FINISHED') return 'NOT_FINISHED';  // Game incomplete but not over
      // If we get an unexpected state, throw an error
      throw new Error(`Unexpected game state from ARC3 API: ${state}`);
    };

    // Create summary from the last frame (should always exist since we start the game before agent runs)
    if (currentFrame === null) {
      throw new Error('No frame data available - game did not start properly');
    }

    const cf = currentFrame as FrameData;
    const summary: Arc3RunSummary = {
      state: mapState(cf.state),
      score: cf.score,
      stepsTaken: cf.action_counter ?? Math.max(0, frames.length - 1),
      simpleActionsUsed: [],  // ARC3 doesn't track this the same way
      coordinateGuesses: 0,  // ARC3 doesn't track this separately
      scenarioId: gameId,
      scenarioName: gameId,  // Use gameId as name for now
    };

    return {
      runId: randomUUID(),
      gameGuid: gameGuid || 'unknown',
      scorecardId,  // CRITICAL: Return scorecard ID for session continuation
      finalOutput: finalOutput?.trim() ? finalOutput.trim() : undefined,
      timeline,
      frames: frames as any[],  // Arc3AgentRunResult accepts any[] for frames
      summary,
      usage: {
        requests: usage.requests,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      providerResponseId,
    };
  }

  async runWithStreaming(config: Arc3AgentRunConfig, streamHarness: Arc3StreamHarness): Promise<Arc3AgentRunResult> {
    const agentName = config.agentName?.trim() || 'ARC3 Real Game Operator';
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    const gameId = config.game_id ?? DEFAULT_GAME_ID;

    // CRITICAL: Reuse existing scorecard on continuation, open new one on fresh start
    let scorecardId: string;
    if (config.scorecardId) {
      // Continuation: reuse existing scorecard (stays open across multiple agent runs)
      scorecardId = config.scorecardId;
      logger.info(`[ARC3 STREAMING] Reusing existing scorecard ${scorecardId} for continuation`, 'arc3');
    } else {
      // Fresh start: open new scorecard with educational metadata tags
      const scorecardTags = [
        'arc-explainer',
        'educational-playground',  // Mark as educational, not official competition entry
        'interactive-agent',         // User can interrupt/guide mid-game
        `model:${config.model ?? DEFAULT_MODEL}`,
        `reasoning:${config.reasoningEffort ?? 'low'}`,
      ];

      scorecardId = await this.apiClient.openScorecard(
        scorecardTags,
        'https://github.com/arc-explainer/arc-explainer',
        {
          source: 'arc-explainer',
          mode: 'educational-interactive',
          game_id: gameId,
          agentName,
          userInterruptible: true,
          reasoningLevel: config.reasoningEffort ?? 'low',
        }
      );
      logger.info(`[ARC3 STREAMING] Opened new scorecard ${scorecardId} for fresh game`, 'arc3');
    }

    let gameGuid: string | null = null;
    let currentFrame: FrameData | null = null;
    let prevFrame: FrameData | null = null;
    const frames: FrameData[] = [];
    let dbSessionId: number | null = null;
    let isContinuation = false;

    // Start a fresh session OR continue an existing one
    // CRITICAL: When continuing, we MUST have a seed frame - we can't execute actions to "fetch" state
    const initialFrame = config.existingGameGuid
      ? this.validateContinuationFrame(config.seedFrame, gameId, config.existingGameGuid)
      : await this.apiClient.startGame(gameId, undefined, scorecardId);

    gameGuid = initialFrame.guid;
    isContinuation = !!config.existingGameGuid;

    // CRITICAL FIX: Unpack initial frame if it's an animation (4D array)
    const unpackedInitialFrames = unpackFrames(initialFrame);
    if (unpackedInitialFrames.length > 1) {
      logger.info(
        `[ARC3 STREAMING] Initial RESET returned ${unpackedInitialFrames.length} animation frames: ` +
        summarizeFrameStructure(initialFrame),
        'arc3'
      );
    }

    currentFrame = unpackedInitialFrames[unpackedInitialFrames.length - 1]; // Final frame is settled state
    frames.push(...unpackedInitialFrames); // Add all unpacked frames

    // Create database session for frame persistence (only for new games)
    let currentFrameNumber = 0;
    try {
      if (isContinuation) {
        logger.info(`[ARC3 STREAMING] Continuing game session ${gameGuid} on game ${gameId}`, 'arc3');
      } else {
        dbSessionId = await createSession(gameId, gameGuid, currentFrame.win_score);

        // Persist all unpacked initial frames
        currentFrameNumber = await this.persistUnpackedFrames(
          dbSessionId,
          unpackedInitialFrames,
          { action: 'RESET' },
          null,
          0
        );

        logger.info(
          `Created streaming session ${dbSessionId} for game ${gameId} ` +
          `(${unpackedInitialFrames.length} initial frame(s))`,
          'arc3'
        );
      }
    } catch (error) {
      logger.warn(`Failed to create database session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    }

    // Emit all initial frames to streaming clients
    for (let i = 0; i < unpackedInitialFrames.length; i++) {
      const frame = unpackedInitialFrames[i];
      const isLastFrame = i === unpackedInitialFrames.length - 1;
      let caption = isContinuation
        ? `Continuing game session ${gameGuid}`
        : generateActionCaption({ action: 'RESET' }, null, frame);

      if (unpackedInitialFrames.length > 1) {
        caption += ` (frame ${i + 1}/${unpackedInitialFrames.length})`;
      }

      streamHarness.emitEvent("game.started", {
        initialFrame: frame,
        frameIndex: String(i),
        caption,
        isAnimation: unpackedInitialFrames.length > 1,
        animationFrame: i,
        animationTotalFrames: unpackedInitialFrames.length,
        isLastAnimationFrame: isLastFrame,
        isContingation: isContinuation,
        timestamp: Date.now(),
      });
    }

    // Add reasoning accumulator to track incremental reasoning content
    const streamState = {
      accumulatedReasoning: "",
      reasoningSequence: 0,
    };
    let noScoreProgressStreak = 0;
    const updateNoScoreProgress = (prev: FrameData | null, curr: FrameData | null) => {
      if (!prev || !curr) return;
      if (curr.score === prev.score) {
        noScoreProgressStreak += 1;
        if (noScoreProgressStreak === 5) {
          streamHarness.emitEvent("agent.loop_hint", {
            message: "Score has not changed across 5 actions. Try an alternate strategy.",
            score: curr.score,
            action_counter: curr.action_counter,
            state: curr.state,
            timestamp: Date.now(),
          });
        }
      } else {
        noScoreProgressStreak = 0;
      }
    };

    // Emit agent starting event
    streamHarness.emitEvent("agent.starting", {
      gameId,
      agentName,
      maxTurns,
      timestamp: Date.now(),
    });

    const inspectTool = tool({
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
        logger.info(`[ARC3 TOOL STREAM] inspect_game_state called with note: "${input.note}"`, 'arc3');

        if (!currentFrame) {
          logger.error('[ARC3 TOOL STREAM] ERROR: currentFrame is null!', 'arc3');
          throw new Error('Game session not initialized yet.');
        }

        // Emit tool call event
        streamHarness.emitEvent("agent.tool_call", {
          tool: 'inspect_game_state',
          arguments: input,
          timestamp: Date.now(),
        });

        // Normalize frame data to a 3D layer stack for rendering
        const layerStack = extractLayerStack(currentFrame);

        // Generate base64 PNG image of the current frame
        const imageResult = await renderArc3FrameToPng(layerStack);
        const frameImage = imageResult?.dataUrl ?? null;
        if (frameImage) {
          logger.info(`[ARC3 TOOL STREAM] Generated frame image: ${imageResult!.width}x${imageResult!.height}px`, 'arc3');
        } else {
          logger.warn('[ARC3 TOOL STREAM] Failed to generate frame image, returning numeric data only', 'arc3');
        }

        // Calculate color distribution from the latest 2D layer
        const grid2D = extractGrid(currentFrame);
        const colorDistribution = calculateColorDistribution(grid2D);

        // Analyze changes since previous frame
        const changes = analyzeFrameChanges(prevFrame, currentFrame);

        // Return visual representation and analysis (no raw grid - use analyze_grid for that)
        const result = {
          gameGuid: currentFrame.guid,
          gameId: currentFrame.game_id,
          frameImage,  // Base64 PNG data URL - THIS is what you should look at
          colorDistribution,  // Quick summary of which colors exist
          changes,  // What changed since last action - critical for understanding effects
          score: currentFrame.score,
          state: currentFrame.state,
          action_counter: currentFrame.action_counter,
          max_actions: currentFrame.max_actions,
          win_score: currentFrame.win_score,
          note: input.note ?? null,
        };

        logger.info(
          `[ARC3 TOOL STREAM] inspect_game_state returning: state=${result.state}, score=${result.score}, ` +
          `actions=${result.action_counter}/${result.max_actions}, colors=${colorDistribution.length}, ` +
          `changes=${changes?.pixelsChanged ?? 'N/A'}`,
          'arc3'
        );

        // Emit tool result event
        streamHarness.emitEvent("agent.tool_result", {
          tool: 'inspect_game_state',
          result,
          timestamp: Date.now(),
        });

        return result;
      },
    });

    const analyzeGridTool = tool({
      name: 'analyze_grid',
      description: 'Execute Python code to analyze the current game grid programmatically. The code runs in a sandboxed environment with numpy, scipy.ndimage available. You have access to: `grid` (3D numpy array of all layers), `current_layer` (2D array of latest layer), and helper functions: find_connected_components(layer, color=None), detect_symmetry(layer), get_bounding_box(layer, exclude_color=0), color_counts(layer). Use print() to output results - stdout is captured and returned. 10 second timeout.',
      parameters: z.object({
        code: z
          .string()
          .min(5)
          .max(4000)
          .describe('Python code to execute. Must use print() to output results. Has access to grid, current_layer, numpy (as np), and scipy.ndimage.'),
        note: z
          .string()
          .max(120)
          .nullable()
          .describe('Optional note explaining the purpose of this analysis.'),
      }),
      execute: async ({ code, note }) => {
        logger.info(`[ARC3 TOOL STREAM] analyze_grid called with note: "${note}"`, 'arc3');

        if (!currentFrame) {
          throw new Error('Game session not initialized yet.');
        }

        streamHarness.emitEvent("agent.tool_call", {
          tool: 'analyze_grid',
          arguments: { code: code.slice(0, 200) + '...', note },
          timestamp: Date.now(),
        });

        const gridStack = extractLayerStack(currentFrame);
        const result = await executeGridAnalysis(gridStack, code);

        const toolResult = {
          success: result.success,
          output: result.output,
          error: result.error,
          executionTimeMs: result.executionTimeMs,
          note: note ?? null,
        };

        logger.info(
          `[ARC3 TOOL STREAM] analyze_grid completed: success=${result.success}, ` +
          `time=${result.executionTimeMs}ms, output_length=${result.output.length}`,
          'arc3'
        );

        streamHarness.emitEvent("agent.tool_result", {
          tool: 'analyze_grid',
          result: toolResult,
          timestamp: Date.now(),
        });

        return toolResult;
      },
    });

    const simpleAction = (name: 'ACTION1'|'ACTION2'|'ACTION3'|'ACTION4'|'ACTION5') => tool({
      name,
      description: `Send simple input ${name}.`,
      parameters: z.object({}),
      execute: async () => {
        logger.info(`[ARC3 TOOL STREAM] ${name} called`, 'arc3');
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        streamHarness.emitEvent("agent.tool_call", { tool: name, arguments: {}, timestamp: Date.now() });

        const reasoningPayload = streamState.accumulatedReasoning
          ? {
              type: 'agent_reasoning',
              agentName,
              game_id: gameId,
              gameGuid,
              step: frames.length,
              text: streamState.accumulatedReasoning.slice(0, 8000),
            }
          : undefined;

        prevFrame = currentFrame;
        const actionFrameData = await this.apiClient.executeAction(gameId, gameGuid, { action: name }, reasoningPayload, scorecardId);

        // CRITICAL FIX: Unpack animation frames from action response
        const unpackedActionFrames = unpackFrames(actionFrameData);
        if (unpackedActionFrames.length > 1) {
          logger.info(
            `[ARC3 TOOL STREAM] ${name} returned ${unpackedActionFrames.length} animation frames`,
            'arc3'
          );
        }

        currentFrame = unpackedActionFrames[unpackedActionFrames.length - 1]; // Final frame is settled
        frames.push(...unpackedActionFrames); // Add all unpacked frames
        logger.info(
          `[ARC3 TOOL STREAM] ${name} executed: state=${currentFrame.state}, score=${currentFrame.score} ` +
          `(${unpackedActionFrames.length} frame(s))`,
          'arc3'
        );

        // Persist unpacked action frames and emit each to stream
        if (dbSessionId && prevFrame) {
          currentFrameNumber = await this.persistUnpackedFrames(
            dbSessionId,
            unpackedActionFrames,
            { action: name },
            prevFrame,
            currentFrameNumber
          );
        }

        // Emit each unpacked frame as separate update event
        for (let i = 0; i < unpackedActionFrames.length; i++) {
          const frame = unpackedActionFrames[i];
          const isLastFrame = i === unpackedActionFrames.length - 1;
          let caption = generateActionCaption({ action: name }, prevFrame, frame);
          if (unpackedActionFrames.length > 1) {
            caption += ` (frame ${i + 1}/${unpackedActionFrames.length})`;
          }

          streamHarness.emitEvent("game.frame_update", {
            frameIndex: String(currentFrameNumber - unpackedActionFrames.length + i),
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

        return currentFrame;
      }
    });

    const action6Tool = tool({
      name: 'ACTION6',
      description: 'Send complex input with coordinates (Click/Point).',
      parameters: z.object({ x: z.number().int(), y: z.number().int() }),
      execute: async ({ x, y }) => {
        logger.info(`[ARC3 TOOL STREAM] ACTION6 called with coordinates: (${x}, ${y})`, 'arc3');
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        streamHarness.emitEvent("agent.tool_call", { tool: 'ACTION6', arguments: { x, y }, timestamp: Date.now() });

        const reasoningPayload = streamState.accumulatedReasoning
          ? {
              type: 'agent_reasoning',
              agentName,
              game_id: gameId,
              gameGuid,
              step: frames.length,
              text: streamState.accumulatedReasoning.slice(0, 8000),
            }
          : undefined;

        prevFrame = currentFrame;
        const action6FrameData = await this.apiClient.executeAction(gameId, gameGuid, { action: 'ACTION6', coordinates: [x, y] }, reasoningPayload, scorecardId);

        // CRITICAL FIX: Unpack animation frames from ACTION6 response
        const unpackedAction6Frames = unpackFrames(action6FrameData);
        if (unpackedAction6Frames.length > 1) {
          logger.info(
            `[ARC3 TOOL STREAM] ACTION6 returned ${unpackedAction6Frames.length} animation frames`,
            'arc3'
          );
        }

        currentFrame = unpackedAction6Frames[unpackedAction6Frames.length - 1]; // Final frame is settled
        frames.push(...unpackedAction6Frames); // Add all unpacked frames
        logger.info(
          `[ARC3 TOOL STREAM] ACTION6(${x},${y}) executed: state=${currentFrame.state}, score=${currentFrame.score} ` +
          `(${unpackedAction6Frames.length} frame(s))`,
          'arc3'
        );

        // Persist unpacked ACTION6 frames and emit each to stream
        if (dbSessionId && prevFrame) {
          currentFrameNumber = await this.persistUnpackedFrames(
            dbSessionId,
            unpackedAction6Frames,
            { action: 'ACTION6', coordinates: [x, y] },
            prevFrame,
            currentFrameNumber
          );
        }

        // Emit each unpacked frame as separate update event
        for (let i = 0; i < unpackedAction6Frames.length; i++) {
          const frame = unpackedAction6Frames[i];
          const isLastFrame = i === unpackedAction6Frames.length - 1;
          let caption = generateActionCaption({ action: 'ACTION6', coordinates: [x, y] }, prevFrame, frame);
          if (unpackedAction6Frames.length > 1) {
            caption += ` (frame ${i + 1}/${unpackedAction6Frames.length})`;
          }

          streamHarness.emitEvent("game.frame_update", {
            frameIndex: String(currentFrameNumber - unpackedAction6Frames.length + i),
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

        return currentFrame;
      }
    });

    const selectSystemPrompt = (): string => {
      const explicit = config.systemPrompt?.trim() || '';
      const skipDefault = config.skipDefaultSystemPrompt === true;

      if (skipDefault) {
        return explicit;
      }

      if (explicit) {
        return explicit;
      }

      return buildArc3DefaultPrompt();
    };

    const baseSystemPrompt = selectSystemPrompt();
    const operatorGuidance = config.instructions?.trim();
    const combinedInstructions = operatorGuidance
      ? (baseSystemPrompt
          ? `${baseSystemPrompt}\n\nOperator guidance: ${operatorGuidance}`
          : operatorGuidance)
      : baseSystemPrompt || '';

    const storeResponse = config.storeResponse ?? true;
    const frameHash = currentFrame ? this.computeFrameHash(extractLayerStack(currentFrame)) : undefined;
    const metadata = {
      sessionId: config.sessionId,
      gameGuid: gameGuid || undefined,
      frameHash,
      frameIndex: String(frames.length - 1),
      previousResponseId: config.previousResponseId ?? null,
      systemPromptPresetId: config.systemPromptPresetId ?? null,
      skipDefaultSystemPrompt: String(config.skipDefaultSystemPrompt ?? false),
    };

    const agent = new Agent({
      name: agentName,
      instructions: combinedInstructions,
      handoffDescription: 'Operates the ARC-AGI-3 real game interface.',
      model: config.model ?? DEFAULT_MODEL,
      modelSettings: {
        reasoning: {
          effort: (config.reasoningEffort ?? 'high') as 'minimal' | 'low' | 'medium' | 'high',
          summary: 'detailed',
        },
        text: { verbosity: 'medium' },
        store: storeResponse,
        providerData: {
          metadata,
        },
      },
      tools: [inspectTool, analyzeGridTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
    });

    // Emit agent ready event
    streamHarness.emitEvent("agent.ready", {
      agentName,
      model: config.model ?? DEFAULT_MODEL,
      instructions: combinedInstructions,
      timestamp: Date.now(),
    });

    // Use streaming mode for the agent run
    const result = await run(
      agent,
      `Start playing the ARC-AGI-3 game "${gameId}". Narrate before every tool call, then execute it. Keep using the What I see / What it means / Next move format until you deliver the Final Report.`,
      {
        maxTurns,
        stream: true,
        previousResponseId: config.previousResponseId,
      },
    );

    // Process streaming events
    for await (const event of result) {
      switch (event.type) {
        case 'raw_model_stream_event':
          {
            const eventData = event.data;

            // The Agents SDK wraps Responses API events in event.data.event
            // when event.data.type === 'model'
            if (eventData.type === 'model') {
              const modelEvent = (eventData as any).event;

              // Handle reasoning deltas - extract from nested event structure
              if (modelEvent?.type === 'response.reasoning_text.delta') {
                const delta = modelEvent.delta ?? "";
                streamState.accumulatedReasoning += delta;
                streamState.reasoningSequence++;

                streamHarness.emitEvent("agent.reasoning", {
                  delta,
                  content: streamState.accumulatedReasoning,
                  sequence: streamState.reasoningSequence,
                  contentIndex: modelEvent.content_index,
                  timestamp: Date.now(),
                });
              }

              // Handle reasoning completion
              if (modelEvent?.type === 'response.reasoning_text.done') {
                const finalContent = modelEvent.text ?? streamState.accumulatedReasoning;
                streamState.accumulatedReasoning = finalContent;

                streamHarness.emitEvent("agent.reasoning_complete", {
                  finalContent,
                  timestamp: Date.now(),
                });
              }
            }

            // Forward raw model events (for debugging/logging)
            streamHarness.emitEvent("model.stream_event", {
              eventType: event.data.type,
              data: event.data,
              timestamp: Date.now(),
            });
          }
          break;
        case 'run_item_stream_event':
          {
            const { item } = event;
            const timestamp = Date.now();

            switch (item.type) {
              case 'message_output_item':
                streamHarness.emitEvent('agent.message', {
                  agentName: item.agent.name,
                  content: item.content,
                  timestamp,
                });
                break;
              case 'reasoning_item':
                // Reasoning deltas already handled via raw_model_stream_event; keep UI updated with latest aggregate
                streamHarness.emitEvent('agent.reasoning', {
                  content: streamState.accumulatedReasoning,
                  timestamp,
                });
                break;
              case 'tool_call_item':
                streamHarness.emitEvent('agent.tool_call', {
                  tool: 'name' in item.rawItem ? item.rawItem.name : item.rawItem.type,
                  arguments: 'arguments' in item.rawItem ? item.rawItem.arguments : undefined,
                  timestamp,
                });
                break;
              case 'tool_call_output_item':
                streamHarness.emitEvent('agent.tool_result', {
                  tool: item.rawItem.type,
                  result: item.output ?? item.rawItem.output ?? item.rawItem,
                  timestamp,
                });
                break;
              default:
                streamHarness.emitEvent('agent.run_item', {
                  itemName: event.name,
                  item,
                  timestamp,
                });
                break;
            }
          }
          break;
        case 'agent_updated_stream_event':
          // Forward agent updates
          streamHarness.emitEvent("agent.updated", {
            agent: event.agent,
            timestamp: Date.now(),
          });
          break;
      }
    }

    // Process final timeline entries using extracted utility (eliminates duplication)
    const timeline = processRunItemsWithReasoning(result.newItems, agentName, streamState.accumulatedReasoning);

    // Close scorecard when game reaches terminal state (per audit: must close after WIN/GAME_OVER)
    // Sessions remain open for continuations ONLY if game is still in progress
    if (currentFrame && (currentFrame.state === 'WIN' || currentFrame.state === 'GAME_OVER')) {
      try {
        await this.apiClient.closeScorecard(scorecardId);
        logger.info(`[ARC3 STREAMING] Closed scorecard ${scorecardId} - game ended with ${currentFrame.state}`, 'arc3');
        streamHarness.emitEvent("scorecard.closed", {
          scorecardId,
          finalState: currentFrame.state,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.warn(`[ARC3 STREAMING] Failed to close scorecard ${scorecardId}: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
      }
    }

    const usage = result.state._context.usage;
    const finalOutputCandidate = result.finalOutput;
    const finalOutput = typeof finalOutputCandidate === 'string'
      ? finalOutputCandidate
      : extractAllTextOutput(result.newItems);

    // Map ARC3 API state strings to Arc3GameState type
    const mapState = (state: string): Arc3GameState => {
      if (state === 'NOT_PLAYED') return 'NOT_PLAYED';
      if (state === 'IN_PROGRESS') return 'IN_PROGRESS';
      if (state === 'WIN') return 'WIN';
      if (state === 'GAME_OVER') return 'GAME_OVER';
      if (state === 'NOT_FINISHED') return 'NOT_FINISHED';  // Game incomplete but not over
      // If we get an unexpected state, throw an error
      throw new Error(`Unexpected game state from ARC3 API: ${state}`);
    };

    // Create summary from the last frame (should always exist since we start the game before agent runs)
    if (currentFrame === null) {
      throw new Error('No frame data available - game did not start properly');
    }

    const cf = currentFrame as FrameData;
    const summary: Arc3RunSummary = {
      state: mapState(cf.state),
      score: cf.score,
      stepsTaken: cf.action_counter ?? Math.max(0, frames.length - 1),
      simpleActionsUsed: [],  // ARC3 doesn't track this the same way
      coordinateGuesses: 0,  // ARC3 doesn't track this separately
      scenarioId: gameId,
      scenarioName: gameId,  // Use gameId as name for now
    };

    const generatedRunId = randomUUID();
    const providerResponseId = result.lastResponseId ?? null;

    // Emit completion event with scorecard ID for session continuation
    streamHarness.emitEvent("agent.completed", {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',  // Include game session guid for continuation
      scorecardId,  // CRITICAL: Include scorecard ID for continuation requests
      finalOutput,
      summary,
      usage: {
        requests: usage.requests,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      timelineLength: timeline.length,
      frameCount: frames.length,
      providerResponseId,
      timestamp: Date.now(),
    });

    return {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',
      scorecardId,  // CRITICAL: Return scorecard ID for session continuation
      finalOutput: finalOutput?.trim() ? finalOutput.trim() : undefined,
      timeline,
      frames: frames as any[],  // Arc3AgentRunResult accepts any[] for frames
      summary,
      usage: {
        requests: usage.requests,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      providerResponseId,
    };
  }
}
