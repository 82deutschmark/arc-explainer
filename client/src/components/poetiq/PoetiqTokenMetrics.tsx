/**
 * Author: Codex / GPT-5
 * Date: 2025-11-30
 * PURPOSE: Present live token + cost totals (global and per expert) so users
 *          understand the financial impact of the Poetiq run.
 * SRP/DRY check: Pass — single responsibility for summarising token economics.
 */

import React from 'react';
import { Coins } from 'lucide-react';
import type {
  PoetiqCostBreakdown,
  PoetiqExpertState,
  PoetiqTokenUsage,
} from '@/hooks/usePoetiqProgress';

interface PoetiqTokenMetricsProps {
  tokenUsage?: PoetiqTokenUsage | null;
  cost?: PoetiqCostBreakdown | null;
  expertStates?: Record<string, PoetiqExpertState>;
}

const formatTokens = (value?: number) => {
  if (value === undefined) return '0';
  return value.toLocaleString();
};

const formatCost = (value?: number) => {
  if (value === undefined) return '$0.0000';
  return `$${value.toFixed(4)}`;
};

export function PoetiqTokenMetrics({ tokenUsage, cost, expertStates }: PoetiqTokenMetricsProps) {
  const expertList = expertStates ? Object.values(expertStates).sort((a, b) => a.expertId - b.expertId) : [];

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-full px-4 py-2 flex flex-wrap items-center gap-3 text-xs text-amber-900">
      <span className="flex items-center gap-1 font-semibold text-amber-800">
        <Coins className="h-3.5 w-3.5 text-amber-600" />
        Token & Cost
      </span>
      <span>
        Tokens in/out:{' '}
        <strong>
          {formatTokens(tokenUsage?.input_tokens)} / {formatTokens(tokenUsage?.output_tokens)}
        </strong>
      </span>
      <span>
        Total tokens: <strong>{formatTokens(tokenUsage?.total_tokens)}</strong>
      </span>
      <span>
        Spend so far: <strong>{formatCost(cost?.total)}</strong>
      </span>
      {expertList.length > 0 ? (
        <span className="text-amber-800">
          Best expert cost:{' '}
          <strong>
            {expertList[0].cost?.total !== undefined ? formatCost(expertList[0].cost?.total) : '$0.0000'}
          </strong>
        </span>
      ) : (
        <span className="text-amber-700">Waiting for first sandbox run…</span>
      )}
    </div>
  );
}

export default PoetiqTokenMetrics;
