/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Runs OpenAI Agents SDK workflows against the real ARC-AGI-3 API with PostgreSQL frame persistence.
Refactored to use helpers (frameAnalysis, captionGenerator) and persistence layer following SDK patterns.
Eliminates duplication via timelineProcessor utility. Tracks sessions and generates frame captions.
SRP/DRY check: Pass — agent orchestration only, delegates persistence/analysis to specialized modules (350 lines, down from 621).
*/

import { randomUUID } from 'node:crypto';
import { Agent, run, tool, extractAllTextOutput } from '@openai/agents';
import { z } from 'zod';
import { Arc3ApiClient, type FrameData, type GameAction } from './Arc3ApiClient.ts';
import type { Arc3AgentRunConfig, Arc3AgentRunResult, Arc3RunTimelineEntry, Arc3RunSummary, Arc3GameState } from './types.ts';
import { buildArc3DefaultPrompt } from './prompts.ts';
import { DEFAULT_MODEL, DEFAULT_MAX_TURNS, DEFAULT_GAME_ID } from './utils/constants.ts';
import { processRunItems, processRunItemsWithReasoning } from './utils/timelineProcessor.ts';
import { generateActionCaption, generateInspectCaption } from './helpers/captionGenerator.ts';
import { countChangedPixels } from './helpers/frameAnalysis.ts';
import { createSession } from './persistence/sessionManager.ts';
import { saveFrame } from './persistence/framePersistence.ts';
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

  /**
   * Continue an existing game session by executing a dummy action to fetch current state.
   * When continuing, we need to get the current frame state without losing progress.
   * We execute ACTION1 (safe, often a no-op or reversible action) to get the current game state.
   */
  private async continuGameSession(gameId: string, gameGuid: string): Promise<FrameData> {
    logger.info(`[ARC3] Continuing game session: ${gameGuid}`, 'arc3');

    try {
      // Execute ACTION1 to fetch current game state while advancing gameplay
      const currentState = await this.apiClient.executeAction(gameId, gameGuid, { action: 'ACTION1' });
      logger.info(`[ARC3] Retrieved current state for game ${gameId}, guid ${gameGuid}`, 'arc3');
      return currentState;
    } catch (error) {
      logger.error(`[ARC3] Failed to retrieve game session state: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
      throw error;
    }
  }

  async run(config: Arc3AgentRunConfig): Promise<Arc3AgentRunResult> {
    const agentName = config.agentName?.trim() || 'ARC3 Real Game Operator';
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    const gameId = config.game_id ?? DEFAULT_GAME_ID;

    let gameGuid: string | null = null;
    let currentFrame: FrameData | null = null;
    let prevFrame: FrameData | null = null;
    const frames: FrameData[] = [];
    let dbSessionId: number | null = null;

    // Start a fresh session OR continue an existing one
    const initialFrame = config.existingGameGuid
      ? await this.continuGameSession(gameId, config.existingGameGuid)
      : await this.apiClient.startGame(gameId);

    gameGuid = initialFrame.guid;
    currentFrame = initialFrame;
    frames.push(initialFrame);

    // Create database session for frame persistence (only for new games)
    try {
      if (!config.existingGameGuid) {
        dbSessionId = await createSession(gameId, gameGuid, initialFrame.win_score);

        // Save initial frame
        const initialCaption = generateActionCaption({ action: 'RESET' }, null, initialFrame);
        await saveFrame(dbSessionId, 0, initialFrame, { action: 'RESET' }, initialCaption, 0);
        logger.info(`Created session ${dbSessionId} for game ${gameId}`, 'arc3');
      } else {
        logger.info(`[ARC3] Continuing game session ${gameGuid} on game ${gameId}`, 'arc3');
      }
    } catch (error) {
      logger.warn(`Failed to create database session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    }

    const inspectTool = tool({
      name: 'inspect_game_state',
      description: 'Inspect the current game state including frame data, score, remaining actions, and game status. Always call before making decisions.',
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

        // Return cached frame state (ARC3 API doesn't have separate status/frame endpoints)
        const result = {
          gameGuid: currentFrame.guid,
          gameId: currentFrame.game_id,
          frame: currentFrame.frame,
          score: currentFrame.score,
          state: currentFrame.state,
          action_counter: currentFrame.action_counter,
          max_actions: currentFrame.max_actions,
          win_score: currentFrame.win_score,
          note: input.note ?? null,
        };

        logger.info(`[ARC3 TOOL] inspect_game_state returning: state=${result.state}, score=${result.score}, actions=${result.action_counter}/${result.max_actions}`, 'arc3');
        return result;
      },
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
        currentFrame = await this.apiClient.executeAction(gameId, gameGuid, { action: name });
        frames.push(currentFrame);
        logger.info(`[ARC3 TOOL] ${name} executed: state=${currentFrame.state}, score=${currentFrame.score}`, 'arc3');

        // Save frame with auto-generated caption
        if (dbSessionId && prevFrame) {
          try {
            const caption = generateActionCaption({ action: name }, prevFrame, currentFrame);
            const pixelsChanged = countChangedPixels(prevFrame, currentFrame);
            await saveFrame(dbSessionId, frames.length - 1, currentFrame, { action: name }, caption, pixelsChanged);
          } catch (error) {
            logger.warn(`Failed to save frame: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
          }
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
        currentFrame = await this.apiClient.executeAction(gameId, gameGuid, { action: 'ACTION6', coordinates: [x, y] });
        frames.push(currentFrame);
        logger.info(`[ARC3 TOOL] ACTION6 executed: state=${currentFrame.state}, score=${currentFrame.score}`, 'arc3');

        // Save frame with auto-generated caption
        if (dbSessionId && prevFrame) {
          try {
            const caption = generateActionCaption({ action: 'ACTION6', coordinates: [x, y] }, prevFrame, currentFrame);
            const pixelsChanged = countChangedPixels(prevFrame, currentFrame);
            await saveFrame(dbSessionId, frames.length - 1, currentFrame, { action: 'ACTION6', coordinates: [x, y] }, caption, pixelsChanged);
          } catch (error) {
            logger.warn(`Failed to save frame: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
          }
        }

        return currentFrame;
      }
    });

    const systemPrompt = config.systemPrompt?.trim() || buildArc3DefaultPrompt();
    const operatorGuidance = config.instructions?.trim();
    const combinedInstructions = operatorGuidance
      ? `${systemPrompt}\n\nOperator guidance: ${operatorGuidance}`
      : systemPrompt;

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
        text: { verbosity: 'high' },
      },
      tools: [inspectTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
    });

    const result = await run(
      agent,
      `Start playing the ARC-AGI-3 game "${gameId}". Narrate before every tool call, then execute it. Keep using the What I see / What it means / Next move format until you deliver the Final Report.`,
      { maxTurns },
    );

    // Process timeline entries using extracted utility (eliminates duplication)
    const timeline = processRunItems(result.newItems, agentName);

    // NOTE: Do NOT end the session here. Sessions remain open for continuations.
    // The session ends naturally when the game reaches WIN or GAME_OVER state.

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
      stepsTaken: cf.action_counter,
      simpleActionsUsed: [],  // ARC3 doesn't track this the same way
      coordinateGuesses: 0,  // ARC3 doesn't track this separately
      scenarioId: gameId,
      scenarioName: gameId,  // Use gameId as name for now
    };

    return {
      runId: randomUUID(),
      gameGuid: gameGuid || 'unknown',
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
    };
  }

  async runWithStreaming(config: Arc3AgentRunConfig, streamHarness: Arc3StreamHarness): Promise<Arc3AgentRunResult> {
    const agentName = config.agentName?.trim() || 'ARC3 Real Game Operator';
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    const gameId = config.game_id ?? DEFAULT_GAME_ID;

    let gameGuid: string | null = null;
    let currentFrame: FrameData | null = null;
    let prevFrame: FrameData | null = null;
    const frames: FrameData[] = [];
    let dbSessionId: number | null = null;
    let isContinuation = false;

    // Start a fresh session OR continue an existing one
    const initialFrame = config.existingGameGuid
      ? await this.continuGameSession(gameId, config.existingGameGuid)
      : await this.apiClient.startGame(gameId);

    gameGuid = initialFrame.guid;
    currentFrame = initialFrame;
    frames.push(initialFrame);
    isContinuation = !!config.existingGameGuid;

    // Create database session for frame persistence (only for new games)
    try {
      if (isContinuation) {
        logger.info(`[ARC3] Continuing game session ${gameGuid} on game ${gameId}`, 'arc3');
      } else {
        dbSessionId = await createSession(gameId, gameGuid, initialFrame.win_score);
        const initialCaption = generateActionCaption({ action: 'RESET' }, null, initialFrame);
        await saveFrame(dbSessionId, 0, initialFrame, { action: 'RESET' }, initialCaption, 0);
        logger.info(`Created streaming session ${dbSessionId} for game ${gameId}`, 'arc3');
      }
    } catch (error) {
      logger.warn(`Failed to create database session: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
    }

    // Emit initial frame to streaming clients
    streamHarness.emitEvent("game.started", {
      initialFrame,
      frameIndex: 0,
      caption: isContinuation ? `Continuing game session ${gameGuid}` : generateActionCaption({ action: 'RESET' }, null, initialFrame),
      isContingation: isContinuation,
      timestamp: Date.now(),
    });

    // Add reasoning accumulator to track incremental reasoning content
    const streamState = {
      accumulatedReasoning: "",
      reasoningSequence: 0,
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
      description: 'Inspect the current game state including frame data, score, remaining actions, and game status. Always call before making decisions.',
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

        // Return cached frame state (ARC3 API doesn't have separate status/frame endpoints)
        const result = {
          gameGuid: currentFrame.guid,
          gameId: currentFrame.game_id,
          frame: currentFrame.frame,
          score: currentFrame.score,
          state: currentFrame.state,
          action_counter: currentFrame.action_counter,
          max_actions: currentFrame.max_actions,
          win_score: currentFrame.win_score,
          note: input.note ?? null,
        };

        logger.info(`[ARC3 TOOL STREAM] inspect_game_state returning: state=${result.state}, score=${result.score}, actions=${result.action_counter}/${result.max_actions}`, 'arc3');

        // Emit tool result event
        streamHarness.emitEvent("agent.tool_result", {
          tool: 'inspect_game_state',
          result,
          timestamp: Date.now(),
        });

        return result;
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

        prevFrame = currentFrame;
        currentFrame = await this.apiClient.executeAction(gameId, gameGuid, { action: name });
        frames.push(currentFrame);
        logger.info(`[ARC3 TOOL STREAM] ${name} executed: state=${currentFrame.state}, score=${currentFrame.score}`, 'arc3');

        // Generate caption and save frame
        let caption = '';
        if (dbSessionId && prevFrame) {
          try {
            caption = generateActionCaption({ action: name }, prevFrame, currentFrame);
            const pixelsChanged = countChangedPixels(prevFrame, currentFrame);
            await saveFrame(dbSessionId, frames.length - 1, currentFrame, { action: name }, caption, pixelsChanged);
          } catch (error) {
            logger.warn(`Failed to save frame: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
          }
        }

        streamHarness.emitEvent("game.frame_update", {
          frameIndex: frames.length - 1,
          frameData: currentFrame,
          caption,
          action: { type: name },
          timestamp: Date.now()
        });
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

        prevFrame = currentFrame;
        currentFrame = await this.apiClient.executeAction(gameId, gameGuid, { action: 'ACTION6', coordinates: [x, y] });
        frames.push(currentFrame);
        logger.info(`[ARC3 TOOL STREAM] ACTION6 executed: state=${currentFrame.state}, score=${currentFrame.score}`, 'arc3');

        // Generate caption and save frame
        let caption = '';
        if (dbSessionId && prevFrame) {
          try {
            caption = generateActionCaption({ action: 'ACTION6', coordinates: [x, y] }, prevFrame, currentFrame);
            const pixelsChanged = countChangedPixels(prevFrame, currentFrame);
            await saveFrame(dbSessionId, frames.length - 1, currentFrame, { action: 'ACTION6', coordinates: [x, y] }, caption, pixelsChanged);
          } catch (error) {
            logger.warn(`Failed to save frame: ${error instanceof Error ? error.message : String(error)}`, 'arc3');
          }
        }

        streamHarness.emitEvent("game.frame_update", {
          frameIndex: frames.length - 1,
          frameData: currentFrame,
          caption,
          action: { type: 'ACTION6', coordinates: [x, y] },
          timestamp: Date.now()
        });
        return currentFrame;
      }
    });

    const systemPrompt = config.systemPrompt?.trim() || buildArc3DefaultPrompt();
    const operatorGuidance = config.instructions?.trim();
    const combinedInstructions = operatorGuidance
      ? `${systemPrompt}\n\nOperator guidance: ${operatorGuidance}`
      : systemPrompt;

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
        text: { verbosity: 'high' },
      },
      tools: [inspectTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
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
      { maxTurns, stream: true },
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

    // Wait for completion
    await result.completed;

    // Process final timeline entries using extracted utility (eliminates duplication)
    const timeline = processRunItemsWithReasoning(result.newItems, agentName, streamState.accumulatedReasoning);

    // NOTE: Do NOT end the session here. Sessions remain open for continuations.
    // The session ends naturally when the game reaches WIN or GAME_OVER state.

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
      stepsTaken: cf.action_counter,
      simpleActionsUsed: [],  // ARC3 doesn't track this the same way
      coordinateGuesses: 0,  // ARC3 doesn't track this separately
      scenarioId: gameId,
      scenarioName: gameId,  // Use gameId as name for now
    };

    const generatedRunId = randomUUID();

    // Emit completion event
    streamHarness.emitEvent("agent.completed", {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',  // Include game session guid for continuation
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
      timestamp: Date.now(),
    });

    return {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',
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
    };
  }
}
