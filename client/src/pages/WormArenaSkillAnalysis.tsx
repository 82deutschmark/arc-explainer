/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Worm Arena Skill Distribution Analysis page. Orchestrates model selection (URL-driven),
 *          a three-slice UI (selected list | hero chart | reference list), and the bell curve
 *          visualization to explain why TrueSkill differs from raw W/L ratio.
 *          Reuses shared Worm Arena components (leaderboard, model snapshot, placement card) while
 *          keeping the 3-column layout.
 *          Ensures ratings are fetched by calling useModelRating().refresh() when query params change.
 *          Adds an explicit baseline picker affordance: the reference snapshot's model slug is a button
 *          that clears the baseline.
 *          Uses a wider container so the left model list card does not clip its scroll area.
 *          Simplifies the top section by removing global stat strips and wiring the TrueSkill
 *          leaderboard to select the baseline model.
 *          Restores the baseline snapshot + searchable baseline picker list to avoid regressions.
 * SRP/DRY check: Pass — page-level composition only; rendering delegated to child components.
 *
 * Touches: WormArenaTrueSkillLeaderboard, WormArenaPlacementCard,
 *          WormArenaModelListCard, WormArenaSkillHeroGraphic, WormArenaModelSnapshotCard,
 *          useWormArenaTrueSkillLeaderboard, useModelRating, wouter useSearch.
 */

import React from 'react';
import { useLocation, useSearch } from 'wouter';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaModelListCard from '@/components/wormArena/stats/WormArenaModelListCard';
import WormArenaSkillHeroGraphic from '@/components/wormArena/stats/WormArenaSkillHeroGraphic';
import WormArenaModelSnapshotCard from '@/components/wormArena/stats/WormArenaModelSnapshotCard';
import WormArenaTrueSkillLeaderboard from '@/components/WormArenaTrueSkillLeaderboard';
import WormArenaPlacementCard from '@/components/wormArena/stats/WormArenaPlacementCard';

import useWormArenaTrueSkillLeaderboard from '@/hooks/useWormArenaTrueSkillLeaderboard';
import { useModelRating } from '@/hooks/useSnakeBench';
import { summarizeWormArenaPlacement } from '@shared/utils/wormArenaPlacement';

/**
 * Parse query parameters from URL.
 * Expected format: ?model=<slug>&reference=<slug>
 */
function useQueryParamModels(): { modelSlug: string | null; referenceSlug: string | null } {
  // IMPORTANT: useLocation() may be pathname-only depending on router config.
  // useSearch() is the authoritative query-string source in wouter.
  const search = useSearch();

  try {
    const params = new URLSearchParams(search);
    const model = params.get('model');
    const reference = params.get('reference');
    return {
      modelSlug: model && model.trim() ? model.trim() : null,
      referenceSlug: reference && reference.trim() ? reference.trim() : null,
    };
  } catch {
    return { modelSlug: null, referenceSlug: null };
  }
}

function buildSkillAnalysisUrl({
  modelSlug,
  referenceSlug,
}: {
  modelSlug: string | null | undefined;
  referenceSlug: string | null | undefined;
}): string {
  // Keep URL format stable so the page is linkable and shareable.
  const params = new URLSearchParams();
  if (modelSlug && modelSlug.trim()) params.set('model', modelSlug.trim());
  if (referenceSlug && referenceSlug.trim()) params.set('reference', referenceSlug.trim());
  const qs = params.toString();
  return qs ? `/worm-arena/skill-analysis?${qs}` : '/worm-arena/skill-analysis';
}

/**
 * Main page: Orchestrates the skill distribution story.
 *
 * Layout (top to bottom):
 * 1. Page header with nav links
 * 2. Educational callout: "Why TrueSkill rating ≠ Win/Loss ratio"
 * 3. Model selector (table with W/L vs TrueSkill side-by-side)
 * 4. Selected model's skill estimate and uncertainty badges
 * 5. 99.7% confidence interval display
 * 6. Large bell curve visualization (main hero element)
 * 7. Optional "Learn More" accordion for TrueSkill details
 *
 * TODO for next developer:
 * 1. Fetch all models via useWormArenaTrueSkillLeaderboard(150, 3)
 * 2. Handle URL query params for model selection (default to first model if not provided)
 * 3. Fetch selected model detail via useModelRating(modelSlug)
 * 4. Fetch reference model detail if referenceSlug provided
 * 5. Wire loading/error states for each hook
 * 6. Pass data to child components
 * 7. Implement "Learn More" accordion with TrueSkill explanation (copy from existing snapshot card)
 * 8. Use WormArenaHeader with nav links pointing to other Worm Arena pages
 *
 * Reference implementations:
 * - WormArenaStats.tsx for page structure and hook usage
 * - See lines 35–47 in WormArenaStats for URL query param parsing
 * - See lines 114–150 for layout pattern
 */
export default function WormArenaSkillAnalysis() {
  const [, setLocation] = useLocation();
  const { modelSlug, referenceSlug } = useQueryParamModels();

  const [selectedFilter, setSelectedFilter] = React.useState('');
  const [referenceFilter, setReferenceFilter] = React.useState('');

  // Fetch data
  const { entries: leaderboard, isLoading: loadingLeaderboard, error: errorLeaderboard } =
    useWormArenaTrueSkillLeaderboard(150, 3);

  // Default to first model if not specified.
  const selectedModelSlug = modelSlug || leaderboard[0]?.modelSlug || undefined;

  const listEntries = React.useMemo(
    () =>
      leaderboard.map((entry) => ({
        modelSlug: entry.modelSlug,
        gamesPlayed: entry.gamesPlayed,
        wins: entry.wins,
        losses: entry.losses,
        ties: entry.ties,
      })),
    [leaderboard],
  );

  // Fetch selected model detail
  const {
    rating: selectedModel,
    isLoading: loadingSelected,
    error: errorSelected,
    refresh: refreshSelected,
  } = useModelRating(selectedModelSlug ?? undefined);

  // Fetch reference model detail
  const {
    rating: referenceModel,
    isLoading: loadingReference,
    error: errorReference,
    refresh: refreshReference,
  } = useModelRating(referenceSlug || undefined);

  // Placement info for the reference model (shown in the right column under the snapshot).
  const referencePlacement = React.useMemo(
    () => summarizeWormArenaPlacement(referenceModel ?? undefined),
    [referenceModel],
  );

  const isLoading = loadingLeaderboard || loadingSelected || loadingReference;

  // Intentionally hide the historical games summary in this view (keeps the top area calm).
  const recentActivityLabel = null;

  React.useEffect(() => {
    // useModelRating is explicitly refreshed so this page behaves consistently with other pages.
    if (selectedModelSlug) {
      void refreshSelected(selectedModelSlug);
    }
  }, [selectedModelSlug, refreshSelected]);

  React.useEffect(() => {
    if (referenceSlug && referenceSlug.trim()) {
      void refreshReference(referenceSlug.trim());
    }
  }, [referenceSlug, refreshReference]);

  React.useEffect(() => {
    // Keep a stable default baseline so the right-side snapshot is always present.
    // We pick the most-played model that isn't the currently selected (compare) model.
    if (referenceSlug) return;
    if (!selectedModelSlug) return;
    if (!leaderboard.length) return;

    const defaultBaseline = leaderboard.find((entry) => entry.modelSlug !== selectedModelSlug)?.modelSlug;
    if (!defaultBaseline) return;

    setLocation(
      buildSkillAnalysisUrl({
        modelSlug: selectedModelSlug,
        referenceSlug: defaultBaseline,
      }),
    );
  }, [referenceSlug, selectedModelSlug, leaderboard, setLocation]);

  return (
    <TooltipProvider>
      <div className="worm-page">
        <WormArenaHeader
          subtitle="Skill analysis"
          links={[
            { label: 'Replay', href: '/worm-arena' },
            { label: 'Live', href: '/worm-arena/live' },
            { label: 'Matches', href: '/worm-arena/matches' },
            { label: 'Stats & Placement', href: '/worm-arena/stats' },
            { label: 'Skill Analysis', href: '/worm-arena/skill-analysis', active: true },
          ]}
          showMatchupLabel={false}
        />

        <main className="w-full max-w-[1500px] mx-auto px-4 md:px-6 py-6 space-y-6">
          {/* Thin, centered TrueSkill explainer strip (keeps the page from ending in a giant block). */}
          <div className="flex justify-center">
            <Card className="worm-card w-full max-w-3xl">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="trueskill-explainer" className="border-b-0">
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <div className="w-full flex justify-center">
                      <span className="text-sm font-semibold text-worm-ink">Why TrueSkill?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-1 text-sm text-worm-muted space-y-3">
                    <div>
                      <strong className="text-worm-ink">What is TrueSkill?</strong>
                      <p className="mt-1">
                        TrueSkill is a Bayesian skill rating system developed by Microsoft. Unlike simple win/loss ratios, it accounts for
                        opponent strength and adjusts ratings based on match outcomes.
                      </p>
                    </div>

                    <div>
                      <strong className="text-worm-ink">Why not just use W/L ratio?</strong>
                      <p className="mt-1">
                        A 70% win rate against weak opponents is less impressive than a 50% win rate against strong opponents. TrueSkill
                        captures this nuance by considering who you play against.
                      </p>
                    </div>

                    <div>
                      <strong className="text-worm-ink">
                        What do <InlineMath math="\\mu" /> and <InlineMath math="\\sigma" /> mean?
                      </strong>
                      <p className="mt-1">
                        <InlineMath math="\\mu" /> is the estimated skill level. <InlineMath math="\\sigma" /> is the uncertainty. A small{' '}
                        <InlineMath math="\\sigma" /> means you've played many games and we're confident in your rating. A large{' '}
                        <InlineMath math="\\sigma" /> means you're new or inconsistent.
                      </p>
                    </div>

                    <div>
                      <strong className="text-worm-ink">What is the confidence interval?</strong>
                      <p className="mt-1">
                        The 99.7% confidence interval (<InlineMath math="\\mu \\pm 3\\sigma" />) shows the range where your true skill likely
                        falls. The "pessimistic rating" is the lower bound; the "optimistic rating" is the upper bound.
                      </p>
                    </div>

                    <div>
                      <strong className="text-worm-ink">Why is the bell curve important?</strong>
                      <p className="mt-1">
                        The shape tells the story: narrow curves (small <InlineMath math="\\sigma" />) mean consistent, well-tested skill;
                        wide curves (large <InlineMath math="\\sigma" />) mean uncertain or new models that need more games to establish a
                        reliable rating.
                      </p>
                    </div>

                    <div>
                      <strong className="text-worm-ink">How does leaderboard ranking work?</strong>
                      <p className="mt-1">
                        Models are ranked by their "exposed" rating (<InlineMath math="\\mu - 3\\sigma" />), the pessimistic bound. This
                        rewards both consistency and strength, penalizing new models with high uncertainty.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.6fr)_minmax(360px,1fr)] gap-6 items-start">
            {/* LEFT: Selected model list */}
            <div className="min-w-0">
              <WormArenaModelListCard
                leaderboard={listEntries}
                recentActivityLabel={recentActivityLabel}
                selectedModel={selectedModelSlug ?? null}
                filter={selectedFilter}
                onFilterChange={setSelectedFilter}
                onSelectModel={(slug) => {
                  setLocation(
                    buildSkillAnalysisUrl({
                      modelSlug: slug,
                      referenceSlug,
                    }),
                  );
                }}
                title="Compare model"
                subtitle="Pick the model you want to analyze (blue curve)"
                searchPlaceholder="Search compare model (e.g. openai/gpt-5.1)"
                scrollAreaClassName="h-[520px] max-h-[60vh]"
              />
            </div>

            {/* MIDDLE: Hero graphic (metrics + bell curve as one unified poster) */}
            <div className="min-w-0 bg-white rounded-lg p-8 flex flex-col items-center justify-center min-h-[600px]">
              {selectedModel ? (
                <WormArenaSkillHeroGraphic
                  key={`${selectedModel.modelSlug}-${referenceModel?.modelSlug ?? 'none'}`}
                  mu={selectedModel.mu}
                  sigma={selectedModel.sigma}
                  exposed={selectedModel.exposed}
                  modelLabel={selectedModel.modelSlug}
                  gamesPlayed={selectedModel.gamesPlayed}
                  wins={selectedModel.wins}
                  losses={selectedModel.losses}
                  ties={selectedModel.ties}
                  totalCost={selectedModel.totalCost}
                  referenceMu={referenceModel?.mu}
                  referenceSigma={referenceModel?.sigma}
                  referenceLabel={referenceModel?.modelSlug}
                />
              ) : (
                <div className="text-center text-sm font-semibold text-worm-muted py-20">
                  Select a model from the left list to begin.
                </div>
              )}
            </div>

            {/* RIGHT: Baseline (reference) picker + snapshot */}
            <div className="min-w-0 space-y-4">
              <WormArenaModelListCard
                leaderboard={listEntries}
                recentActivityLabel={null}
                selectedModel={referenceSlug ?? null}
                filter={referenceFilter}
                onFilterChange={setReferenceFilter}
                onSelectModel={(slug) => {
                  setLocation(
                    buildSkillAnalysisUrl({
                      modelSlug: selectedModelSlug,
                      referenceSlug: slug,
                    }),
                  );
                }}
                title="Baseline model"
                subtitle="Pick the model you are comparing against (gray curve)"
                searchPlaceholder="Search baseline model (e.g. deepseek/deepseek-v3.2)"
                scrollAreaClassName="h-[260px] max-h-[34vh]"
              />

              <WormArenaModelSnapshotCard
                rating={referenceModel ?? null}
                isLoading={loadingReference}
                error={errorReference ?? null}
                onModelSlugClick={() => {
                  // Optional shortcut: clear the baseline selection (the searchable picker above stays visible).
                  setLocation(
                    buildSkillAnalysisUrl({
                      modelSlug: selectedModelSlug,
                      referenceSlug: null,
                    }),
                  );
                }}
              />

              <WormArenaPlacementCard placement={referencePlacement} />
            </div>
          </div>

          <WormArenaTrueSkillLeaderboard
            entries={leaderboard}
            isLoading={loadingLeaderboard}
            error={errorLeaderboard}
            variant="compact"
            selectedModelSlug={referenceSlug ?? null}
            onSelectModel={(slug) => {
              // Clicking the TrueSkill leaderboard selects the baseline model (right-side snapshot).
              setLocation(
                buildSkillAnalysisUrl({
                  modelSlug: selectedModelSlug,
                  referenceSlug: slug,
                }),
              );
            }}
          />

          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-sm text-worm-ink">
              <strong>Why the difference?</strong> Win/Loss ratio shows how often a model wins, but doesn't account for
              opponent strength. TrueSkill adjusts for this. Compare a narrow curve (high confidence) against a wide curve
              (uncertain/new model).
            </AlertDescription>
          </Alert>

          {isLoading && (
            <div className="text-sm font-semibold worm-muted">Loading skill analysis…</div>
          )}

          {/* Error States (leaderboard errors are rendered inside WormArenaTrueSkillLeaderboard) */}

          {errorSelected && selectedModelSlug && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-sm text-red-700">
                Error loading model details: {errorSelected}
              </AlertDescription>
            </Alert>
          )}

          {errorReference && referenceSlug && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-sm text-red-700">
                Error loading reference model details: {errorReference}
              </AlertDescription>
            </Alert>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
