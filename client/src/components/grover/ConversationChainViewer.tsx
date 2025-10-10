/**
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Visualizes Responses API conversation chaining showing token savings.
 * SRP/DRY check: Pass
 * shadcn/ui: Pass - Uses Card, Badge
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2, ArrowDown } from 'lucide-react';

interface ConversationChainViewerProps {
  hasChain: boolean;
  iterationCount: number;
}

export function ConversationChainViewer({ hasChain, iterationCount }: ConversationChainViewerProps) {
  if (!hasChain || iterationCount === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
          <Link2 className="h-3 w-3" />
          Conversation Chain
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1">
        <div className="space-y-2">
          {/* Iteration 1 */}
          <div className="bg-gray-50 p-2 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Iteration 1 (Initial)</span>
              <Badge variant="outline" className="text-xs">Full Context</Badge>
            </div>
            <p className="text-xs text-gray-600">
              💬 System + User messages
            </p>
            <p className="text-xs text-gray-500 mt-1">
              📦 Stored: response_id (encrypted reasoning)
            </p>
          </div>

          {iterationCount > 1 && (
            <>
              <div className="flex justify-center">
                <ArrowDown className="h-4 w-4 text-gray-400" />
              </div>

              {/* Iterations 2+ */}
              <div className="bg-blue-50 p-2 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Iterations 2-{iterationCount}</span>
                  <Badge variant="default" className="text-xs bg-green-600">Continuation</Badge>
                </div>
                <p className="text-xs text-gray-600">
                  🔗 Linked via previous_response_id
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  📥 API retrieves full context server-side
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  👤 Send only NEW message (~500 tokens)
                </p>
              </div>
            </>
          )}

          {/* Token Savings */}
          {iterationCount > 1 && (
            <div className="bg-green-50 p-2 rounded border border-green-200">
              <p className="text-xs font-medium text-green-900 mb-1">
                💡 Token Savings
              </p>
              <p className="text-xs text-green-700">
                Without chaining: ~{(iterationCount * 4000).toLocaleString()} tokens
              </p>
              <p className="text-xs text-green-700">
                With chaining: ~{(4000 + (iterationCount - 1) * 500).toLocaleString()} tokens
              </p>
              <p className="text-xs font-semibold text-green-900 mt-1">
                Savings: ~{Math.round(((iterationCount - 1) * 3500) / (iterationCount * 4000) * 100)}%
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
