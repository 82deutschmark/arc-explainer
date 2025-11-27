/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Collapsible explainer component describing how Poetiq solver works.
 *          Clean, professional design matching analytics page aesthetic.
 *
 * SRP/DRY check: Pass - Single responsibility for Poetiq methodology explanation
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Code,
  TestTube,
  RefreshCw,
  CheckCircle,
  Users,
  Zap,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface PoetiqExplainerProps {
  defaultOpen?: boolean;
}

export function PoetiqExplainer({ defaultOpen = false }: PoetiqExplainerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-600" />
            <span>How Does Poetiq Work?</span>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
        {!isOpen && (
          <p className="text-sm text-gray-600 mt-1">
            Click to learn how Poetiq uses code generation instead of direct prediction
          </p>
        )}
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4 pt-0">
          {/* Key Difference */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-600" />
              The Key Difference
            </h3>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
                <h4 className="font-medium text-gray-700 text-sm">Standard AI Solvers</h4>
                <p className="text-sm text-gray-600 italic">
                  "Look at the examples. Now guess what the output grid should be."
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• AI looks at patterns</li>
                  <li>• Directly outputs a grid of numbers</li>
                  <li>• One shot — no feedback loop</li>
                </ul>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded p-3 space-y-2">
                <h4 className="font-medium text-indigo-700 text-sm">Poetiq (Code Generation)</h4>
                <p className="text-sm text-indigo-700 italic">
                  "Write a Python function that transforms ANY input into the correct output."
                </p>
                <ul className="text-sm text-indigo-700 space-y-1">
                  <li>• AI writes actual code</li>
                  <li>• Code is tested on training examples</li>
                  <li>• Iterates until code works</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          {/* Process */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-indigo-600" />
              The Poetiq Process
            </h3>

            <div className="grid gap-2">
              <ProcessStep number={1} icon={Brain} title="Analyze" description="AI studies the training input→output pairs to understand the pattern" />
              <ProcessStep number={2} icon={Code} title="Generate Code" description="AI writes a Python transform() function that should reproduce the pattern" />
              <ProcessStep number={3} icon={TestTube} title="Test" description="The code runs on all training examples in a secure sandbox" />
              <ProcessStep number={4} icon={RefreshCw} title="Iterate" description="If the code fails, AI gets detailed feedback and tries again (up to 10 times)" />
              <ProcessStep number={5} icon={CheckCircle} title="Success" description="When code passes ALL training examples, it's applied to the test input" />
              <ProcessStep number={6} icon={Users} title="Vote" description="Multiple parallel 'experts' vote on the best solution" />
            </div>
          </div>

          <Separator />

          {/* Why It Matters */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-600" />
              Why This Matters
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>If the code works on training examples, it proves the AI understood the pattern.</strong>
                {' '}Direct prediction can get lucky with a single guess, but code generation
                must actually reproduce the transformation logic. Plus, we can read the code
                to see exactly what the AI "thinks" the pattern is!
              </p>
            </div>
          </div>

          <Separator />

          {/* Why We Need Help */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              Why We Need Your Help
            </h3>

            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
              <p className="text-sm text-amber-800">
                <strong>The Problem:</strong> Each API key has daily rate limits.
                Running Poetiq on one puzzle can require 20-80+ API calls.
                One person can't run all 120 puzzles in a day.
              </p>
              <p className="text-sm text-amber-800">
                <strong>The Solution:</strong> Community pooling! If 20 people each run 6 puzzles,
                we complete the entire dataset together.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white border border-gray-200 rounded p-2">
                <div className="text-2xl font-bold text-indigo-600">120</div>
                <div className="text-xs text-gray-600">Puzzles Total</div>
              </div>
              <div className="bg-white border border-gray-200 rounded p-2">
                <div className="text-2xl font-bold text-amber-600">~50</div>
                <div className="text-xs text-gray-600">API Calls/Puzzle</div>
              </div>
              <div className="bg-white border border-gray-200 rounded p-2">
                <div className="text-2xl font-bold text-green-600">6</div>
                <div className="text-xs text-gray-600">Puzzles/Person</div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Helper component for process steps
function ProcessStep({
  number,
  icon: Icon,
  title,
  description
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2 bg-white border border-gray-200 rounded p-2">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs shrink-0">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-indigo-600" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
