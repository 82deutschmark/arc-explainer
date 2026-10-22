/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-22
 * PURPOSE: One side (A or B) of "Can You Spot Slop?" (/elo), as a dense terminal-style column:
 *          a thin header rule, then the model's own words in the order a reader judges them --
 *          pattern, strategy, hints, stated confidence -- and its raw reasoning folded away
 *          below. Model name and correctness are never shown here; the vote results modal
 *          reveals them. Replaces AnalysisResultCard on this page only, because that card's
 *          padded gradient panels buried the text the game is about.
 * SRP/DRY check: Pass — display only; confidence formatting reuses formatConfidence from
 *          AnalysisResultContent. The reasoning-log unwrapping mirrors that file's inline
 *          OpenAI summary parsing (stored as a JSON array of {text} items).
 */

import React from 'react';
import type { ExplanationData } from '@/types/puzzle';
import { formatConfidence } from '@/components/puzzle/AnalysisResultContent';

/** Stored reasoning is either plain text or OpenAI's [{type, text}] summary array as a string. */
function readableReasoning(log: unknown): string {
  if (typeof log !== 'string' || !log) return '';
  if (!log.startsWith('[')) return log;
  try {
    const parsed = JSON.parse(log);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.text) {
      return parsed.map((item: { text?: string }) => item.text ?? '').join('\n').replace(/\\n/g, '\n');
    }
  } catch {
    // Not JSON after all; show it as stored.
  }
  return log;
}

export const SLOP_SIDE_STYLE = {
  A: { chip: 'bg-sky-600 text-white', rule: 'border-sky-600', button: 'bg-sky-600 hover:bg-sky-700 text-white' },
  B: { chip: 'bg-orange-600 text-white', rule: 'border-orange-600', button: 'bg-orange-600 hover:bg-orange-700 text-white' },
} as const;

export function SlopSideChip({ side }: { side: 'A' | 'B' }) {
  return (
    <span className={`inline-flex h-4 min-w-4 items-center justify-center px-1 font-mono text-[11px] font-bold leading-none ${SLOP_SIDE_STYLE[side].chip}`}>
      {side}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2 border-t border-dashed py-1.5 first:border-t-0">
      <div className="pt-px font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="min-w-0 text-[13px] leading-snug">{children}</div>
    </div>
  );
}

interface SlopExplanationColumnProps {
  side: 'A' | 'B';
  explanation: ExplanationData;
}

export function SlopExplanationColumn({ side, explanation }: SlopExplanationColumnProps) {
  const reasoning = readableReasoning(explanation.reasoningLog);
  const hints = (explanation.hints ?? []).filter((hint) => hint && hint.trim());
  const nothingSaid =
    !explanation.patternDescription?.trim() && !explanation.solvingStrategy?.trim() && hints.length === 0;

  return (
    <section className={`min-w-0 border-t-2 bg-card ${SLOP_SIDE_STYLE[side].rule}`}>
      <header className="flex items-center justify-between border-b px-2 py-1">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider">
          <SlopSideChip side={side} /> Explanation {side}
        </div>
        {explanation.confidence !== undefined && explanation.confidence !== null && (
          <div className="font-mono text-[11px] text-muted-foreground">
            CLAIMS <span className="font-semibold text-foreground">{formatConfidence(explanation.confidence)}</span> SURE
          </div>
        )}
      </header>

      <div className="px-2 py-1">
        {explanation.patternDescription?.trim() && <Field label="Pattern">{explanation.patternDescription}</Field>}
        {explanation.solvingStrategy?.trim() && <Field label="Strategy">{explanation.solvingStrategy}</Field>}
        {hints.length > 0 && (
          <Field label="Hints">
            <ol className="list-decimal space-y-0.5 pl-4">
              {hints.map((hint, i) => (
                <li key={i}>{hint}</li>
              ))}
            </ol>
          </Field>
        )}
        {nothingSaid && !reasoning && (
          <p className="py-1.5 text-[13px] text-muted-foreground">This model gave an answer but no explanation.</p>
        )}
        {reasoning && (
          <details className="group border-t border-dashed py-1.5" open={nothingSaid}>
            <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
              Raw reasoning ({reasoning.length.toLocaleString()} chars)
            </summary>
            <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap bg-muted/40 p-2 font-mono text-[11px] leading-snug">
              {reasoning}
            </pre>
          </details>
        )}
      </div>
    </section>
  );
}
