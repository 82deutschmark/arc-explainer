/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Extract timeline processing logic from Arc3RealGameRunner to eliminate duplication.
Converts OpenAI Agents SDK run items to Arc3RunTimelineEntry format for UI display.
Extracted from Arc3RealGameRunner.ts lines 127-198 and 468-546 (duplicate code).
SRP/DRY check: Pass — single responsibility of timeline conversion, eliminates duplication between streaming/non-streaming runs.
*/

import type { Arc3RunTimelineEntry } from '../types.ts';

/**
 * Process run items and convert to timeline entries
 * @param runItems - Array of run items from OpenAI Agents SDK result.newItems
 * @param agentName - Name of the agent for labeling
 * @returns Array of timeline entries for UI display
 */
export function processRunItems(runItems: any[], agentName: string): Arc3RunTimelineEntry[] {
  const timeline: Arc3RunTimelineEntry[] = [];

  for (const [index, item] of runItems.entries()) {
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

  return timeline;
}

/**
 * Process streaming run items with accumulated reasoning
 * Used in streaming runs where reasoning content is accumulated separately
 * @param runItems - Array of run items from OpenAI Agents SDK result.newItems
 * @param agentName - Name of the agent for labeling
 * @param accumulatedReasoning - Accumulated reasoning content from streaming
 * @returns Array of timeline entries for UI display
 */
export function processRunItemsWithReasoning(
  runItems: any[],
  agentName: string,
  accumulatedReasoning: string | null
): Arc3RunTimelineEntry[] {
  const timeline: Arc3RunTimelineEntry[] = [];

  for (const [index, item] of runItems.entries()) {
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
        // Use accumulated reasoning from streaming if available
        timeline.push({
          index,
          type: 'reasoning',
          label: `${item.agent.name} reasoning`,
          content: accumulatedReasoning || '(Reasoning streamed in real-time)',
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

  return timeline;
}
