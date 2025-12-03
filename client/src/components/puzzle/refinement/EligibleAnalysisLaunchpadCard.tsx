/**
 * EligibleAnalysisLaunchpadCard.tsx
 *
 * Author: gpt-5-codex
 * Date: 2025-10-17T00:00:00Z
 * PURPOSE: Thin wrapper around AnalysisResultListCard for the discussion landing page.
 * Displays recent eligible analyses in a responsive launchpad grid with hero styling.
 * SRP/DRY check: Pass — delegates rich rendering to AnalysisResultListCard and only adds layout metadata.
 */

import React, { useMemo } from 'react';
import { Link } from 'wouter';
import { Sparkles, Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnalysisResultListCard } from '@/components/puzzle/AnalysisResultListCard';
import { determineCorrectness } from '@shared/utils/correctness';
import { useExplanationById } from '@/hooks/useExplanation';
import type { EligibleExplanation } from '@/hooks/useEligibleExplanations';

interface EligibleAnalysisLaunchpadCardProps {
  explanation: EligibleExplanation;
  onRefine: (puzzleId: string, explanationId: number) => void;
}

const providerLabelMap: Record<string, string> = {
  openai: 'OpenAI',
  xai: 'xAI',
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const getRelativeLabel = (hoursOld: number) => {
  if (hoursOld >= 24) {
    const days = Math.round(hoursOld / 24);
    return relativeTimeFormatter.format(-days, 'day');
  }

  if (hoursOld >= 1) {
    const wholeHours = Math.floor(hoursOld);
    return relativeTimeFormatter.format(-wholeHours, 'hour');
  }

  const minutes = Math.max(1, Math.round(hoursOld * 60));
  return relativeTimeFormatter.format(-minutes, 'minute');
};

export const EligibleAnalysisLaunchpadCard: React.FC<EligibleAnalysisLaunchpadCardProps> = ({
  explanation,
  onRefine,
}) => {
  const { data: fullExplanation, isLoading } = useExplanationById(explanation.id);

  const correctness = useMemo(() => {
    if (fullExplanation) {
      return determineCorrectness({
        modelName: fullExplanation.modelName,
        isPredictionCorrect: fullExplanation.isPredictionCorrect ?? null,
        multiTestAllCorrect: fullExplanation.multiTestAllCorrect ?? null,
        hasMultiplePredictions: fullExplanation.hasMultiplePredictions ?? null,
      });
    }

    return {
      isCorrect: explanation.isCorrect,
      isIncorrect: !explanation.isCorrect,
      status: explanation.isCorrect ? 'correct' : 'incorrect',
      label: explanation.isCorrect ? 'Correct' : 'Incorrect',
    };
  }, [explanation.isCorrect, fullExplanation]);

  const providerLabel = providerLabelMap[explanation.provider] ?? explanation.provider.toUpperCase();
  const relativeUpdated = getRelativeLabel(explanation.hoursOld);

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 [background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(148,163,255,0.12))] p-4 shadow-lg shadow-indigo-950/20 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="grid gap-4 lg:grid-cols-[1.25fr,1fr,1fr,1fr,1.1fr] lg:items-center">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-200/70 lg:hidden">Puzzle</span>
          <Link
            href={`/discussion/${explanation.puzzleId}`}
            className="inline-flex items-center gap-2 font-mono text-sm text-indigo-100 transition hover:text-white"
          >
            <span className="rounded-md border border-indigo-400/40 bg-indigo-500/10 px-2 py-1">{explanation.puzzleId}</span>
          </Link>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-200/70 lg:hidden">Model</span>
          <Badge variant="outline" className="border-indigo-400/40 bg-indigo-500/10 text-indigo-50">
            {explanation.modelName}
          </Badge>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-200/70 lg:hidden">Status</span>
          <Badge
            className={
              correctness.isCorrect
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                : 'border-rose-400/50 bg-rose-500/15 text-rose-100'
            }
          >
            {correctness.label}
          </Badge>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-200/70 lg:hidden">Provider</span>
          <span className="inline-flex items-center rounded-md border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-100">
            {providerLabel}
          </span>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-100/80">
            <Clock3 className="h-4 w-4 text-indigo-200" />
            <span>{relativeUpdated}</span>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400"
            onClick={() => onRefine(explanation.puzzleId, explanation.id)}
          >
            <Sparkles className="h-4 w-4" />
            Refine
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {isLoading && (
          <div className="h-24 animate-pulse rounded-xl border border-indigo-400/20 bg-indigo-500/10" />
        )}

        {!isLoading && fullExplanation && (
          <AnalysisResultListCard
            result={fullExplanation}
            modelKey={fullExplanation.modelName}
            testCases={[]}
            showDebateButton={false}
            compact
            enableExpansion={false}
          />
        )}

        {!isLoading && !fullExplanation && (
          <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-sm text-indigo-100/80">
            Detailed explanation preview is unavailable. Open the puzzle to view the full analysis history.
          </div>
        )}
      </div>
    </div>
  );
};

