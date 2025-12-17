/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Header + disclaimers section for the Hugging Face union-accuracy page.
 *          Extracted from HuggingFaceUnionAccuracy.tsx to keep the page orchestration-only.
 * SRP/DRY check: Pass - Presentational component for header/disclaimers only.
 * shadcn/ui: Pass - Uses Card and Alert.
 */

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

export interface UnionAccuracyHeaderProps {
  showEvaluationSetDetails: boolean;
  onToggleEvaluationSetDetails: () => void;
}

export const UnionAccuracyHeader: React.FC<UnionAccuracyHeaderProps> = ({
  showEvaluationSetDetails,
  onToggleEvaluationSetDetails,
}) => {
  return (
    <>
      {/* Header - Compact */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-3 rounded">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          Multi-Attempt Solver Results: Public Evaluation
        </h1>
        <p className="text-base text-gray-600 mt-1">
          Official ARC Prize harness results AND community-submitted solver evaluations on the public evaluation set
        </p>
      </div>

      {/* Important Disclaimer */}
      <Alert className="border-amber-300 bg-amber-50 p-2 border-l-4 border-l-amber-600">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-xl text-amber-900 ml-2 space-y-1">
          <div>
            <strong>📢 Important:</strong> These are <strong>OFFICIAL results from the ARC Prize team's evaluation harness</strong> — not personal evaluations.
            The ARC Prize team conducted these official tests and posted the results on{' '}
            <a
              href="https://huggingface.co/datasets/arcprize/arc_agi_v2_public_eval"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-amber-700 underline hover:text-amber-800"
            >
              Hugging Face
              <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </a>
            {' '}in raw JSON format.
          </div>
          <div>
            <strong>Key difference:</strong> Scores here are from the <strong>public evaluation set</strong> and will{' '}
            <strong>NOT match</strong> the official{' '}
            <a
              href="https://arcprize.org/leaderboard"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-amber-700 underline hover:text-amber-800"
            >
              ARC Prize leaderboard
              <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </a>
            , which uses the semi-private evaluation set. The two datasets contain different puzzles, so models score differently on each.
          </div>
          <div>
            ARC Explainer is simply a visualization tool that makes this official raw data more human-readable, searchable, and visual. All credits and data ownership belong to the{' '}
            <a
              href="https://arcprize.org"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-amber-700 underline hover:text-amber-800"
            >
              ARC Prize team
              <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </a>
            .
          </div>
        </AlertDescription>
      </Alert>

      {/* What This Page Shows */}
      <Alert className="border-blue-200 bg-blue-50/80 p-2">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-xl text-blue-900 ml-2">
          <strong>What is this page?</strong> This page visualizes official test results from the ARC Prize team's evaluation harness using the <strong>public</strong> evaluation set
          (different from the semi-private set used on the official ARC Prize website). Each model was run twice per puzzle.
          This shows the <strong>best-case score</strong>: how many ARC test pairs each model solves <strong>when a pair counts as correct if either attempt was correct</strong>.
          {' '}
          <a
            href="https://huggingface.co/datasets/arcprize/arc_agi_v2_public_eval/tree/main"
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 underline font-medium"
          >
            View raw data on Hugging Face
            <ExternalLink className="inline h-3 w-3 ml-0.5" />
          </a>
        </AlertDescription>
      </Alert>

      {/* Public vs Semi-Private Explainer - Collapsible */}
      <Card className="shadow-sm border-teal-200 bg-teal-50/80">
        <button
          onClick={onToggleEvaluationSetDetails}
          className="w-full p-3 flex items-center justify-center gap-2 text-center hover:bg-teal-100/50 transition-colors"
        >
          <h3 className="text-base font-semibold text-teal-900">
            📚 Click here to learn about the three different datasets
          </h3>
          {showEvaluationSetDetails ? (
            <ChevronUp className="h-4 w-4 text-teal-700" />
          ) : (
            <ChevronDown className="h-4 w-4 text-teal-700" />
          )}
        </button>

        {showEvaluationSetDetails && (
          <CardContent className="p-3 space-y-2 border-t border-teal-200">
            <p className="text-base text-teal-800 mb-2">
              This is a <strong>friendly, simple explanation</strong>. For the official details, see the{' '}
              <a
                href="https://arcprize.org/policy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-teal-700 underline hover:text-teal-800"
              >
                official ARC Prize policy
                <ExternalLink className="inline h-3 w-3 ml-0.5" />
              </a>
              {' '}and the{' '}
              <a
                href="https://arxiv.org/html/2412.04604v2"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-teal-700 underline hover:text-teal-800"
              >
                ARC Prize 2025 evaluation overview (arXiv)
                <ExternalLink className="inline h-3 w-3 ml-0.5" />
              </a>
              .
            </p>

            <div className="space-y-2 text-base text-teal-900">
              <div className="bg-white rounded p-2 border border-teal-100">
                <div className="font-semibold text-teal-700 mb-1">📊 Public Set (This Page)</div>
                <p className="mb-1 text-teal-900">Everyone can see these puzzles.</p>
                <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-base">
                  <li>Shared on GitHub and Hugging Face for anyone to use</li>
                  <li>Major AI companies (like OpenAI, Google, Anthropic, Grok) can study and learn from these puzzles</li>
                  <li>No secrets—everyone knows what they are</li>
                </ul>
              </div>

              <div className="bg-white rounded p-2 border border-teal-100">
                <div className="font-semibold text-teal-700 mb-1">🔒 Semi-Private Set (Official Leaderboard - Used for testing closed source models like OpenAI, Gemini, Anthropic, etc)</div>
                <p className="mb-1 text-teal-900">The ARC team keeps these secret.</p>
                <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-base">
                  <li>Not published anywhere—only the ARC team has them</li>
                  <li>Used to rank models fairly on the official leaderboard</li>
                  <li>These are intended for testing remotely-hosted commercial models with low leakage probability. They are calibrated to the same human difficulty as public eval.</li>
                </ul>
              </div>

              <div className="bg-white rounded p-2 border border-teal-100">
                <div className="font-semibold text-teal-700 mb-1">🏆 Private Set (Contest)</div>
                <p className="mb-1 text-teal-900">Super secret puzzles for the competition.</p>
                <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-base">
                  <li>Only used during the ARC Prize contest</li>
                  <li>Intended for testing self-contained models during the competition with “near-zero leakage probability”</li>
                  <li>No one can study these puzzles beforehand</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded p-2 border border-teal-100 text-base text-teal-800">
              <p className="mb-1">
                <strong>Why scores differ:</strong> These two puzzle sets contain <strong>completely different puzzles</strong>. That's why you'll see different scores on this page (public set) compared to the official ARC Prize leaderboard (semi-private set). Sometimes scores are higher here, sometimes lower—it all depends on how well each particular set of puzzles matches the model's strengths.
              </p>
              <p className="text-teal-700 mt-1">
                The key point:
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
};
