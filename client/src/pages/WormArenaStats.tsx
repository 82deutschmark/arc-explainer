/**
 * Author: Cascade
 * Date: 2025-12-20
 * PURPOSE: Worm Arena stats page - shows global stats and the Worm Arena leaderboard.
 *          This is a read-only analytics view backed by SnakeBenchRepository.
 * SRP/DRY check: Pass - page composition only.
 */

import React from "react";
import { useLocation } from "wouter";
import "katex/dist/katex.min.css";

import WormArenaHeader from "@/components/WormArenaHeader";
import WormArenaGreatestHits from "@/components/WormArenaGreatestHits";
import WormArenaSuggestedMatchups from "@/components/WormArenaSuggestedMatchups";
import useWormArenaStats from "@/hooks/useWormArenaStats";
import {
  useSnakeBenchStats,
  useModelRating,
} from "@/hooks/useSnakeBench";
import useWormArenaTrueSkillLeaderboard from "@/hooks/useWormArenaTrueSkillLeaderboard";
import WormArenaTrueSkillLeaderboard from "@/components/WormArenaTrueSkillLeaderboard";
import { summarizeWormArenaPlacement } from "@shared/utils/wormArenaPlacement.ts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";

import WormArenaGlobalStatsStrip from "@/components/wormArena/stats/WormArenaGlobalStatsStrip";
import WormArenaModelListCard from "@/components/wormArena/stats/WormArenaModelListCard";
import WormArenaModelSnapshotCard from "@/components/wormArena/stats/WormArenaModelSnapshotCard";
import WormArenaPlacementCard from "@/components/wormArena/stats/WormArenaPlacementCard";

function useQueryParamModel(): string | null {
  const [location] = useLocation();

  try {
    const query = location.split("?")[1] ?? "";
    if (!query) return null;
    const params = new URLSearchParams(query);
    const model = params.get("model");
    return model && model.trim().length > 0 ? model.trim() : null;
  } catch {
    return null;
  }
}

export default function WormArenaStats() {
  const queryModel = useQueryParamModel();

  const { leaderboard, recentActivity } = useWormArenaStats();
  const { stats: globalStats } = useSnakeBenchStats();
  const {
    entries: trueSkillEntries,
    isLoading: loadingTrueSkill,
    error: trueSkillError,
  } = useWormArenaTrueSkillLeaderboard(150, 3);

  const [selectedModel, setSelectedModel] = React.useState<string | null>(queryModel);
  const [filter, setFilter] = React.useState("");

  const {
    rating,
    isLoading: loadingRating,
    error: ratingError,
    refresh: refreshRating,
  } = useModelRating(selectedModel ?? undefined);

  React.useEffect(() => {
    if (selectedModel) {
      void refreshRating(selectedModel);
    }
  }, [selectedModel, refreshRating]);

  React.useEffect(() => {
    if (!selectedModel && leaderboard.length > 0) {
      setSelectedModel(leaderboard[0].modelSlug);
    }
  }, [leaderboard, selectedModel]);

  const placement = React.useMemo(
    () => summarizeWormArenaPlacement(rating ?? undefined),
    [rating],
  );

  const handleSelectModel = (slug: string) => {
    setSelectedModel(slug);
  };

  const recentActivityLabel = React.useMemo(() => {
    if (!recentActivity) return null;
    if (recentActivity.days && recentActivity.days > 0) {
      return `Last ${recentActivity.days} days: ${recentActivity.gamesPlayed} games\nModels with games: ${recentActivity.uniqueModels}`;
    }
    return `All history: ${recentActivity.gamesPlayed} games\nModels with games: ${recentActivity.uniqueModels}`;
  }, [recentActivity]);

  return (
    <TooltipProvider>
      <div className="worm-page">
        <WormArenaHeader
        totalGames={globalStats?.totalGames ?? 0}
        links={[
          { label: "Replay", href: "/worm-arena" },
          { label: "Live", href: "/worm-arena/live" },
          { label: "Matches", href: "/worm-arena/matches" },
          { label: "Models", href: "/worm-arena/models" },
          { label: "Stats & Placement", href: "/worm-arena/stats", active: true },
          { label: "Skill Analysis", href: "/worm-arena/skill-analysis" },
        ]}
        showMatchupLabel={false}
        compact
      />

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        <WormArenaGlobalStatsStrip stats={globalStats ?? null} />

        {/* TrueSkill leaderboard (global Worm Arena rankings) */}
        <WormArenaTrueSkillLeaderboard
          entries={trueSkillEntries}
          isLoading={loadingTrueSkill}
          error={trueSkillError}
          selectedModelSlug={selectedModel}
          onSelectModel={handleSelectModel}
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 items-start">
          <WormArenaModelListCard
            leaderboard={leaderboard}
            recentActivityLabel={recentActivityLabel}
            selectedModel={selectedModel}
            filter={filter}
            onFilterChange={setFilter}
            onSelectModel={handleSelectModel}
          />

          <div className="space-y-4">
            <WormArenaModelSnapshotCard
              rating={rating ?? null}
              isLoading={loadingRating}
              error={ratingError}
            />

            <WormArenaPlacementCard placement={placement} />

            {rating && rating.isActive === false && (
              <Card className="worm-card">
                <CardContent className="text-xs font-semibold pt-4 worm-muted">
                  This model is currently inactive, but its stats are preserved.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Suggested matchups + Greatest hits side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <WormArenaSuggestedMatchups limit={10} />
          <WormArenaGreatestHits />
        </div>
      </main>
      </div>
    </TooltipProvider>
  );
}
