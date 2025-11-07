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
import { createSession, endSession } from './persistence/sessionManager.ts';
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

  async run(config: Arc3AgentRunConfig): Promise<Arc3AgentRunResult> {
    const agentName = config.agentName?.trim() || 'ARC3 Real Game Operator';
    const maxTurns = Math.max(2, Math.min(config.maxTurns ?? DEFAULT_MAX_TURNS, 400));
    const gameId = config.game_id ?? 'ls20';  // Default to LockSmith game (ls20)

    let gameGuid: string | null = null;
    let currentFrame: FrameData | null = null;
    const frames: FrameData[] = [];
    const timeline: Arc3RunTimelineEntry[] = [];

    // Start a fresh session up front so the agent only needs inspect + ACTION tools
    const initialFrame = await this.apiClient.startGame(gameId);
    gameGuid = initialFrame.guid;
    currentFrame = initialFrame;
    frames.push(initialFrame);

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
        if (!currentFrame) {
          throw new Error('Game session not initialized yet.');
        }

        // Return cached frame state (ARC3 API doesn't have separate status/frame endpoints)
        return {
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
      },
    });

    // Define individual action tools to match ARC3 reference (ACTION1-6)
    const simpleAction = (name: 'ACTION1'|'ACTION2'|'ACTION3'|'ACTION4'|'ACTION5') => tool({
      name,
      description: `Send simple input ${name}.`,
      parameters: z.object({}),
      execute: async () => {
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        currentFrame = await this.apiClient.executeAction(gameGuid, { action: name });
        frames.push(currentFrame);
        return currentFrame;
      }
    });

    const action6Tool = tool({
      name: 'ACTION6',
      description: 'Send complex input with coordinates (Click/Point).',
      parameters: z.object({ x: z.number().int(), y: z.number().int() }),
      execute: async ({ x, y }) => {
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        currentFrame = await this.apiClient.executeAction(gameGuid, { action: 'ACTION6', coordinates: [x, y] });
        frames.push(currentFrame);
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
      tools: [inspectTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
    });

    const result = await run(
      agent,
      `Start playing the ARC-AGI-3 game "${gameId}". Narrate before every tool call, then execute it. Keep using the What I see / What it means / Next move format until you deliver the Final Report.`,
      {
        maxTurns,
        reasoning: {
          effort: (config.reasoningEffort ?? 'high') as 'minimal' | 'low' | 'medium' | 'high',
          verbosity: 'high',
          summary: 'detailed',
        },
      },
    );

    // Process timeline entries
    for (const [index, item] of result.newItems.entries()) {
      switch (item.type) {
        case 'message_output_item':
          timeline.push({
            index,
            type: 'assistant_message',
            label: `${item.agent.name} → user`,
            content: item.content,
          });
          break;
        case 'tool_call_item':
          {
            const rawItem = item.rawItem;
            let content = '';
            const args = 'arguments' in rawItem ? rawItem.arguments : undefined;
            if (typeof args === 'string') {
              try {
                content = JSON.stringify(JSON.parse(args), null, 2);
              } catch {
                content = args;
              }
            } else if (args) {
              content = JSON.stringify(args, null, 2);
            }

            const label = `${item.agent.name} called ${'name' in rawItem ? rawItem.name : rawItem.type}`;
            timeline.push({
              index,
              type: 'tool_call',
              label,
              content,
            });
          }
          break;
        case 'tool_call_output_item':
          {
            const rawItem = item.rawItem;
            let content = '';
            if (typeof item.output === 'string') {
              content = item.output;
            } else if (item.output) {
              content = JSON.stringify(item.output, null, 2);
            } else if ('output' in rawItem && typeof rawItem.output === 'string') {
              content = rawItem.output;
            } else {
              content = JSON.stringify(rawItem, null, 2);
            }
            timeline.push({
              index,
              type: 'tool_result',
              label: `${item.agent.name} received ${rawItem.type}`,
              content,
            });
          }
          break;
        case 'reasoning_item':
          timeline.push({
            index,
            type: 'reasoning',
            label: `${item.agent.name} reasoning`,
            content: JSON.stringify(item.rawItem, null, 2),
          });
          break;
        default:
          timeline.push({
            index,
            type: 'assistant_message',
            label: 'Unknown item',
            content: JSON.stringify(item.toJSON(), null, 2),
          });
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
      return 'NOT_STARTED';  // Default fallback
    };

    // Create summary from the last frame if available (explicit narrowing)
    let summary: Arc3RunSummary;
    if (currentFrame !== null) {
      const cf = currentFrame as FrameData;
      summary = {
        state: mapState(cf.state),
        score: cf.score,
        stepsTaken: cf.action_counter,
        simpleActionsUsed: [],  // ARC3 doesn't track this the same way
        coordinateGuesses: 0,  // ARC3 doesn't track this separately
        scenarioId: gameId,
        scenarioName: gameId,  // Use gameId as name for now
      };
    } else {
      summary = {
        state: 'NOT_STARTED',
        score: 0,
        stepsTaken: 0,
        simpleActionsUsed: [],
        coordinateGuesses: 0,
        scenarioId: gameId,
        scenarioName: gameId,
      };
    }

    return {
      runId: randomUUID(),
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
    const maxTurns = Math.max(2, Math.min(config.maxTurns ?? DEFAULT_MAX_TURNS, 400));
    const gameId = config.game_id ?? 'ls20';  // Default to LockSmith game

    let gameGuid: string | null = null;
    let currentFrame: FrameData | null = null;
    const frames: FrameData[] = [];

    // Start a fresh session before the agent takes control so the toolset never needs RESET
    const initialFrame = await this.apiClient.startGame(gameId);
    gameGuid = initialFrame.guid;
    currentFrame = initialFrame;
    frames.push(initialFrame);

    // Emit initial frame to streaming clients
    streamHarness.emitEvent("game.started", {
      initialFrame,
      frameIndex: 0,
      timestamp: Date.now(),
    });
    const timeline: Arc3RunTimelineEntry[] = [];

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
        if (!currentFrame) {
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
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        streamHarness.emitEvent("agent.tool_call", { tool: name, arguments: {}, timestamp: Date.now() });
        currentFrame = await this.apiClient.executeAction(gameGuid, { action: name });
        frames.push(currentFrame);
        streamHarness.emitEvent("game.frame_update", { frameIndex: frames.length - 1, frameData: currentFrame, timestamp: Date.now() });
        return currentFrame;
      }
    });

    const action6Tool = tool({
      name: 'ACTION6',
      description: 'Send complex input with coordinates (Click/Point).',
      parameters: z.object({ x: z.number().int(), y: z.number().int() }),
      execute: async ({ x, y }) => {
        if (!gameGuid) throw new Error('Game session not initialized yet.');
        streamHarness.emitEvent("agent.tool_call", { tool: 'ACTION6', arguments: { x, y }, timestamp: Date.now() });
        currentFrame = await this.apiClient.executeAction(gameGuid, { action: 'ACTION6', coordinates: [x, y] });
        frames.push(currentFrame);
        streamHarness.emitEvent("game.frame_update", { frameIndex: frames.length - 1, frameData: currentFrame, timestamp: Date.now() });
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
      {
        maxTurns,
        stream: true,
        reasoning: {
          effort: (config.reasoningEffort ?? 'high') as 'minimal' | 'low' | 'medium' | 'high',
          verbosity: 'high',
          summary: 'detailed',
        },
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
          // Process run items (messages, tool calls, etc.)
          streamHarness.emitEvent("agent.run_item", {
            itemName: event.name,
            item: event.item,
            timestamp: Date.now(),
          });
          // Note: reasoning_item no longer processed here - deltas come from raw_model_stream_event
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

    // Process final timeline entries
    for (const [index, item] of result.newItems.entries()) {
      switch (item.type) {
        case 'message_output_item':
          timeline.push({
            index,
            type: 'assistant_message',
            label: `${item.agent.name} → user`,
            content: item.content,
          });
          streamHarness.emitEvent("agent.message", {
            agentName: item.agent.name,
            content: item.content,
            timestamp: Date.now(),
          });
          break;
        case 'tool_call_item':
          {
            const rawItem = item.rawItem;
            let content = '';
            const args = 'arguments' in rawItem ? rawItem.arguments : undefined;
            if (typeof args === 'string') {
              try {
                content = JSON.stringify(JSON.parse(args), null, 2);
              } catch {
                content = args;
              }
            } else if (args) {
              content = JSON.stringify(args, null, 2);
            }

            const label = `${item.agent.name} called ${'name' in rawItem ? rawItem.name : rawItem.type}`;
            timeline.push({
              index,
              type: 'tool_call',
              label,
              content,
            });
          }
          break;
        case 'tool_call_output_item':
          {
            const rawItem = item.rawItem;
            let content = '';
            if (typeof item.output === 'string') {
              content = item.output;
            } else if (item.output) {
              content = JSON.stringify(item.output, null, 2);
            } else if ('output' in rawItem && typeof rawItem.output === 'string') {
              content = rawItem.output;
            } else {
              content = JSON.stringify(rawItem, null, 2);
            }
            timeline.push({
              index,
              type: 'tool_result',
              label: `${item.agent.name} received ${rawItem.type}`,
              content,
            });
          }
          break;
        case 'reasoning_item':
          // Reasoning was already streamed in real-time with actual content
          // For the timeline, use the accumulated reasoning content
          timeline.push({
            index,
            type: 'reasoning',
            label: `${item.agent.name} reasoning`,
            content: streamState.accumulatedReasoning || '(Reasoning streamed in real-time)',
          });
          break;
        default:
          timeline.push({
            index,
            type: 'assistant_message',
            label: 'Unknown item',
            content: JSON.stringify(item.toJSON(), null, 2),
          });
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
      return 'NOT_STARTED';  // Default fallback
    };

    // Create summary from the last frame if available (explicit narrowing)
    let summary: Arc3RunSummary;
    if (currentFrame !== null) {
      const cf = currentFrame as FrameData;
      summary = {
        state: mapState(cf.state),
        score: cf.score,
        stepsTaken: cf.action_counter,
        simpleActionsUsed: [],  // ARC3 doesn't track this the same way
        coordinateGuesses: 0,  // ARC3 doesn't track this separately
        scenarioId: gameId,
        scenarioName: gameId,  // Use gameId as name for now
      };
    } else {
      summary = {
        state: 'NOT_STARTED',
        score: 0,
        stepsTaken: 0,
        simpleActionsUsed: [],
        coordinateGuesses: 0,
        scenarioId: gameId,
        scenarioName: gameId,
      };
    }

    const generatedRunId = randomUUID();

    // Emit completion event
    streamHarness.emitEvent("agent.completed", {
      runId: generatedRunId,
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
