/**
 * Author: Claude Opus 5.5 Medium
 * Date: 3-November-2026
 * PURPOSE: /arc2/hard-set/lookalikes: one generated puzzle per kind from the ARC-AGI-2 synthetic training
 *          set built in October 2026, beside the real puzzle each kind copies. Each card gives the rule in
 *          one sentence, two worked examples and a question whose answer stays hidden until asked for.
 *          Grouped by Jack Cole's tiers (never, rarely, sometimes solved). What training on these did is
 *          on the findings page, which this page links to rather than repeats.
 * SRP/DRY check: Pass - data from shared/arc2Lookalikes.ts, nicknames from shared/arc2HardSet.ts, grids
 *          via TinyGrid; this page only lays them out.
 * shadcn/ui: Pass - Badge, Button.
 */

import React, { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ARC2_HARD_SET_NOTES } from '@shared/arc2HardSet';
import {
  ARC2_LOOKALIKES,
  ARC2_LOOKALIKE_TIER_LABELS,
  type Arc2Lookalike,
  type LookalikeTier,
} from '@shared/arc2Lookalikes';

const TIERS: LookalikeTier[] = ['never', 'rare', 'sometimes'];

/** A grid at a fixed cell size, so a one-column answer stays a thin column instead of filling the card. */
function SizedGrid({ grid }: { grid: number[][] }) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cell = Math.max(3, Math.min(10, Math.floor(150 / Math.max(rows, cols))));
  return (
    <div style={{ width: cols * cell, maxWidth: '100%' }}>
      <TinyGrid grid={grid} />
    </div>
  );
}

function Pair({ label, input, output }: { label: string; input: number[][]; output: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <SizedGrid grid={input} />
      </div>
      <span className="text-muted-foreground" aria-hidden>→</span>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">&nbsp;</div>
        {output}
      </div>
    </div>
  );
}

function LookalikeCard({ item }: { item: Arc2Lookalike }) {
  const [shown, setShown] = useState(false);
  const note = ARC2_HARD_SET_NOTES[item.realId];
  const name = note?.nickname ?? item.nickname ?? item.family;
  return (
    <section className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold">{name}</h3>
        <Link href={`/puzzle/${item.realId}`} className="text-sm text-primary hover:underline">
          the real puzzle
        </Link>
      </div>
      <p className="text-sm leading-relaxed">{item.rule}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        {item.examples.map((pair, i) => (
          <Pair key={i} label={`Example ${i + 1}`} input={pair.input} output={<SizedGrid grid={pair.output} />} />
        ))}
      </div>
      <div className="border-t border-dashed pt-4">
        <Pair
          label="Your turn"
          input={item.question.input}
          output={
            shown ? (
              <SizedGrid grid={item.question.output} />
            ) : (
              <Button size="sm" onClick={() => setShown(true)}>Show the answer</Button>
            )
          }
        />
      </div>
    </section>
  );
}

export default function Arc2HardSetLookalikes() {
  usePageMeta({
    title: 'ARC-AGI-2 lookalike puzzles',
    description:
      'One generated puzzle per kind from our ARC-AGI-2 synthetic training set, each copying a real puzzle that models rarely or never solve.',
    canonicalPath: '/arc2/hard-set/lookalikes',
  });

  return (
    <article className="mx-auto max-w-5xl space-y-8 px-4 py-7 sm:py-10">
      <header className="max-w-3xl space-y-3 leading-relaxed">
        <Link href="/arc2/hard-set" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> The hard set
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Lookalike puzzles</h1>
        <p>
          In October 2026 the team made tens of thousands of new puzzles to train our ARC-AGI-2 Kaggle entry.
          Each kind copies one real public-eval puzzle that models rarely or never solve. A kind was only
          allowed to exist once a program reproduced every example and every test answer of its real
          puzzle, and that same program made and checked these, so every answer below is right. None of them
          repeats a real puzzle.
        </p>
        <p>
          Here is one of each: the rule in one sentence, two worked examples, and a question to try before
          showing the answer.
        </p>
        <p className="text-sm">
          <Link href="/arc2/hard-set/findings#training" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            What training on them did <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </header>

      {TIERS.map((tier) => {
        const items = ARC2_LOOKALIKES.filter((item) => item.tier === tier);
        if (items.length === 0) return null;
        return (
          <div key={tier} className="space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              {ARC2_LOOKALIKE_TIER_LABELS[tier]}
              <Badge variant="secondary">{items.length}</Badge>
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => (
                <LookalikeCard key={item.family} item={item} />
              ))}
            </div>
          </div>
        );
      })}

      <p className="max-w-3xl text-sm text-muted-foreground">
        Tiers follow Jack Cole's count of how often his own model runs solved the real puzzle. The generators
        live in the team repository, sonpham-org/autoresearch-arena, under arc2/synth_hardset.
      </p>
    </article>
  );
}
