/**
 * ReArc.tsx
 *
 * Author: Claude Opus 4.5
 * Date: 2025-12-31
 * PURPOSE: Self-service page for generating RE-ARC datasets and evaluating solver predictions.
 *          About section prominently displayed at top with full context.
 *          Users can generate datasets, evaluate solutions, or verify existing submissions.
 *          Reference section (Format/Scoring/Limits) with Scoring tab expanded by default.
 * SRP/DRY check: Pass - Single page orchestrating generation, evaluation, and verification sections
 */

import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, ExternalLink, ChevronRight } from "lucide-react";
import { GenerationSection } from "@/components/rearc/GenerationSection";
import { EvaluationSection } from "@/components/rearc/EvaluationSection";
import { VerificationSection } from "@/components/rearc/VerificationSection";
import { cn } from "@/lib/utils";

const NUM_TASKS = 120;

type ReferenceTab = "format" | "scoring" | "limits";

export default function ReArc() {
  const [activeTab, setActiveTab] = useState<ReferenceTab>("scoring");

  return (
    <div className="min-h-screen bg-background">
      {/* Terminal Header Bar */}
      <div className="border-b border-border/60 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight font-mono">RE-ARC BENCH</h1>
            <span className="text-xs text-muted-foreground font-mono">v1.0</span>
            <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded font-mono">
              {NUM_TASKS} TASKS
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/conundrumer/re-arc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 font-mono"
            >
              Built on RE-ARC by conundrumer
              <ExternalLink className="h-3 w-3" />
            </a>
            <Link href="/re-arc/leaderboard">
              <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                LEADERBOARD
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* About Section - Expanded at Top */}
        <div className="border border-border/60 rounded overflow-hidden bg-card">
          <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60">
            <h2 className="text-sm font-bold font-mono tracking-wide text-foreground">ABOUT RE-ARC BENCH</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold font-mono text-muted-foreground mb-2">PURPOSE</h3>
                <p className="text-sm leading-relaxed text-foreground mb-4">
                  Community benchmark for ARC solvers. Validate solver claims without prolonged debates.
                  Enable clean benchmarking without overfitting. Verify novel approaches without waiting
                  for official evaluations.
                </p>
                <h3 className="text-xs font-bold font-mono text-muted-foreground mb-2">ORIGIN</h3>
                <p className="text-sm text-foreground/90">
                  RE-ARC (Reverse-Engineering the Abstraction and Reasoning Corpus) was created by
                  Michael Hodel as a synthetic data generation framework. Each of the 400 ARC-AGI-1
                  training tasks has a corresponding generator and verifier program.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold font-mono text-muted-foreground mb-2">THIS BENCHMARK</h3>
                <p className="text-sm text-foreground/90 mb-4">
                  RE-ARC Bench is a curated 120-task evaluation set created by David Lu
                  (<a href="https://github.com/conundrumer" target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline">conundrumer</a>).
                </p>
                <h3 className="text-xs font-bold font-mono text-muted-foreground mb-2">CONSTRUCTION</h3>
                <ul className="space-y-1.5 text-sm text-foreground/90">
                  <li className="flex gap-2">
                    <span className="font-mono text-muted-foreground shrink-0">1.</span>
                    Removed all tasks solvable by icecuber (matching ARC-AGI-2)
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-muted-foreground shrink-0">2.</span>
                    Selected 120 most complex tasks by verifier line count
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-muted-foreground shrink-0">3.</span>
                    Applied color permutations + rotation/flip transforms
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Three-Column Action Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-border/60 rounded overflow-hidden bg-card">
            <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60">
              <h2 className="text-xs font-bold font-mono tracking-wide text-foreground">
                01 GENERATE DATASET
              </h2>
            </div>
            <div className="p-4">
              <GenerationSection numTasks={NUM_TASKS} compact />
            </div>
          </div>

          <div className="border border-border/60 rounded overflow-hidden bg-card">
            <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60">
              <h2 className="text-xs font-bold font-mono tracking-wide text-foreground">
                02 EVALUATE YOUR SOLUTION
              </h2>
            </div>
            <div className="p-4">
              <EvaluationSection numTasks={NUM_TASKS} compact />
            </div>
          </div>

          <div className="border border-border/60 rounded overflow-hidden bg-card">
            <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60">
              <h2 className="text-xs font-bold font-mono tracking-wide text-foreground">
                03 VERIFY SUBMISSION
              </h2>
            </div>
            <div className="p-4">
              <VerificationSection numTasks={NUM_TASKS} compact />
            </div>
          </div>
        </div>

        {/* Reference Panel with Tabs */}
        <div className="border border-border/60 rounded overflow-hidden bg-card">
          <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono tracking-wide text-foreground">
              REFERENCE
            </h2>
            <div className="flex gap-0.5">
              {(["format", "scoring", "limits"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono transition-colors rounded",
                    activeTab === tab
                      ? "bg-foreground/10 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 text-sm">
            {activeTab === "format" && <FormatReference />}
            {activeTab === "scoring" && <ScoringReference />}
            {activeTab === "limits" && <LimitsReference />}
          </div>
        </div>

        {/* Quick Start Footer */}
        <div className="text-xs text-muted-foreground font-mono flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            Generate fresh puzzles
          </span>
          <span className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            Run your solver
          </span>
          <span className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            Upload submission.json
          </span>
          <span className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            Share results
          </span>
        </div>
      </div>
    </div>
  );
}

function FormatReference() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-xs font-bold font-mono text-muted-foreground mb-2">TYPE DEFINITION</h3>
        <pre className="bg-muted/50 p-3 rounded-sm text-xs font-mono overflow-x-auto border border-border/40">
{`type Submission = {
  [taskId: string]: Prediction[];
}
type Prediction = {
  attempt_1: Grid;
  attempt_2: Grid;
}
type Grid = number[][]`}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Each task has 1+ test inputs. Each test input needs 2 prediction attempts.
        </p>
      </div>
      <div>
        <h3 className="text-xs font-bold font-mono text-muted-foreground mb-2">EXAMPLE</h3>
        <pre className="bg-muted/50 p-3 rounded-sm text-xs font-mono overflow-x-auto border border-border/40 max-h-48">
{`{
  "abc12345": [{
    "attempt_1": [[0, 1], [2, 3]],
    "attempt_2": [[2, 3], [0, 1]]
  }],
  "1234abcd": [{
    "attempt_1": [[1, 2], [3, 4]],
    "attempt_2": [[3, 4], [1, 2]]
  }, {
    "attempt_1": [[5, 6], [7, 8]],
    "attempt_2": [[7, 8], [5, 6]]
  }]
}`}
        </pre>
      </div>
    </div>
  );
}

function ScoringReference() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="border-l-2 border-foreground/20 pl-3">
        <h3 className="text-xs font-bold font-mono text-muted-foreground mb-1">PER TEST INPUT</h3>
        <p className="text-foreground">
          Solved if <strong>ANY</strong> of your 2 attempts matches ground truth.
        </p>
      </div>
      <div className="border-l-2 border-foreground/20 pl-3">
        <h3 className="text-xs font-bold font-mono text-muted-foreground mb-1">PER TASK</h3>
        <p className="text-foreground">
          Score = correct_outputs / total_test_pairs
        </p>
      </div>
      <div className="border-l-2 border-foreground/20 pl-3">
        <h3 className="text-xs font-bold font-mono text-muted-foreground mb-1">OVERALL</h3>
        <p className="text-foreground">
          Average of all task scores
        </p>
      </div>
      <div className="col-span-3 bg-muted/30 p-3 rounded-sm border border-border/40">
        <h3 className="text-xs font-bold font-mono text-muted-foreground mb-1">EXAMPLE</h3>
        <p className="text-xs font-mono text-foreground/80">
          Task A: 2 test pairs, 1 correct = 0.50 | Task B: 1 test pair, 1 correct = 1.00 |
          <span className="text-foreground font-medium"> Final: (0.50 + 1.00) / 2 = 75%</span>
        </p>
      </div>
    </div>
  );
}

function LimitsReference() {
  return (
    <div className="space-y-4">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-3">
        <h3 className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 mb-2">
          NOT AN AUTHORITATIVE BENCHMARK
        </h3>
        <p className="text-foreground/90">
          While solutions to generated datasets are completely inaccessible, a dedicated adversary
          could still create a brute force solver for these specific 120 tasks. However, the
          development effort required makes this impractical for casual claimants.
        </p>
      </div>
      <div className="bg-muted/30 border border-border/40 rounded-sm p-3">
        <h3 className="text-xs font-bold font-mono text-muted-foreground mb-2">
          UNSOLVABLE TASKS
        </h3>
        <p className="text-foreground/90">
          RE-ARC has a fundamental limitation: it doesn't determine if example pairs provide
          enough information to solve a task. Some generated tasks may be inherently unsolvable.
        </p>
      </div>
    </div>
  );
}
