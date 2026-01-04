/*
Author: Cascade (ChatGPT 5.1 Codex)
Date: 2026-01-02
PURPOSE: Codex-powered ARC-AGI-3 interactive runner using OpenAI Agents SDK.
         Drives a continuous event loop (S_t, A_t, R_{t+1}) exposing primitive ARC actions.
         Feeds multimodal PNG frames + deltas to Codex for trajectory-based reasoning.
         Maintains scorecard alignment per ARC Prize requirements.

SRP/DRY check: Pass — reuses existing Arc3ApiClient, PNG rendering, frame analysis helpers.
*/

import { randomUUID, createHash } from 'node:crypto';
import { Agent, run, tool, extractAllTextOutput } from '@openai/agents';
import { z } from 'zod';
import { Arc3ApiClient, type FrameData, type GameAction } from './Arc3ApiClient.ts';
import type { Arc3AgentRunConfig, Arc3AgentRunResult, Arc3RunTimelineEntry, Arc3RunSummary, Arc3GameState } from './types.ts';
import { buildArc3DefaultPrompt } from './prompts.ts';
import { DEFAULT_MAX_TURNS, DEFAULT_GAME_ID } from './utils/constants.ts';
import { processRunItems, processRunItemsWithReasoning } from './utils/timelineProcessor.ts';
import { generateActionCaption } from './helpers/captionGenerator.ts';
import { countChangedPixels, analyzeFrameChanges, extractGrid, extractLayerStack } from './helpers/frameAnalysis.ts';
import { calculateColorDistribution } from './helpers/colorAnalysis.ts';
import { unpackFrames, summarizeFrameStructure } from './helpers/frameUnpacker.ts';
import { createSession } from './persistence/sessionManager.ts';
import { saveFrame } from './persistence/framePersistence.ts';
import { renderArc3FrameToPng } from './arc3GridImageService.ts';
import { executeGridAnalysis } from './helpers/gridAnalyzer.ts';
import { buildCascadeContext, stringifyCascadeContext } from './helpers/cascadeHarness.ts';
import { logger } from '../../utils/logger.ts';

// Codex-specific default model
const CODEX_DEFAULT_MODEL = process.env.CODEX_ARC_MODEL || 'gpt-5.1-codex-mini';

export interface CodexArc3StreamHarness {
  sessionId: string;
  emit: (chunk: any) => void;
  emitEvent: (event: string, data: any) => void;
  end: (summary: any) => void;
  metadata: {
    game_id: string;
    agentName: string;
  };
}

export class CodexArc3Runner {
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
   * Persist unpacked animation frames to database.
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
        const isLastFrame = i === unpackedFrames.length - 1;
        const pixelsChanged = isLastFrame && prevFrame
          ? countChangedPixels(prevFrame, frame)
          : 0;

        let caption = generateActionCaption(action, prevFrame, frame);
        if (unpackedFrames.length > 1) {
          caption += ` (frame ${i + 1}/${unpackedFrames.length})`;
        }

        await saveFrame(dbSessionId, frameNum, frame, action, caption, pixelsChanged);

        logger.debug(
          `[Codex Frame Persistence] Saved frame ${frameNum} (animation ${i + 1}/${unpackedFrames.length}): ${caption}`,
          'codex-arc3'
        );

        frameNum++;
      }
    } catch (error) {
      logger.warn(
        `[Codex Frame Persistence] Failed to persist unpacked frames: ${error instanceof Error ? error.message : String(error)}`,
        'codex-arc3'
      );
    }

    return frameNum;
  }

  /**
   * Validate continuation frame exists (don't execute actions to fetch state).
   */
  private validateContinuationFrame(seedFrame: FrameData | undefined, gameId: string, gameGuid: string): FrameData {
    if (!seedFrame) {
      throw new Error(
        `[Codex ARC3] Cannot continue game session ${gameGuid} without a seed frame. ` +
        `The frontend must provide the last known frame state when continuing.`
      );
    }

    if (seedFrame.guid !== gameGuid) {
      logger.warn(
        `[Codex ARC3] Seed frame guid (${seedFrame.guid}) doesn't match expected guid (${gameGuid}). Using seed frame anyway.`,
        'codex-arc3'
      );
    }

    logger.info(
      `[Codex ARC3] Continuing game session: ${gameGuid} at state=${seedFrame.state}, score=${seedFrame.score}, actions=${seedFrame.action_counter}/${seedFrame.max_actions}`,
      'codex-arc3'
    );

    return seedFrame;
  }

  /**
   * Run Codex agent with streaming for real-time UI updates.
   */
  async runWithStreaming(config: Arc3AgentRunConfig, streamHarness: CodexArc3StreamHarness): Promise<Arc3AgentRunResult> {
    const agentName = config.agentName?.trim() || 'Codex ARC3 Agent';
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    const gameId = config.game_id ?? DEFAULT_GAME_ID;
    const harnessMode = config.harnessMode ?? 'default';
    
    // Open scorecard (required by ARC3 API before any game actions)
    const scorecardId = await this.apiClient.openScorecard(
      ['arc-explainer', 'codex-agent-run', 'streaming'],
      'https://github.com/arc-explainer/arc-explainer',
      { source: 'arc-explainer', mode: 'codex-agent-stream', game_id: gameId, agentName }
    );

    let gameGuid: string | null = null;
    let currentFrame: FrameData | null = null;
    let prevFrame: FrameData | null = null;
    const frames: FrameData[] = [];
    let dbSessionId: number | null = null;
    let isContinuation = false;

    // Start fresh session OR continue existing one
    const initialFrame = config.existingGameGuid
      ? this.validateContinuationFrame(config.seedFrame, gameId, config.existingGameGuid)
      : await this.apiClient.startGame(gameId, undefined, scorecardId);

    gameGuid = initialFrame.guid;
    isContinuation = !!config.existingGameGuid;

    // Unpack initial frame if animation
    const unpackedInitialFrames = unpackFrames(initialFrame);
    if (unpackedInitialFrames.length > 1) {
      logger.info(
        `[Codex ARC3] Initial RESET returned ${unpackedInitialFrames.length} animation frames: ${summarizeFrameStructure(initialFrame)}`,
        'codex-arc3'
      );
    }

    currentFrame = unpackedInitialFrames[unpackedInitialFrames.length - 1];
    frames.push(...unpackedInitialFrames);

    // Create DB session for persistence (new games only)
    let currentFrameNumber = 0;
    try {
      if (isContinuation) {
        logger.info(`[Codex ARC3] Continuing game session ${gameGuid} on game ${gameId}`, 'codex-arc3');
      } else {
        dbSessionId = await createSession(gameId, gameGuid, currentFrame.win_score);
        currentFrameNumber = await this.persistUnpackedFrames(
          dbSessionId,
          unpackedInitialFrames,
          { action: 'RESET' },
          null,
          0
        );
        logger.info(
          `[Codex ARC3] Created session ${dbSessionId} for game ${gameId} (${unpackedInitialFrames.length} initial frame(s))`,
          'codex-arc3'
        );
      }
    } catch (error) {
      logger.warn(`[Codex ARC3] Failed to create database session: ${error instanceof Error ? error.message : String(error)}`, 'codex-arc3');
    }

    // Emit initial frames to streaming clients
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
        isContinuation,
        provider: 'codex',
        timestamp: Date.now(),
      });
    }

    // Reasoning accumulator for streaming
    const streamState = {
      accumulatedReasoning: "",
      reasoningSequence: 0,
      hypotheses: [] as string[],
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
      provider: 'codex',
      model: config.model ?? CODEX_DEFAULT_MODEL,
      timestamp: Date.now(),
    });

    // Define inspect_game_state tool - returns PNG + structured analysis
    const inspectTool = tool({
      name: 'inspect_game_state',
      description: 'Inspect the current game state visually. Returns a PNG image (frameImage) showing exactly what you see, plus structured analysis including color distribution and changes since last action. Always call this before making decisions.',
      parameters: z.object({
        note: z
          .string()
          .max(240)
          .nullable()
          .describe('Optional reason for requesting a snapshot.'),
      }),
      execute: async (input) => {
        logger.info(`[Codex TOOL] inspect_game_state called with note: "${input.note}"`, 'codex-arc3');

        if (!currentFrame) {
          throw new Error('Game session not initialized yet.');
        }

        streamHarness.emitEvent("agent.tool_call", {
          tool: 'inspect_game_state',
          arguments: input,
          timestamp: Date.now(),
        });

        const layerStack = extractLayerStack(currentFrame);
        const imageResult = await renderArc3FrameToPng(layerStack);
        const frameImage = imageResult?.dataUrl ?? null;

        if (frameImage) {
          logger.info(`[Codex TOOL] Generated frame image: ${imageResult!.width}x${imageResult!.height}px`, 'codex-arc3');
        }

        const grid2D = extractGrid(currentFrame);
        const colorDistribution = calculateColorDistribution(grid2D);
        const changes = analyzeFrameChanges(prevFrame, currentFrame);

        const cascadeCtx = harnessMode === 'cascade'
          ? buildCascadeContext({
              prevFrame,
              currentFrame,
              lastAction: streamState.hypotheses.slice(-1)[0],
              turn: frames.length,
            })
          : null;

        const result = {
          gameGuid: currentFrame.guid,
          gameId: currentFrame.game_id,
          frameImage,
          colorDistribution,
          changes,
          score: currentFrame.score,
          state: currentFrame.state,
          action_counter: currentFrame.action_counter,
          max_actions: currentFrame.max_actions,
          win_score: currentFrame.win_score,
          note: input.note ?? null,
          ...(cascadeCtx
            ? { cascadeContext: stringifyCascadeContext(cascadeCtx) }
            : {}),
        };

        logger.info(
          `[Codex TOOL] inspect_game_state returning: state=${result.state}, score=${result.score}, actions=${result.action_counter}/${result.max_actions}`,
          'codex-arc3'
        );
        return result;
      },
    });

    // Define analyze_grid tool for programmatic Python analysis
    const analyzeGridTool = tool({
      name: 'analyze_grid',
      description: 'Execute Python code to analyze the current game grid programmatically. Has numpy, scipy.ndimage. Helper functions: find_connected_components(), detect_symmetry(), get_bounding_box(), color_counts(). Use print() for output.',
      parameters: z.object({
        code: z.string().min(5).max(4000).describe('Python code to execute.'),
        note: z.string().max(120).nullable().describe('Optional note explaining the purpose.'),
      }),
      execute: async ({ code, note }) => {
        logger.info(`[Codex TOOL] analyze_grid called with note: "${note}"`, 'codex-arc3');

        if (!currentFrame) {
          throw new Error('Game session not initialized yet.');
        }

        const gridStack = extractLayerStack(currentFrame);
        const result = await executeGridAnalysis(gridStack, code);

        logger.info(
          `[Codex TOOL] analyze_grid completed: success=${result.success}, time=${result.executionTimeMs}ms`,
          'codex-arc3'
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

    // Define simple action tools (ACTION1-5)
    const simpleAction = (name: 'ACTION1'|'ACTION2'|'ACTION3'|'ACTION4'|'ACTION5') => tool({
      name,
      description: `Send simple input ${name}.`,
      parameters: z.object({}),
      execute: async () => {
        logger.info(`[Codex TOOL] ${name} called`, 'codex-arc3');
        if (!gameGuid) throw new Error('Game session not initialized yet.');

        streamHarness.emitEvent("game.action_start", {
          action: name,
          hypothesis: streamState.accumulatedReasoning.slice(-500),
          timestamp: Date.now(),
        });

        prevFrame = currentFrame;
        const actionFrameData = await this.apiClient.executeAction(gameId, gameGuid, { action: name });

        const unpackedActionFrames = unpackFrames(actionFrameData);
        if (unpackedActionFrames.length > 1) {
          logger.info(`[Codex TOOL] ${name} returned ${unpackedActionFrames.length} animation frames`, 'codex-arc3');
        }

        currentFrame = unpackedActionFrames[unpackedActionFrames.length - 1];
        frames.push(...unpackedActionFrames);
        updateNoScoreProgress(prevFrame, currentFrame);

        logger.info(
          `[Codex TOOL] ${name} executed: state=${currentFrame.state}, score=${currentFrame.score} (${unpackedActionFrames.length} frame(s))`,
          'codex-arc3'
        );

        // Persist frames
        if (dbSessionId && prevFrame) {
          currentFrameNumber = await this.persistUnpackedFrames(
            dbSessionId,
            unpackedActionFrames,
            { action: name },
            prevFrame,
            currentFrameNumber
          );
        }

        // Emit each frame update
        for (let i = 0; i < unpackedActionFrames.length; i++) {
          const frame = unpackedActionFrames[i];
          const isLastFrame = i === unpackedActionFrames.length - 1;
          let caption = generateActionCaption({ action: name }, prevFrame, frame);
          if (unpackedActionFrames.length > 1) {
            caption += ` (frame ${i + 1}/${unpackedActionFrames.length})`;
          }

          const cascadeCtx = harnessMode === 'cascade'
            ? buildCascadeContext({
                prevFrame,
                currentFrame: frame,
                lastAction: name,
                turn: frames.length - unpackedActionFrames.length + i + 1,
              })
            : null;

          streamHarness.emitEvent("game.frame_update", {
            frameIndex: String(currentFrameNumber - unpackedActionFrames.length + i),
            frameData: frame,
            caption,
            action: { type: name },
            isAnimation: unpackedActionFrames.length > 1,
            animationFrame: i,
            animationTotalFrames: unpackedActionFrames.length,
            isLastAnimationFrame: isLastFrame,
            ...(cascadeCtx ? { cascadeContext: stringifyCascadeContext(cascadeCtx) } : {}),
            timestamp: Date.now()
          });
        }

        streamHarness.emitEvent("game.action_result", {
          action: name,
          success: true,
          newState: currentFrame.state,
          newScore: currentFrame.score,
          rewardDelta: currentFrame.score - (prevFrame?.score ?? 0),
          timestamp: Date.now(),
        });

        return currentFrame;
      }
    });

    // Define ACTION6 (coordinate-based)
    const action6Tool = tool({
      name: 'ACTION6',
      description: 'Send complex input with coordinates (Click/Point).',
      parameters: z.object({ x: z.number().int(), y: z.number().int() }),
      execute: async ({ x, y }) => {
        logger.info(`[Codex TOOL] ACTION6 called with coordinates: (${x}, ${y})`, 'codex-arc3');
        if (!gameGuid) throw new Error('Game session not initialized yet.');

        streamHarness.emitEvent("game.action_start", {
          action: 'ACTION6',
          coordinates: [x, y],
          hypothesis: streamState.accumulatedReasoning.slice(-500),
          timestamp: Date.now(),
        });

        prevFrame = currentFrame;
        const action6FrameData = await this.apiClient.executeAction(gameId, gameGuid, { action: 'ACTION6', coordinates: [x, y] });

        const unpackedAction6Frames = unpackFrames(action6FrameData);
        if (unpackedAction6Frames.length > 1) {
          logger.info(`[Codex TOOL] ACTION6 returned ${unpackedAction6Frames.length} animation frames`, 'codex-arc3');
        }

        currentFrame = unpackedAction6Frames[unpackedAction6Frames.length - 1];
        frames.push(...unpackedAction6Frames);
        updateNoScoreProgress(prevFrame, currentFrame);

        logger.info(
          `[Codex TOOL] ACTION6(${x},${y}) executed: state=${currentFrame.state}, score=${currentFrame.score} (${unpackedAction6Frames.length} frame(s))`,
          'codex-arc3'
        );

        // Persist frames
        if (dbSessionId && prevFrame) {
          currentFrameNumber = await this.persistUnpackedFrames(
            dbSessionId,
            unpackedAction6Frames,
            { action: 'ACTION6', coordinates: [x, y] },
            prevFrame,
            currentFrameNumber
          );
        }

        // Emit frame updates
        for (let i = 0; i < unpackedAction6Frames.length; i++) {
          const frame = unpackedAction6Frames[i];
          const isLastFrame = i === unpackedAction6Frames.length - 1;
          let caption = generateActionCaption({ action: 'ACTION6', coordinates: [x, y] }, prevFrame, frame);
          if (unpackedAction6Frames.length > 1) {
            caption += ` (frame ${i + 1}/${unpackedAction6Frames.length})`;
          }

          const cascadeCtx = harnessMode === 'cascade'
            ? buildCascadeContext({
                prevFrame,
                currentFrame: frame,
                lastAction: 'ACTION6',
                turn: frames.length - unpackedAction6Frames.length + i + 1,
              })
            : null;

          streamHarness.emitEvent("game.frame_update", {
            frameIndex: String(currentFrameNumber - unpackedAction6Frames.length + i),
            frameData: frame,
            caption,
            action: { type: 'ACTION6', coordinates: [x, y] },
            isAnimation: unpackedAction6Frames.length > 1,
            animationFrame: i,
            animationTotalFrames: unpackedAction6Frames.length,
            isLastAnimationFrame: isLastFrame,
            ...(cascadeCtx ? { cascadeContext: stringifyCascadeContext(cascadeCtx) } : {}),
            timestamp: Date.now()
          });
        }

        streamHarness.emitEvent("game.action_result", {
          action: 'ACTION6',
          coordinates: [x, y],
          success: true,
          newState: currentFrame.state,
          newScore: currentFrame.score,
          rewardDelta: currentFrame.score - (prevFrame?.score ?? 0),
          timestamp: Date.now(),
        });

        return currentFrame;
      }
    });

    // Build system prompt
    const selectSystemPrompt = (): string => {
      const explicit = config.systemPrompt?.trim() || '';
      const skipDefault = config.skipDefaultSystemPrompt === true;

      if (skipDefault) return explicit;
      if (explicit) return explicit;
      return buildArc3DefaultPrompt();
    };

    const baseSystemPrompt = selectSystemPrompt();
    const operatorGuidance = config.instructions?.trim();

    const cascadeHarnessNote = harnessMode === 'cascade'
      ? 'Harness: Focus on what moved/appeared/disappeared after each action. Describe cause-effect in plain language and plan the next small experiment. Prefer concise bullet observations over numeric stats.'
      : '';

    const combinedInstructions = [baseSystemPrompt, operatorGuidance, cascadeHarnessNote]
      .filter(Boolean)
      .join('\n\n');

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
      provider: 'codex',
    };

    // Create Codex agent
    const agent = new Agent({
      name: agentName,
      instructions: combinedInstructions,
      handoffDescription: 'Operates the ARC-AGI-3 real game interface using Codex.',
      model: config.model ?? CODEX_DEFAULT_MODEL,
      modelSettings: {
        reasoning: {
          effort: (config.reasoningEffort ?? 'high') as 'minimal' | 'low' | 'medium' | 'high',
          summary: 'detailed',
        },
        text: { verbosity: 'medium' }, // Codex supports medium only
        store: storeResponse,
        providerData: { metadata },
      },
      tools: [
        inspectTool,
        analyzeGridTool,
        simpleAction('ACTION1'),
        simpleAction('ACTION2'),
        simpleAction('ACTION3'),
        simpleAction('ACTION4'),
        simpleAction('ACTION5'),
        action6Tool
      ],
    });

    // Emit agent ready event
    streamHarness.emitEvent("agent.ready", {
      agentName,
      model: config.model ?? CODEX_DEFAULT_MODEL,
      provider: 'codex',
      instructions: combinedInstructions.slice(0, 500),
      timestamp: Date.now(),
    });

    // Run agent with streaming
    const result = await run(
      agent,
      `Start playing the ARC-AGI-3 game "${gameId}". First inspect the game state to see the PNG visual. Narrate your observations and hypotheses about game rules. Execute actions and observe results. Keep playing until WIN or GAME_OVER.`,
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

            if (eventData.type === 'model') {
              const modelEvent = (eventData as any).event;

              // Handle reasoning deltas
              if (modelEvent?.type === 'response.reasoning_text.delta') {
                const delta = modelEvent.delta ?? "";
                streamState.accumulatedReasoning += delta;
                streamState.reasoningSequence++;

                streamHarness.emitEvent("agent.reasoning", {
                  delta,
                  content: streamState.accumulatedReasoning,
                  sequence: streamState.reasoningSequence,
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

                // Emit hypothesis event for trajectory tracking
                streamHarness.emitEvent("agent.hypothesize", {
                  hypothesis: finalContent.slice(0, 2000),
                  frameIndex: frames.length - 1,
                  timestamp: Date.now(),
                });
              }
            }

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
          streamHarness.emitEvent("agent.updated", {
            agent: event.agent,
            timestamp: Date.now(),
          });
          break;
      }
    }

    // Process final timeline
    const timeline = processRunItemsWithReasoning(result.newItems, agentName, streamState.accumulatedReasoning);

    const usage = result.state._context.usage;
    const finalOutputCandidate = result.finalOutput;
    const finalOutput = typeof finalOutputCandidate === 'string'
      ? finalOutputCandidate
      : extractAllTextOutput(result.newItems);

    // Map state
    const mapState = (state: string): Arc3GameState => {
      if (state === 'NOT_PLAYED') return 'NOT_PLAYED';
      if (state === 'IN_PROGRESS') return 'IN_PROGRESS';
      if (state === 'WIN') return 'WIN';
      if (state === 'GAME_OVER') return 'GAME_OVER';
      if (state === 'NOT_FINISHED') return 'NOT_FINISHED';
      throw new Error(`Unexpected game state from ARC3 API: ${state}`);
    };

    if (currentFrame === null) {
      throw new Error('No frame data available - game did not start properly');
    }

    const cf = currentFrame as FrameData;
    const summary: Arc3RunSummary = {
      state: mapState(cf.state),
      score: cf.score,
      stepsTaken: cf.action_counter ?? Math.max(0, frames.length - 1),
      simpleActionsUsed: [],
      coordinateGuesses: 0,
      scenarioId: gameId,
      scenarioName: gameId,
    };

    const generatedRunId = randomUUID();
    const providerResponseId = result.lastResponseId ?? null;

    // Emit completion event
    streamHarness.emitEvent("agent.completed", {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',
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
      provider: 'codex',
      hypotheses: streamState.hypotheses,
      timestamp: Date.now(),
    });

    return {
      runId: generatedRunId,
      gameGuid: gameGuid || 'unknown',
      finalOutput: finalOutput?.trim() ? finalOutput.trim() : undefined,
      timeline,
      frames: frames as any[],
      summary,
      usage: {
        requests: usage.requests,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      providerResponseId,
      scorecardId,
    };
  }
}
