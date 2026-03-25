/*
Author: Claude Sonnet 4.6 (Bubba)
Date: 25-March-2026
PURPOSE: Runs a direct LLM call loop against the real ARC-AGI-3 API with PostgreSQL frame persistence.
         Removed @openai/agents SDK dependency (Step 4 of ARC3 modernization). LLM calls now go through
         llmCaller.ts which routes by model prefix. Tools are no longer needed — LLM reads game state
         from the prompt and returns JSON actions directly.
SRP/DRY check: Pass — runner orchestrates the game loop; LLM routing is in llmCaller.ts; prompt building in runHelpers.ts; frame persistence in sessionManager/framePersistence.

CHANGES FROM PREVIOUS VERSION (Step 4 — 2026-03-25):
- Removed: import { Agent, run, extractAllTextOutput } from '@openai/agents'
- Removed: Arc3ToolFactory / createArc3Tools usage (tools no longer needed)
- Removed: processRunItems / processRunItemsWithReasoning (timeline built directly in loop)
- Added: callLLM() from llmCaller.ts — direct prompt→response loop
- Added: anthropicApiKey?: string on Arc3AgentRunConfig (BYOK support)
- Both run() and runWithStreaming() now use the same direct LLM loop
- runWithStreaming() SSE emission logic preserved; emits per-turn events during loop
*/

import { randomUUID, createHash } from 'node:crypto';
import { Arc3ApiClient, type FrameData, type GameAction } from './Arc3ApiClient.ts';
import type { Arc3AgentRunConfig, Arc3AgentRunResult, Arc3RunTimelineEntry, Arc3RunSummary, Arc3GameState } from './types.ts';
import { buildArc3DefaultPrompt } from './prompts.ts';
import { DEFAULT_MODEL, DEFAULT_MAX_TURNS, DEFAULT_GAME_ID } from './utils/constants.ts';
import { generateActionCaption } from './helpers/captionGenerator.ts';
import { countChangedPixels, extractLayerStack } from './helpers/frameAnalysis.ts';
import { unpackFrames, summarizeFrameStructure } from './helpers/frameUnpacker.ts';
import { createSession, endSession, type SessionMetadata } from './persistence/sessionManager';
import { saveFrame, type SavedFrame } from './persistence/framePersistence';
import { openScorecard, closeScorecard, getScorecard } from './scorecardService.ts';
import { renderArc3FrameToPng } from './arc3GridImageService.ts';
import { executeGridAnalysis } from './helpers/gridAnalyzer.ts';
import { logger } from '../../utils/logger.ts';
import { buildCombinedInstructions, buildRunSummary } from './helpers/runHelpers.ts';
import { callLLM } from './llmCaller.ts';

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
        dbSessionId = await createSession(gameId, gameGuid, currentFrame.win_score, scorecardId);

        // Persist all unpacked initial frames
        currentFrameNumber = await this.persistUnpackedFrames(
          dbSessionId,
          unpackedInitialFrames,
          { action: 'RESET' },
          null,
          0
        );

        logger.info(
          `Created session ${dbSessionId} for game ${gameId} (scorecard: ${scorecardId}) ` +
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

    // --- Direct LLM call loop (replaces @openai/agents Agent/run) ---
    const systemPrompt = buildCombinedInstructions(config);
    const history: Arc3RunTimelineEntry[] = [];
    let finalOutput = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalRequests = 0;

    for (let turn = 0; turn < maxTurns; turn++) {
      const userMessage =
        `Current game state:\n${JSON.stringify(currentFrame, null, 2)}\n\n` +
        `You are playing ARC-AGI-3 game "${gameId}". ` +
        `Reply with ONLY a JSON object on a single line: {"action": "ACTION1"} or {"action": "ACTION3", "x": 5, "y": 3}. ` +
        `Valid actions: RESET, ACTION1, ACTION2, ACTION3, ACTION4, ACTION5, ACTION6, ACTION7. ` +
        `ACTION3-ACTION7 may require x and y coordinates (integers 0-63).`;

      let llmResult;
      try {
        llmResult = await callLLM({
          model: config.model ?? DEFAULT_MODEL,
          system: systemPrompt,
          user: userMessage,
          apiKey: (config as any).anthropicApiKey,
          maxTokens: 512,
        });
      } catch (err) {
        logger.warn(`[ARC3] LLM call failed on turn ${turn}: ${err instanceof Error ? err.message : String(err)}`, 'arc3');
        break;
      }

      totalInputTokens += llmResult.inputTokens;
      totalOutputTokens += llmResult.outputTokens;
      totalRequests += 1;

      // Parse action from LLM response (expect JSON like {"action": "ACTION1"} or {"action": "ACTION3", "x": 5, "y": 3})
      let action: GameAction;
      try {
        const match = llmResult.text.match(/\{[^}]+\}/);
        const parsed = JSON.parse(match?.[0] || '{}') as { action?: string; x?: number; y?: number };
        action = {
          action: (parsed.action || 'ACTION1') as GameAction['action'],
          ...(parsed.x !== undefined ? { x: parsed.x } : {}),
          ...(parsed.y !== undefined ? { y: parsed.y } : {}),
        };
      } catch {
        action = { action: 'ACTION1' };
      }

      history.push({
        index: turn,
        type: 'assistant_message',
        label: `Turn ${turn + 1}`,
        content: llmResult.text,
      });

      const nextFrameRaw = await this.apiClient.executeAction(gameId, gameGuid!, action, undefined);
      const unpackedFrames = unpackFrames(nextFrameRaw);
      prevFrame = currentFrame;
      currentFrame = unpackedFrames[unpackedFrames.length - 1];
      frames.push(...unpackedFrames);
      updateNoScoreProgress(prevFrame, currentFrame);

      if (dbSessionId) {
        currentFrameNumber = await this.persistUnpackedFrames(dbSessionId, unpackedFrames, action, prevFrame, currentFrameNumber);
      }

      if (currentFrame.state === 'WIN' || currentFrame.state === 'GAME_OVER') {
        finalOutput = `Game ended: ${currentFrame.state}`;
        break;
      }
    }

    // Close scorecard when game reaches terminal state (per audit: must close after WIN/GAME_OVER)
    if (currentFrame && (currentFrame.state === 'WIN' || currentFrame.state === 'GAME_OVER')) {
      try {
        await this.apiClient.closeScorecard(scorecardId);
        logger.info(`[ARC3] Closed scorecard ${scorecardId} - game ended with ${currentFrame.state}`, 'arc3');
      } catch (error) {
        logger.warn(`[ARC3] Failed to close scorecard ${scorecardId}: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
      }
    }

    if (currentFrame === null) {
      throw new Error('No frame data available - game did not start properly');
    }

    const summary = buildRunSummary(currentFrame, gameId, frames.length);

    return {
      runId: randomUUID(),
      gameGuid: gameGuid || 'unknown',
      scorecardId,
      finalOutput: finalOutput.trim() || undefined,
      timeline: history,
      frames: frames as any[],
      summary,
      usage: {
        requests: totalRequests,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
      providerResponseId: null,
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
        'educational-playground',
        'interactive-agent',
        `model:${config.model ?? DEFAULT_MODEL}`,
        `reasoning:${(config as any).reasoningEffort ?? 'low'}`,
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
          reasoningLevel: (config as any).reasoningEffort ?? 'low',
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
        dbSessionId = await createSession(gameId, gameGuid, currentFrame.win_score, scorecardId);

        // Persist all unpacked initial frames
        currentFrameNumber = await this.persistUnpackedFrames(
          dbSessionId,
          unpackedInitialFrames,
          { action: 'RESET' },
          null,
          0
        );

        logger.info(
          `Created streaming session ${dbSessionId} for game ${gameId} (scorecard: ${scorecardId}) ` +
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

    // Emit agent ready event
    const systemPrompt = buildCombinedInstructions(config);
    streamHarness.emitEvent("agent.ready", {
      agentName,
      model: config.model ?? DEFAULT_MODEL,
      instructions: systemPrompt,
      timestamp: Date.now(),
    });

    // --- Direct LLM call loop (replaces @openai/agents Agent/run + stream loop) ---
    const history: Arc3RunTimelineEntry[] = [];
    let finalOutput = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalRequests = 0;

    for (let turn = 0; turn < maxTurns; turn++) {
      const userMessage =
        `Current game state:\n${JSON.stringify(currentFrame, null, 2)}\n\n` +
        `You are playing ARC-AGI-3 game "${gameId}". ` +
        `Reply with ONLY a JSON object on a single line: {"action": "ACTION1"} or {"action": "ACTION3", "x": 5, "y": 3}. ` +
        `Valid actions: RESET, ACTION1, ACTION2, ACTION3, ACTION4, ACTION5, ACTION6, ACTION7. ` +
        `ACTION3-ACTION7 may require x and y coordinates (integers 0-63).`;

      // Emit per-turn thinking event
      streamHarness.emitEvent("agent.turn_start", {
        turn,
        score: currentFrame?.score,
        state: currentFrame?.state,
        action_counter: currentFrame?.action_counter,
        timestamp: Date.now(),
      });

      let llmResult;
      try {
        llmResult = await callLLM({
          model: config.model ?? DEFAULT_MODEL,
          system: systemPrompt,
          user: userMessage,
          apiKey: (config as any).anthropicApiKey,
          maxTokens: 512,
        });
      } catch (err) {
        logger.warn(`[ARC3 STREAMING] LLM call failed on turn ${turn}: ${err instanceof Error ? err.message : String(err)}`, 'arc3');
        streamHarness.emitEvent("agent.error", {
          turn,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        });
        break;
      }

      totalInputTokens += llmResult.inputTokens;
      totalOutputTokens += llmResult.outputTokens;
      totalRequests += 1;

      // Emit agent message
      streamHarness.emitEvent("agent.message", {
        agentName,
        content: llmResult.text,
        turn,
        timestamp: Date.now(),
      });

      // Parse action from LLM response
      let action: GameAction;
      try {
        const match = llmResult.text.match(/\{[^}]+\}/);
        const parsed = JSON.parse(match?.[0] || '{}') as { action?: string; x?: number; y?: number };
        action = {
          action: (parsed.action || 'ACTION1') as GameAction['action'],
          ...(parsed.x !== undefined ? { x: parsed.x } : {}),
          ...(parsed.y !== undefined ? { y: parsed.y } : {}),
        };
      } catch {
        action = { action: 'ACTION1' };
      }

      // Emit tool call event (for UI parity with old agent SDK events)
      streamHarness.emitEvent("agent.tool_call", {
        tool: action.action,
        arguments: action,
        turn,
        timestamp: Date.now(),
      });

      history.push({
        index: turn,
        type: 'assistant_message',
        label: `Turn ${turn + 1}`,
        content: llmResult.text,
      });

      const nextFrameRaw = await this.apiClient.executeAction(gameId, gameGuid!, action, undefined);
      const unpackedFrames = unpackFrames(nextFrameRaw);
      prevFrame = currentFrame;
      currentFrame = unpackedFrames[unpackedFrames.length - 1];
      frames.push(...unpackedFrames);
      updateNoScoreProgress(prevFrame, currentFrame);

      if (dbSessionId) {
        currentFrameNumber = await this.persistUnpackedFrames(dbSessionId, unpackedFrames, action, prevFrame, currentFrameNumber);
      }

      // Emit frame update for each unpacked animation frame
      for (let fi = 0; fi < unpackedFrames.length; fi++) {
        const isLastFrame = fi === unpackedFrames.length - 1;
        streamHarness.emitEvent("agent.tool_result", {
          tool: action.action,
          result: unpackedFrames[fi],
          animationFrame: fi,
          animationTotalFrames: unpackedFrames.length,
          isLastAnimationFrame: isLastFrame,
          turn,
          timestamp: Date.now(),
        });
      }

      if (currentFrame.state === 'WIN' || currentFrame.state === 'GAME_OVER') {
        finalOutput = `Game ended: ${currentFrame.state}`;
        break;
      }
    }

    // Close scorecard when game reaches terminal state (per audit: must close after WIN/GAME_OVER)
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

    if (currentFrame === null) {
      throw new Error('No frame data available - game did not start properly');
    }

    const summary = buildRunSummary(currentFrame, gameId, frames.length);
    const generatedRunId = randomUUID();

    // Emit completion event with scorecard ID for session continuation
    streamHarness.emitEvent("agent.completed", {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',
      scorecardId,
      finalOutput,
      summary,
      usage: {
        requests: totalRequests,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
      timelineLength: history.length,
      frameCount: frames.length,
      providerResponseId: null,
      timestamp: Date.now(),
    });

    return {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',
      scorecardId,
      finalOutput: finalOutput.trim() || undefined,
      timeline: history,
      frames: frames as any[],
      summary,
      usage: {
        requests: totalRequests,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
      providerResponseId: null,
    };
  }
}
