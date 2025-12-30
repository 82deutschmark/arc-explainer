/**
 * Author: Cascade
 * Date: 2025-12-20
 * PURPOSE: Worm Arena Rules & Prompt Transparency page.
 *          Shows users exactly what the SnakeBench LLM player is instructed with.
 *          Uses the public API endpoint /api/snakebench/llm-player/prompt-template.
 * SRP/DRY check: Pass - page composition only; API provides source-of-truth content.
 */

import React from 'react';

import WormArenaHeader from '@/components/WormArenaHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import type { SnakeBenchLlmPlayerPromptTemplateResponse } from '@shared/types';

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; error: string }
  | { status: 'loaded'; payload: SnakeBenchLlmPlayerPromptTemplateResponse };

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default function WormArenaRules() {
  const [state, setState] = React.useState<LoadState>({ status: 'idle' });

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: 'loading' });
      try {
        const res = await fetch('/api/snakebench/llm-player/prompt-template');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as SnakeBenchLlmPlayerPromptTemplateResponse;
        if (cancelled) return;

        if (!json.success) {
          throw new Error(json.error || 'Failed to load prompt template');
        }

        setState({ status: 'loaded', payload: json });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', error: message || 'Failed to load prompt template' });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const result = state.status === 'loaded' ? state.payload.result : undefined;
  const appleTargetLabel =
    result?.appleTarget != null && Number.isFinite(result.appleTarget)
      ? String(result.appleTarget)
      : 'unknown';

  return (
    <div className="worm-page">
      <WormArenaHeader
        subtitle="Rules & LLM prompt transparency"
        links={[
          { label: 'Replay', href: '/worm-arena' },
          { label: 'Live', href: '/worm-arena/live' },
          { label: 'Matches', href: '/worm-arena/matches' },
          { label: 'Models', href: '/worm-arena/models' },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
          { label: 'Skill Analysis', href: '/worm-arena/skill-analysis' },
          { label: 'Distributions', href: '/worm-arena/distributions' },
          { label: 'Rules', href: '/worm-arena/rules', active: true },
        ]}
        showMatchupLabel={false}
      />

      <main className="p-3 max-w-7xl mx-auto space-y-6">
        <Card className="worm-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold text-worm-ink">Rules (human readable)</CardTitle>
            <div className="text-sm worm-muted">
              Apple target: <span className="font-mono">{appleTargetLabel}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-worm-ink">
            <div className="space-y-1">
              <div className="font-semibold">Board & coordinates</div>
              <div>
                Coordinates use (x,y) with (0,0) at bottom-left. The board is printed as ASCII for the model.
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-semibold">Moves</div>
              <div>The model must choose exactly one move each turn: UP, DOWN, LEFT, or RIGHT.</div>
            </div>

            <div className="space-y-1">
              <div className="font-semibold">Critical output contract</div>
              <div>
                The model is required to end its response with a final non-empty line that is exactly one of:
                <span className="font-mono"> UP</span>, <span className="font-mono">DOWN</span>,{' '}
                <span className="font-mono">LEFT</span>, <span className="font-mono">RIGHT</span>.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="worm-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold text-worm-ink">LLM prompt template (canonical)</CardTitle>
            <div className="text-sm worm-muted">
              This is the TypeScript canonical version (B2) with placeholders.
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {state.status === 'loading' && <div className="text-sm worm-muted">Loading…</div>}
            {state.status === 'error' && <div className="text-sm text-red-700">{state.error}</div>}
            {state.status === 'loaded' && (
              <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-white/70 border worm-border rounded-md p-3 text-worm-ink">
                {safeString(state.payload.result?.canonicalTemplate)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card className="worm-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold text-worm-ink">Live Python prompt builder (extracted)</CardTitle>
            <div className="text-sm worm-muted">
              This is read directly from <span className="font-mono">llm_player.py</span> (B1).
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {state.status === 'loading' && <div className="text-sm worm-muted">Loading…</div>}
            {state.status === 'error' && <div className="text-sm text-red-700">{state.error}</div>}
            {state.status === 'loaded' && (
              <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-white/70 border worm-border rounded-md p-3 text-worm-ink">
                {safeString(state.payload.result?.pythonPromptBuilderBlock)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card className="worm-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold text-worm-ink">Advanced: raw Python source</CardTitle>
            <div className="text-sm worm-muted">
              Full upstream file contents for maximum transparency.
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="python" className="border-b-0">
                <AccordionTrigger className="px-0 py-2 hover:no-underline">
                  <span className="text-sm font-semibold text-worm-ink">Show llm_player.py</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  {state.status === 'loading' && <div className="text-sm worm-muted">Loading…</div>}
                  {state.status === 'error' && <div className="text-sm text-red-700">{state.error}</div>}
                  {state.status === 'loaded' && (
                    <div className="space-y-2">
                      <div className="text-xs worm-muted">
                        Path: <span className="font-mono">{safeString(state.payload.result?.pythonSourcePath)}</span>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-white/70 border worm-border rounded-md p-3 text-worm-ink">
                        {safeString(state.payload.result?.pythonSource)}
                      </pre>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
