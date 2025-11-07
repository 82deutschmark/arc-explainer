/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: Runs OpenAI Agents SDK workflows against the ARC3 simulator, returning structured logs for the web UI.
SRP/DRY check: Pass — isolates agent orchestration from HTTP routing and simulator implementation.
*/

import { randomUUID } from 'node:crypto';
import { Agent, run, tool, extractAllTextOutput } from '@openai/agents';
import { z } from 'zod';
import { Arc3GameSimulator } from './Arc3GameSimulator';
import {
  ARC3_SIMPLE_ACTIONS,
  Arc3AgentRunConfig,
  Arc3AgentRunResult,
  Arc3RunTimelineEntry,
} from './types';

const DEFAULT_MODEL = 'o4-mini';
const DEFAULT_MAX_TURNS = 12;

export class Arc3AgentRunner {
  async run(config: Arc3AgentRunConfig): Promise<Arc3AgentRunResult> {
    const simulator = new Arc3GameSimulator(config.scenarioId);
    const agentName = config.agentName?.trim() || 'ARC3 Playground Operator';
    const maxTurns = Math.max(2, Math.min(config.maxTurns ?? DEFAULT_MAX_TURNS, 24));

    const inspectTool = tool({
      name: 'inspect_board',
      description:
        'Inspect the current board state, remaining steps, available simple actions, and scenario metadata. Always call before making decisions.',
      parameters: z.object({
        note: z
          .string()
          .max(240)
          .nullable()
          .describe('Optional reason for requesting a snapshot (used in the activity log). Use null to omit.'),
      }),
      execute: async (input) => simulator.inspect(input.note ?? null),
    });

    const scannerTool = tool({
      name: 'use_scanner_action',
      description:
        'Trigger one of the simple scanner actions ACTION1-ACTION5 to reveal structural hints about the energized node.',
      parameters: z.object({
        actionId: z.enum(ARC3_SIMPLE_ACTIONS),
      }),
      execute: async ({ actionId }) => simulator.applyAction({ kind: 'simple', id: actionId }),
    });

    const coordinateTool = tool({
      name: 'submit_coordinate_action',
      description:
        'Fire ACTION6 at a zero-indexed coordinate (x column, y row). Use after gathering enough evidence. Values outside the grid will be clamped.',
      parameters: z.object({
        x: z.number().int().describe('Column index (0 on the left).'),
        y: z.number().int().describe('Row index (0 at the top).'),
      }),
      execute: async ({ x, y }) => simulator.applyAction({ kind: 'coordinate', x, y }),
    });

    const resetTool = tool({
      name: 'reset_simulation',
      description: 'Start a fresh attempt on the simulator. Use sparingly — state and score reset.',
      parameters: z.object({}),
      execute: async () => simulator.applyAction({ kind: 'reset' }),
    });

    const baseInstructions = [
      'You control a single-agent ARC-AGI-3 mini-game called "Color Hunt".',
      'Goals:',
      '- Locate and stabilize the energized node within the 8×8 grid.',
      '- Use inspect_board first to understand the current state.',
      '- Scanner tools (ACTION1-ACTION5) reveal hints but reduce score slightly.',
      '- ACTION6 submits a coordinate guess. Coordinates are zero-indexed with x=column (left→right) and y=row (top→bottom).',
      '- Stop when the simulator reports WIN or when no useful actions remain.',
      'Return a concise final summary covering key actions, outcome, and score.',
    ].join('\n');

    const operatorGuidance = config.instructions?.trim();
    const combinedInstructions = operatorGuidance
      ? `${baseInstructions}\n\nOperator guidance: ${operatorGuidance}`
      : baseInstructions;

    const agent = new Agent({
      name: agentName,
      instructions: combinedInstructions,
      handoffDescription: 'Operates the ARC3 Color Hunt simulator.',
      model: config.model ?? DEFAULT_MODEL,
      tools: [inspectTool, scannerTool, coordinateTool, resetTool],
    });

    const result = await run(
      agent,
      'Begin the Color Hunt session. Report status updates and end with a final mission summary.',
      {
        maxTurns,
        reasoning: {
          effort: (config.reasoningEffort ?? 'high') as 'minimal' | 'low' | 'medium' | 'high',
          verbosity: 'high',
          summary: 'detailed',
        },
      },
    );

    const timeline: Arc3RunTimelineEntry[] = result.newItems.map((item, index) => {
      switch (item.type) {
        case 'message_output_item':
          return {
            index,
            type: 'assistant_message',
            label: `${item.agent.name} → user`,
            content: item.content,
          };
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

            return {
              index,
              type: 'tool_call',
              label,
              content,
            };
          }
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
            return {
              index,
              type: 'tool_result',
              label: `${item.agent.name} received ${rawItem.type}`,
              content,
            };
          }
        case 'reasoning_item':
          return {
            index,
            type: 'reasoning',
            label: `${item.agent.name} reasoning`,
            content: JSON.stringify(item.rawItem, null, 2),
          };
        default:
          return {
            index,
            type: 'assistant_message',
            label: 'Unknown item',
            content: JSON.stringify(item.toJSON(), null, 2),
          };
      }
    });

    const frames = simulator.getHistory();
    const summary = simulator.getSummary();
    const usage = result.state._context.usage;
    const finalOutputCandidate = result.finalOutput;
    const finalOutput = typeof finalOutputCandidate === 'string'
      ? finalOutputCandidate
      : extractAllTextOutput(result.newItems);

    return {
      runId: randomUUID(),
      finalOutput: finalOutput?.trim() ? finalOutput.trim() : undefined,
      timeline,
      frames,
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
