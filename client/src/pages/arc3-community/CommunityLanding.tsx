/*
Author: GPT-5 Codex
Date: 2026-02-06T00:00:00Z
PURPOSE: ARC3 landing page game gallery. Renders official/community games as card grids with
         accurate runtime metadata from the backend (levels + action-space counts), without
         speculative teaser descriptions. Uses a bright, high-contrast ARC3 palette direction
         with solid pixel color bands (no texture overlays) while reusing shared pixel UI
         primitives from Arc3PixelUI.
SRP/DRY check: Pass - page-only composition; shared primitives and data fetching reused.
*/

import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Github, Play, Upload, BookOpen, Gamepad2, Loader2, Users } from 'lucide-react';
import { Arc3PixelPage, PixelButton, PaletteStrip, GameCard } from '@/components/arc3-community/Arc3PixelUI';
import { ARC3_COLORS } from '@/utils/arc3Colors';

// Vivid palette indices for game card accents (skip grays 0-5)
const ACCENT_CYCLE = [9, 14, 6, 11, 15, 12, 8, 10, 7, 13];

interface CommunityGame {
  id: number;
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
  levelCount?: number;
  actionCount?: number | null;
  tags?: string[];
}

interface GamesListResponse {
  success: boolean;
  data: {
    games: CommunityGame[];
    total: number;
  };
}

const ARCENGINE_REPO = 'https://github.com/arcprize/ARCEngine';
const COMMUNITY_LANDING_VARS: Record<string, string> = {
  '--arc3-bg': ARC3_COLORS[0],
  '--arc3-bg-soft': ARC3_COLORS[1],
  '--arc3-panel': ARC3_COLORS[0],
  '--arc3-panel-soft': ARC3_COLORS[1],
  '--arc3-border': ARC3_COLORS[3],
  '--arc3-text': ARC3_COLORS[5],
  '--arc3-muted': ARC3_COLORS[4],
  '--arc3-dim': ARC3_COLORS[3],
  '--arc3-focus': ARC3_COLORS[9],
};

function formatCount(value: number | null | undefined, noun: string): string | null {
  if (value == null || value <= 0) return null;
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

function buildGameStats(game: CommunityGame): string {
  const chunks = [
    formatCount(game.levelCount, 'level'),
    formatCount(game.actionCount, 'action'),
  ].filter((value): value is string => Boolean(value));

  return chunks.join(', ');
}

export default function CommunityLanding() {
  const [, setLocation] = useLocation();

  // Fetch ALL approved games (official submodule + community) - the main content of this page
  const { data: gamesData, isLoading } = useQuery<GamesListResponse>({
    queryKey: ['/api/arc3-community/games?orderBy=playCount&orderDir=DESC&limit=50'],
  });

  const games = gamesData?.data?.games ?? [];
  const arcPrizeGames = games.filter((g) => g.authorName === 'ARC Prize Foundation');
  const teamGames = games.filter((g) => g.authorName !== 'ARC Prize Foundation');

  return (
    <Arc3PixelPage vars={COMMUNITY_LANDING_VARS}>
      {/* 16-color palette strip as top visual identity */}
      <PaletteStrip cellHeight={8} />

      {/* Pixel-forward hero with solid color blocks (no texture overlays). */}
      <div className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-panel)]">
        <div className="h-1.5 flex">
          {[14, 11, 12, 9, 6, 15, 8, 10, 14, 11, 12, 9, 6, 15, 8, 10].map((colorIndex, index) => (
            <div key={index} className="flex-1" style={{ backgroundColor: ARC3_COLORS[colorIndex] }} />
          ))}
        </div>
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="shrink-0 grid grid-cols-4 gap-[2px] p-1 border-2 border-[var(--arc3-border)] bg-[var(--arc3-c0)]"
              aria-hidden="true"
            >
              {[9, 14, 11, 6, 8, 15, 12, 10, 7, 13, 9, 14, 11, 6, 8, 15].map((c, i) => (
                <div key={i} className="w-2.5 h-2.5" style={{ backgroundColor: ARC3_COLORS[c] }} />
              ))}
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight leading-tight">
                <span className="text-[var(--arc3-c9)]">ARC-AGI-3</span>
                <span className="text-[var(--arc3-dim)] font-normal text-xs ml-2">Interactive Reasoning Benchmarks</span>
              </h1>
              <p className="text-[11px] text-[var(--arc3-muted)] leading-snug mt-0.5">
                Play 2D Python games built on the ARCEngine sprite runtime. 64x64 pixel grids, 16-color palette.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
                {[14, 11, 12, 9, 6, 15].map((colorIndex) => (
                  <span
                    key={colorIndex}
                    className="inline-block w-6 h-1.5 border border-[var(--arc3-border)]"
                    style={{ backgroundColor: ARC3_COLORS[colorIndex] }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:grid grid-cols-3 gap-1" aria-hidden="true">
              {[14, 11, 12, 9, 6, 15].map((colorIndex, idx) => (
                <span
                  key={`${colorIndex}-${idx}`}
                  className="w-2.5 h-2.5 border border-[var(--arc3-border)]"
                  style={{ backgroundColor: ARC3_COLORS[colorIndex] }}
                />
              ))}
            </div>
            <PixelButton tone="green" onClick={() => setLocation('/arc3/upload')}>
              <Upload className="w-4 h-4" />
              Submit Game
            </PixelButton>
          </div>
        </div>
        <div className="h-1.5 flex">
          {[10, 8, 15, 6, 9, 12, 11, 14, 10, 8, 15, 6, 9, 12, 11, 14].map((colorIndex, index) => (
            <div key={index} className="flex-1" style={{ backgroundColor: ARC3_COLORS[colorIndex] }} />
          ))}
        </div>
      </div>

      {/* Main content: game grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Gamepad2 className="w-5 h-5 text-[var(--arc3-c14)]" />
          <h2 className="text-sm font-semibold">Official & Community Games</h2>
          <span className="text-[11px] text-[var(--arc3-dim)]">
            {games.length > 0 ? `${games.length} available` : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--arc3-c9)] animate-spin" />
            <span className="ml-3 text-sm text-[var(--arc3-dim)]">Loading games...</span>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel)]">
            <Gamepad2 className="w-10 h-10 text-[var(--arc3-dim)] mx-auto mb-3" />
            <p className="text-sm text-[var(--arc3-muted)]">No games available yet.</p>
            <p className="text-[11px] text-[var(--arc3-dim)] mt-1">
              Games load from the ARCEngine submodule. Check server logs if this persists.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ARC Prize Foundation games */}
            {arcPrizeGames.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--arc3-c11)]">
                    ARC Prize Foundation
                  </h3>
                  <span className="text-[10px] text-[var(--arc3-dim)]">
                    {arcPrizeGames.length} {arcPrizeGames.length === 1 ? 'game' : 'games'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {arcPrizeGames.map((game, idx) => {
                    const stats = buildGameStats(game);
                    return (
                      <GameCard
                        key={game.gameId}
                        accentIndex={ACCENT_CYCLE[idx % ACCENT_CYCLE.length]}
                        onClick={() => setLocation(`/arc3/play/${game.gameId}`)}
                      >
                        <div className="p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold truncate">{game.displayName}</span>
                            {game.tags?.includes('official') && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 shrink-0"
                                style={{ backgroundColor: ARC3_COLORS[11], color: ARC3_COLORS[5] }}
                              >
                                OFFICIAL
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[var(--arc3-dim)]">
                            <div className="flex items-center gap-1 min-w-0">
                              <Users className="w-3 h-3 shrink-0" />
                              <span className="truncate">{game.authorName}</span>
                            </div>
                            {stats && <span className="shrink-0">{stats}</span>}
                          </div>
                          <PixelButton
                            tone="green"
                            onClick={() => setLocation(`/arc3/play/${game.gameId}`)}
                            className="w-full mt-1"
                          >
                            <Play className="w-4 h-4" />
                            Play
                          </PixelButton>
                        </div>
                      </GameCard>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ARC Explainer team games */}
            {teamGames.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--arc3-c14)]">
                    ARC Explainer
                  </h3>
                  <span className="text-[10px] text-[var(--arc3-dim)]">
                    {teamGames.length} {teamGames.length === 1 ? 'game' : 'games'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamGames.map((game, idx) => {
                    const stats = buildGameStats(game);
                    return (
                      <GameCard
                        key={game.gameId}
                        accentIndex={ACCENT_CYCLE[(arcPrizeGames.length + idx) % ACCENT_CYCLE.length]}
                        onClick={() => setLocation(`/arc3/play/${game.gameId}`)}
                      >
                        <div className="p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold truncate">{game.displayName}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[var(--arc3-dim)]">
                            <div className="flex items-center gap-1 min-w-0">
                              <Users className="w-3 h-3 shrink-0" />
                              <span className="truncate">{game.authorName}</span>
                            </div>
                            {stats && <span className="shrink-0">{stats}</span>}
                          </div>
                          <PixelButton
                            tone="green"
                            onClick={() => setLocation(`/arc3/play/${game.gameId}`)}
                            className="w-full mt-1"
                          >
                            <Play className="w-4 h-4" />
                            Play
                          </PixelButton>
                        </div>
                      </GameCard>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Palette legend - decorative strip with color indices */}
        <div className="mt-8 border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel)]">
          <div className="px-3 py-1.5 border-b border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
            <span className="text-[10px] font-semibold text-[var(--arc3-dim)] uppercase tracking-wider">
              ARC3 Palette -- 16 colors used in all games
            </span>
          </div>
          <div className="p-3">
            <div className="flex gap-1">
              {Array.from({ length: 16 }, (_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full aspect-square border border-[var(--arc3-border)]"
                    style={{ backgroundColor: ARC3_COLORS[i] }}
                  />
                  <span className="text-[8px] text-[var(--arc3-dim)] font-mono">{i}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom palette strip */}
      <PaletteStrip cellHeight={4} className="mt-2" />

      {/* Footer links - secondary actions */}
      <footer className="border-t-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-[var(--arc3-dim)]">
            <span>Powered by</span>
            <a
              href={ARCENGINE_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[var(--arc3-muted)] hover:text-[var(--arc3-text)] transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              ARCEngine
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
            <span className="text-[var(--arc3-border)]">|</span>
            <a
              href="https://github.com/arcprize/ARCEngine#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[var(--arc3-muted)] hover:text-[var(--arc3-text)] transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Creator Docs
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <PixelButton tone="blue" onClick={() => setLocation('/arc3/gallery')}>
              <Play className="w-3.5 h-3.5" />
              All Games
            </PixelButton>
            <PixelButton tone="purple" onClick={() => setLocation('/arc3/archive')}>
              Archive
            </PixelButton>
          </div>
        </div>
      </footer>
    </Arc3PixelPage>
  );
}
