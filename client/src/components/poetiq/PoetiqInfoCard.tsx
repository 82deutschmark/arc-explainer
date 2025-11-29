/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * PURPOSE: Info card displayed on the Poetiq Solver page explaining the key architectural concepts.
 *          Matches the terminology from the blog post.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, RefreshCw, TrendingUp, Info } from 'lucide-react';

export function PoetiqInfoCard() {
  return (
    <Card className="border border-indigo-200">
      <CardHeader className="bg-indigo-50 px-2 py-1.5 border-b border-indigo-200 flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-indigo-700" />
        <CardTitle className="text-xs font-bold text-indigo-800 uppercase tracking-wide">
          System Architecture
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-xs">
            <Brain className="h-3 w-3" />
            <span>Meta-System</span>
          </div>
          <p className="text-[10px] text-gray-600 leading-snug">
            A recursive logic layer that sits <em>above</em> the LLM. It orchestrates code generation, testing, and
            refinement, making the system <strong>model-agnostic</strong>.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-xs">
            <RefreshCw className="h-3 w-3" />
            <span>Self-Auditing</span>
          </div>
          <p className="text-[10px] text-gray-600 leading-snug">
            The system autonomously tests generated code on training examples. It decides when a solution is valid and
            when to stop iterating.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-xs">
            <TrendingUp className="h-3 w-3" />
            <span>Pareto Optimal</span>
          </div>
          <p className="text-[10px] text-gray-600 leading-snug">
            Achieves higher accuracy at lower cost than traditional prompt-based solvers by minimizing wasteful API
            calls through targeted reasoning.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
