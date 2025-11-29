/**
 * Author: Codex / GPT-5
 * Date: 2025-11-30
 * PURPOSE: Present live token + cost totals (global and per expert) so users
 *          understand the financial impact of the Poetiq run.
 * SRP/DRY check: Pass — single responsibility for summarising token economics.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <Card className="border border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-amber-900 flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-600" />
          Token & Cost Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs text-amber-900">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] uppercase text-amber-600 font-semibold mb-1">Global Tokens</p>
            <p>Input: {formatTokens(tokenUsage?.input_tokens)}</p>
            <p>Output: {formatTokens(tokenUsage?.output_tokens)}</p>
            <p>Total: {formatTokens(tokenUsage?.total_tokens)}</p>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] uppercase text-amber-600 font-semibold mb-1">Cost So Far</p>
            <p>Input: {formatCost(cost?.input)}</p>
            <p>Output: {formatCost(cost?.output)}</p>
            <p>Total: {formatCost(cost?.total)}</p>
          </div>
        </div>

        {expertList.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] uppercase text-amber-600 font-semibold">Per Expert Breakdown</p>
            <div className="grid gap-2 md:grid-cols-2">
              {expertList.map((expert) => (
                <div key={expert.expertId} className="rounded border border-amber-100 bg-white p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">Expert {expert.expertId}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Iter {expert.iteration ?? 0}
                    </Badge>
                  </div>
                  <div className="mt-1 text-amber-800 space-y-0.5">
                    <p>Tokens: {formatTokens(expert.tokens?.total_tokens)}</p>
                    <p>Cost: {formatCost(expert.cost?.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-amber-700">Token data will appear once experts complete their first iteration.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default PoetiqTokenMetrics;
