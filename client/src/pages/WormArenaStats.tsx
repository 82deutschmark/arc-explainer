/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: Worm Arena Stats & Placement page. Shows global Worm Arena
 *          aggregates, model-centric TrueSkill snapshots, placement
 *          progress, and recent match history. Backed entirely by
 *          SnakeBench DB tables via public ARC Explainer APIs.
 * SRP/DRY check: Pass page-level composition only, delegates data
 *                fetching to dedicated hooks and shared helpers.
 */

import React from "react";
import { useLocation } from "wouter";

import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import WormArenaHeader from "@/components/WormArenaHeader";
import useWormArenaStats from "@/hooks/useWormArenaStats";
import {
  useSnakeBenchStats,
  useModelRating,
  useModelHistory,
} from "@/hooks/useSnakeBench";
import useWormArenaTrueSkillLeaderboard from "@/hooks/useWormArenaTrueSkillLeaderboard";
import WormArenaTrueSkillLeaderboard from "@/components/WormArenaTrueSkillLeaderboard";
import { summarizeWormArenaPlacement } from "@shared/utils/wormArenaPlacement.ts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

function DataNumber({
  children,
  size = "xl",
}: {
  children: React.ReactNode;
  size?: "lg" | "xl";
}) {
  const baseClasses =
    "inline-flex items-baseline px-2.5 py-0.5 rounded-md bg-[#e4f2e9] border border-[#9ece6a] font-extrabold leading-tight";
  const sizeClass = size === "xl" ? " text-3xl" : " text-xl";
  return (
    <span className={baseClasses + sizeClass} style={{ color: "#064e3b" }}>
      {children}
    </span>
  );
}

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

  const {
    historyForTable,
    isLoading: loadingHistory,
    error: historyError,
    refresh: refreshHistory,
  } = useModelHistory(selectedModel ?? undefined, 1000);

  React.useEffect(() => {
    if (selectedModel) {
      void refreshRating(selectedModel);
      void refreshHistory(selectedModel);
    }
  }, [selectedModel, refreshRating, refreshHistory]);

  React.useEffect(() => {
    if (!selectedModel && leaderboard.length > 0) {
      setSelectedModel(leaderboard[0].modelSlug);
    }
  }, [leaderboard, selectedModel]);

  const placement = React.useMemo(
    () => summarizeWormArenaPlacement(rating ?? undefined),
    [rating],
  );

  const filteredLeaderboard = React.useMemo(() => {
    const term = filter.trim().toLowerCase();
    const sorted = [...leaderboard].sort(
      (a, b) => (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0),
    );
    if (!term) return sorted;
    return sorted.filter((entry) =>
      entry.modelSlug.toLowerCase().includes(term),
    );
  }, [leaderboard, filter]);

  const handleSelectModel = (slug: string) => {
    setSelectedModel(slug);
  };

  const pessimisticEquation = React.useMemo(() => {
    if (!rating) return null;
    const mu = rating.mu.toFixed(2);
    const sigma = rating.sigma.toFixed(2);
    const exposed = rating.exposed.toFixed(2);
    return `\\mu - 3\\sigma = ${mu} - 3 \\times ${sigma} \\approx ${exposed}`;
  }, [rating]);

  const placementEquation = React.useMemo(() => {
    if (!placement) return null;
    const progressPercent = Math.round(placement.progress * 100);
    return `\\text{progress} = \\frac{${placement.gamesPlayed}}{${placement.maxGames}} \\approx ${progressPercent}\\%`;
  }, [placement]);

  return (
    <TooltipProvider>
      <div
        className="min-h-screen"
        style={{ backgroundColor: "#f5e6d3", fontFamily: "Fredoka, Nunito, sans-serif" }}
      >
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />

        <WormArenaHeader
        totalGames={globalStats?.totalGames ?? 0}
        links={[
          { label: "Replay", href: "/worm-arena" },
          { label: "Live", href: "/worm-arena/live" },
          { label: "Stats & Placement", href: "/worm-arena/stats", active: true },
        ]}
        showMatchupLabel={false}
      />

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Global strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#faf6f1] border-[#d4b5a0]">
            <CardHeader className="py-3">
              <CardTitle
                className="text-base font-bold"
                style={{ color: "#3d2817" }}
              >
                Total matches
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <DataNumber>{globalStats?.totalGames ?? 0}</DataNumber>
            </CardContent>
          </Card>

          <Card className="bg-[#faf6f1] border-[#d4b5a0]">
            <CardHeader className="py-3">
              <CardTitle
                className="text-base font-bold"
                style={{ color: "#3d2817" }}
              >
                Models competing
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <DataNumber>{globalStats?.activeModels ?? 0}</DataNumber>
            </CardContent>
          </Card>

          <Card className="bg-[#faf6f1] border-[#d4b5a0]">
            <CardHeader className="py-3">
              <CardTitle
                className="text-base font-bold"
                style={{ color: "#3d2817" }}
              >
                Top apples (single game)
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <DataNumber>{globalStats?.topApples ?? 0}</DataNumber>
            </CardContent>
          </Card>

          <Card className="bg-[#faf6f1] border-[#d4b5a0]">
            <CardHeader className="py-3">
              <CardTitle
                className="text-base font-bold"
                style={{ color: "#3d2817" }}
              >
                Total testing cost
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <DataNumber>
                ${globalStats?.totalCost?.toFixed
                  ? globalStats.totalCost.toFixed(2)
                  : globalStats?.totalCost ?? 0}
              </DataNumber>
            </CardContent>
          </Card>
        </div>

        {/* TrueSkill leaderboard (global Worm Arena rankings) */}
        <WormArenaTrueSkillLeaderboard
          entries={trueSkillEntries}
          isLoading={loadingTrueSkill}
          error={trueSkillError}
        />

        {/* Models + snapshot/placement row */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 items-start">
          {/* Models list (large) */}
          <Card className="bg-[#faf6f1] border-[#d4b5a0]">
            <CardHeader className="pb-3 flex flex-row items-baseline justify-between">
              <div>
                <CardTitle
                  className="text-lg font-bold"
                  style={{ color: "#3d2817" }}
                >
                  Models
                </CardTitle>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "#7a6b5f" }}
                >
                  Sorted by games played (most to least)
                </div>
              </div>
              {recentActivity && (
                <div
                  className="text-sm font-semibold text-right"
                  style={{ color: "#3d2817" }}
                >
                  <div>
                    {recentActivity.days && recentActivity.days > 0 ? (
                      <>
                        Last {recentActivity.days} days: {recentActivity.gamesPlayed} games
                      </>
                    ) : (
                      <>All history: {recentActivity.gamesPlayed} games</>
                    )}
                  </div>
                  <div>Models with games: {recentActivity.uniqueModels}</div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search model (e.g. openai/gpt-5.1)"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-base font-semibold"
                style={{ color: "#3d2817" }}
              />
              <ScrollArea className="h-[60vh] border rounded-md bg-white/90">
                <div className="p-3 space-y-2">
                  {filteredLeaderboard.map((entry, index) => {
                    const active = entry.modelSlug === selectedModel;
                    return (
                      <button
                        key={entry.modelSlug}
                        type="button"
                        onClick={() => handleSelectModel(entry.modelSlug)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded border transition-colors ${
                          active
                            ? "bg-[#1a2f23] text-[#faf6f1] border-[#1a2f23]"
                            : "bg-white text-[#1f130a] border-[#d4b5a0] hover:bg-[#faf6f1]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="text-xs font-bold"
                            style={{ color: active ? "#f5e6d3" : "#7a6b5f" }}
                          >
                            #{index + 1}
                          </span>
                          <span className="truncate font-mono">{entry.modelSlug}</span>
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-right">
                          <div>{entry.gamesPlayed} games</div>
                          <div
                            className="text-[11px]"
                            style={{ color: active ? "#f5e6d3" : "#7a6b5f" }}
                          >
                            {entry.wins}W / {entry.losses}L / {entry.ties}T
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredLeaderboard.length === 0 && (
                    <div
                      className="text-sm text-center font-semibold py-6"
                      style={{ color: "#7a6b5f" }}
                    >
                      No models yet. Run a few matches to populate stats.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Snapshot + placement */}
          <div className="space-y-4">
            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-lg font-bold flex items-center justify-between"
                  style={{ color: "#3d2817" }}
                >
                  <span>Model snapshot</span>
                  {rating?.modelSlug && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {rating.modelSlug}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent
                className="space-y-4 text-sm"
                style={{ color: "#3d2817" }}
              >
                {loadingRating && (
                  <div className="text-sm font-semibold">Loading rating...</div>
                )}
                {ratingError && (
                  <div className="text-sm font-semibold text-red-700">{ratingError}</div>
                )}
                {!loadingRating && !rating && !ratingError && (
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "#7a6b5f" }}
                  >
                    Select a model in the list to see its rating details.
                  </div>
                )}

                {rating && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div
                          className="text-sm font-bold flex items-center gap-2"
                          style={{ color: "#3d2817" }}
                        >
                          <span>Skill estimate</span>
                          <InlineMath math={"\\mu"} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 cursor-help" style={{ color: "#7a6b5f" }} />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              Higher is better. This is the center of the model's estimated skill distribution.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <DataNumber>{rating.mu.toFixed(2)}</DataNumber>
                        <div
                          className="text-xs font-mono mt-1"
                          style={{ color: "#3d2817" }}
                        >
                          <InlineMath math={"\\mu"} /> is the centre of the model skill
                          distribution.
                        </div>
                      </div>

                      <div>
                        <div
                          className="text-sm font-bold flex items-center gap-2"
                          style={{ color: "#3d2817" }}
                        >
                          <span>Uncertainty</span>
                          <InlineMath math={"\\sigma"} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 cursor-help" style={{ color: "#7a6b5f" }} />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              Bigger σ = less certain about skill. Smaller is better (more confidence in the rating).
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <DataNumber>{rating.sigma.toFixed(2)}</DataNumber>
                        <div
                          className="text-xs font-mono mt-1"
                          style={{ color: "#3d2817" }}
                        >
                          Most skill lies in
                          {" "}
                          <InlineMath math={"\\mu \\pm 3\\sigma"} />.
                        </div>
                      </div>

                      <div>
                        <div
                          className="text-sm font-bold flex items-center gap-2"
                          style={{ color: "#3d2817" }}
                        >
                          <span>Pessimistic rating</span>
                          <InlineMath math={"\\mu - 3\\sigma"} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 cursor-help" style={{ color: "#7a6b5f" }} />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              Conservative lower bound: the skill rating we'd guarantee with 99.7% confidence.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <DataNumber>{rating.exposed.toFixed(2)}</DataNumber>
                        {pessimisticEquation && (
                          <div
                            className="text-xs font-mono mt-1"
                            style={{ color: "#3d2817" }}
                          >
                            <InlineMath math={pessimisticEquation} />
                          </div>
                        )}
                      </div>

                      <div>
                        <div
                          className="text-sm font-bold flex items-center gap-2"
                          style={{ color: "#3d2817" }}
                        >
                          <span>Leaderboard score</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 cursor-help" style={{ color: "#7a6b5f" }} />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              Display ranking (scaled from μ ≈ 0–50). Higher scores rank higher on the leaderboard.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <DataNumber>{rating.displayScore.toFixed(0)}</DataNumber>
                        <div
                          className="text-xs font-mono mt-1"
                          style={{ color: "#3d2817" }}
                        >
                          Scaled from TrueSkill rating for display.
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3 text-sm mt-2">
                      <div>
                        <div
                          className="font-bold"
                          style={{ color: "#3d2817" }}
                        >
                          Games
                        </div>
                        <DataNumber size="lg">{rating.gamesPlayed}</DataNumber>
                      </div>
                      <div>
                        <div
                          className="font-bold"
                          style={{ color: "#3d2817" }}
                        >
                          Wins
                        </div>
                        <DataNumber size="lg">{rating.wins}</DataNumber>
                      </div>
                      <div>
                        <div
                          className="font-bold"
                          style={{ color: "#3d2817" }}
                        >
                          Losses
                        </div>
                        <DataNumber size="lg">{rating.losses}</DataNumber>
                      </div>
                      <div>
                        <div
                          className="font-bold"
                          style={{ color: "#3d2817" }}
                        >
                          Ties
                        </div>
                        <DataNumber size="lg">{rating.ties}</DataNumber>
                      </div>
                      <div>
                        <div
                          className="font-bold flex items-center gap-1"
                          style={{ color: "#3d2817" }}
                        >
                          <span>Testing cost</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 cursor-help" style={{ color: "#7a6b5f" }} />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              Total USD spent testing this model via LLM API calls.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div
                          className="inline-flex items-baseline px-2.5 py-0.5 rounded-md bg-[#f0e5d8] border border-[#d4b5a0] font-bold text-sm"
                          style={{ color: "#3d2817" }}
                        >
                          ${rating.totalCost.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {/* Math legend */}
                    <div
                      className="mt-4 p-3 rounded-md border bg-white/80 text-xs"
                      style={{ borderColor: "#d4b5a0", color: "#3d2817" }}
                    >
                      <div className="font-semibold mb-1">TrueSkill legend</div>
                      <div className="space-y-1">
                        <div>
                          <InlineMath math={"\\mu"} /> : skill estimate.
                        </div>
                        <div>
                          <InlineMath math={"\\sigma"} /> : uncertainty (spread of the
                          estimate).
                        </div>
                        <div>
                          <InlineMath math={"\\mu - 3\\sigma"} /> : conservative lower
                          bound we use as the pessimistic rating.
                        </div>
                        <div>
                          Numbers shown with the green pill highlight are live metrics
                          pulled directly from Worm Arena games.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-lg font-bold"
                  style={{ color: "#3d2817" }}
                >
                  Placement status
                </CardTitle>
              </CardHeader>
              <CardContent
                className="space-y-3 text-sm"
                style={{ color: "#3d2817" }}
              >
                {placement ? (
                  <>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>{placement.label}</span>
                      <Badge variant="outline" className="text-xs font-bold">
                        {placement.gamesPlayed}/{placement.maxGames} games
                      </Badge>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#e5d5c5] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(placement.progress * 100)}%`,
                          background:
                            placement.phase === "complete" ||
                            placement.phase === "effectively_complete"
                              ? "#9ece6a"
                              : "#c85a3a",
                        }}
                      />
                    </div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: "#7a6b5f" }}
                    >
                      {placement.description}
                    </div>
                    {placementEquation && (
                      <div
                        className="text-xs font-mono"
                        style={{ color: "#3d2817" }}
                      >
                        <InlineMath math={placementEquation} />
                      </div>
                    )}
                    <div
                      className="text-xs font-semibold"
                      style={{ color: "#7a6b5f" }}
                    >
                      We aim for roughly nine good games per model; we can stop
                      earlier if sigma is already low, or keep playing for more
                      precision.
                    </div>
                  </>
                ) : (
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "#7a6b5f" }}
                  >
                    Select a model to see placement progress.
                  </div>
                )}

                {rating && rating.isActive === false && (
                  <div
                    className="text-xs font-semibold border-t pt-2 mt-2"
                    style={{ color: "#7a6b5f" }}
                  >
                    This model is currently inactive, but its stats are preserved.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* History table */}
        <Card className="bg-[#faf6f1] border-[#d4b5a0]">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-lg font-bold"
              style={{ color: "#3d2817" }}
            >
              Recent matches
            </CardTitle>
          </CardHeader>
          <CardContent
            className="space-y-3 text-sm"
            style={{ color: "#3d2817" }}
          >
            {loadingHistory && (
              <div
                className="text-sm font-semibold"
                style={{ color: "#7a6b5f" }}
              >
                Loading history...
              </div>
            )}
            {historyError && (
              <div className="text-sm font-semibold text-red-700">{historyError}</div>
            )}

            {historyForTable.length === 0 && !loadingHistory && !historyError && (
              <div
                className="text-sm font-semibold"
                style={{ color: "#7a6b5f" }}
              >
                No games yet for this model.
              </div>
            )}

            {historyForTable.length > 0 && (
              <ScrollArea className="max-h-[60vh] border rounded-md bg-white/90">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="whitespace-nowrap font-bold"
                        style={{ color: "#3d2817" }}
                      >
                        When
                      </TableHead>
                      <TableHead
                        className="font-bold"
                        style={{ color: "#3d2817" }}
                      >
                        Opponent
                      </TableHead>
                      <TableHead
                        className="font-bold"
                        style={{ color: "#3d2817" }}
                      >
                        Result
                      </TableHead>
                      <TableHead
                        className="font-bold"
                        style={{ color: "#3d2817" }}
                      >
                        Score
                      </TableHead>
                      <TableHead
                        className="font-bold"
                        style={{ color: "#3d2817" }}
                      >
                        Rounds
                      </TableHead>
                      <TableHead
                        className="font-bold"
                        style={{ color: "#3d2817" }}
                      >
                        Death reason
                      </TableHead>
                      <TableHead
                        className="font-bold"
                        style={{ color: "#3d2817" }}
                      >
                        Replay
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyForTable.map((row) => {
                      const dt = row.startedAt ? new Date(row.startedAt) : null;
                      const when = dt ? dt.toLocaleString() : "";
                      const score = `${row.myScore}-${row.opponentScore}`;
                      return (
                        <TableRow key={row.gameId}>
                          <TableCell className="whitespace-nowrap">{when}</TableCell>
                          <TableCell>{row.opponentSlug || "Unknown"}</TableCell>
                          <TableCell className="capitalize">{row.result}</TableCell>
                          <TableCell>{score}</TableCell>
                          <TableCell>{row.rounds}</TableCell>
                          <TableCell>{row.deathReason ?? ""}</TableCell>
                          <TableCell>
                            <a
                              href={`/worm-arena?gameId=${encodeURIComponent(row.gameId)}`}
                              className="underline text-sm font-semibold"
                            >
                              View replay
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
      </div>
    </TooltipProvider>
  );
}
