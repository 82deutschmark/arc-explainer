/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-26
 * PURPOSE: Collapsible explainer component that describes how the Poetiq solver works
 *          in plain, accessible language. Redesigned with dark theme to match modern scientific aesthetic.
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
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.05) 0%, rgba(180, 255, 57, 0.05) 100%)',
        border: '1px solid rgba(0, 217, 255, 0.2)',
      }}
    >
      <div
        className="cursor-pointer select-none p-6"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
              <Brain className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-orbitron font-bold text-white">System Documentation</h2>
              {!isOpen && (
                <p className="text-sm text-gray-400 font-ibm mt-0.5">
                  Learn how code generation differs from direct prediction
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
          >
            {isOpen ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="p-6 pt-0 space-y-8 font-ibm">
          {/* The Key Difference */}
          <div className="space-y-4">
            <h3 className="font-orbitron font-bold text-lg flex items-center gap-2 text-cyan-300">
              <Target className="h-5 w-5" />
              Core Methodology Comparison
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Direct Prediction */}
              <div
                className="rounded-lg p-5 space-y-3"
                style={{
                  background: 'rgba(107, 114, 128, 0.1)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                }}
              >
                <h4 className="font-semibold text-gray-300 font-jetbrains text-sm uppercase tracking-wider">
                  Standard AI Solvers
                </h4>
                <p className="text-sm text-gray-400 italic">
                  "Look at the examples. Now guess what the output grid should be."
                </p>
                <ul className="text-sm text-gray-300 space-y-2 mt-3">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500">▸</span>
                    <span>AI analyzes visual patterns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500">▸</span>
                    <span>Directly outputs grid of numbers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500">▸</span>
                    <span>Single-shot prediction, no iteration</span>
                  </li>
                </ul>
              </div>

              {/* Code Generation */}
              <div
                className="rounded-lg p-5 space-y-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.08) 0%, rgba(180, 255, 57, 0.08) 100%)',
                  border: '1px solid rgba(0, 217, 255, 0.4)',
                  boxShadow: '0 0 20px rgba(0, 217, 255, 0.1)',
                }}
              >
                <h4 className="font-semibold text-cyan-300 font-jetbrains text-sm uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Poetiq Approach
                </h4>
                <p className="text-sm text-cyan-200 italic">
                  "Write a Python function that transforms ANY input into the correct output."
                </p>
                <ul className="text-sm text-lime-300 space-y-2 mt-3">
                  <li className="flex items-start gap-2">
                    <span className="text-lime-400">▸</span>
                    <span>AI generates executable Python code</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime-400">▸</span>
                    <span>Code tested on training examples</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime-400">▸</span>
                    <span>Iterative refinement until successful</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <Separator className="bg-gray-700/50" />

          {/* The Process */}
          <div className="space-y-4">
            <h3 className="font-orbitron font-bold text-lg flex items-center gap-2 text-cyan-300">
              <RefreshCw className="h-5 w-5" />
              Execution Pipeline
            </h3>

            <div className="grid gap-3">
              <ProcessStep
                number={1}
                icon={Brain}
                title="Pattern Analysis"
                description="System analyzes training input→output pairs to identify transformation logic"
              />
              <ProcessStep
                number={2}
                icon={Code}
                title="Code Synthesis"
                description="Generates Python transform() function implementing discovered pattern"
              />
              <ProcessStep
                number={3}
                icon={TestTube}
                title="Validation"
                description="Executes code against all training examples in sandboxed environment"
              />
              <ProcessStep
                number={4}
                icon={RefreshCw}
                title="Iteration"
                description="On failure, detailed feedback enables refinement (max 10 iterations)"
              />
              <ProcessStep
                number={5}
                icon={CheckCircle}
                title="Deployment"
                description="Validated code applied to test input for final solution"
              />
              <ProcessStep
                number={6}
                icon={Users}
                title="Consensus"
                description="Multiple parallel expert agents vote on optimal solution"
              />
            </div>
          </div>

          <Separator className="bg-gray-700/50" />

          {/* Why Code Generation Matters */}
          <div className="space-y-4">
            <h3 className="font-orbitron font-bold text-lg flex items-center gap-2 text-cyan-300">
              <Zap className="h-5 w-5" />
              Technical Advantages
            </h3>

            <div
              className="rounded-lg p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.05) 0%, rgba(180, 255, 57, 0.05) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.2)',
              }}
            >
              <p className="text-sm text-gray-300 leading-relaxed">
                <strong className="text-white">Proof of Understanding:</strong>
                {' '}If code successfully transforms all training examples, it demonstrates genuine pattern
                comprehension rather than statistical correlation. Code generation provides verifiable,
                deterministic transformation logic — unlike black-box prediction which can succeed through
                probabilistic luck.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(107, 114, 128, 0.3)' }}>
                    <th className="text-left py-3 px-4 font-jetbrains text-xs uppercase tracking-wider text-gray-400">Metric</th>
                    <th className="text-left py-3 px-4 font-jetbrains text-xs uppercase tracking-wider text-gray-400">Direct Prediction</th>
                    <th className="text-left py-3 px-4 font-jetbrains text-xs uppercase tracking-wider text-cyan-400">Code Generation</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr style={{ borderBottom: '1px solid rgba(107, 114, 128, 0.2)' }}>
                    <td className="py-3 px-4 text-gray-400">Verification</td>
                    <td className="py-3 px-4">Final output only</td>
                    <td className="py-3 px-4 text-cyan-300">All training examples</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(107, 114, 128, 0.2)' }}>
                    <td className="py-3 px-4 text-gray-400">Feedback Loop</td>
                    <td className="py-3 px-4">None (single attempt)</td>
                    <td className="py-3 px-4 text-cyan-300">Iterative refinement</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(107, 114, 128, 0.2)' }}>
                    <td className="py-3 px-4 text-gray-400">Transparency</td>
                    <td className="py-3 px-4">Opaque neural net</td>
                    <td className="py-3 px-4 text-cyan-300">Readable Python source</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-gray-400">Reliability</td>
                    <td className="py-3 px-4">Probabilistic guess</td>
                    <td className="py-3 px-4 text-cyan-300">Deterministic logic</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Separator className="bg-gray-700/50" />

          {/* Why We Need Help */}
          <div className="space-y-4">
            <h3 className="font-orbitron font-bold text-lg flex items-center gap-2 text-cyan-300">
              <Users className="h-5 w-5" />
              Distributed Verification Model
            </h3>

            <div
              className="rounded-lg p-5 space-y-3"
              style={{
                background: 'rgba(255, 149, 0, 0.08)',
                border: '1px solid rgba(255, 149, 0, 0.3)',
              }}
            >
              <p className="text-sm text-amber-300">
                <strong className="text-amber-200">Resource Constraint:</strong> API rate limits restrict single-user
                throughput. Each puzzle requires 20-80+ API calls. Complete dataset verification exceeds
                individual daily quotas.
              </p>
              <p className="text-sm text-amber-300">
                <strong className="text-amber-200">Community Solution:</strong> Distributed execution model.
                20 participants × 6 puzzles = full dataset coverage within 24 hours. Collective verification
                validates benchmark claims transparently.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(0, 217, 255, 0.05)',
                  border: '1px solid rgba(0, 217, 255, 0.2)',
                }}
              >
                <div className="text-3xl font-orbitron font-black text-cyan-400">120</div>
                <div className="text-xs font-jetbrains text-gray-400 mt-1 uppercase tracking-wider">Total Puzzles</div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(255, 149, 0, 0.05)',
                  border: '1px solid rgba(255, 149, 0, 0.2)',
                }}
              >
                <div className="text-3xl font-orbitron font-black text-amber-400">~50</div>
                <div className="text-xs font-jetbrains text-gray-400 mt-1 uppercase tracking-wider">Calls/Puzzle</div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(180, 255, 57, 0.05)',
                  border: '1px solid rgba(180, 255, 57, 0.2)',
                }}
              >
                <div className="text-3xl font-orbitron font-black text-lime-400">6</div>
                <div className="text-xs font-jetbrains text-gray-400 mt-1 uppercase tracking-wider">Per Contributor</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
    <div
      className="flex items-start gap-4 rounded-lg p-4"
      style={{
        background: 'rgba(0, 217, 255, 0.03)',
        border: '1px solid rgba(0, 217, 255, 0.15)',
      }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 font-orbitron font-black text-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.15) 0%, rgba(180, 255, 57, 0.15) 100%)',
          border: '1px solid rgba(0, 217, 255, 0.3)',
          color: '#00d9ff',
        }}
      >
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-cyan-400 shrink-0" />
          <span className="font-semibold text-white font-ibm">{title}</span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
