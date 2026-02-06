/*
Author: Cascade (Claude Sonnet 4)
Date: 2026-02-05
PURPOSE: ARC3 landing page - game-focused redesign. The hero area is a compact title strip
         with the 16-color ARC3 palette as visual identity. The main content is a grid of
         playable official ARCEngine games with prominent Play buttons. Secondary actions
         (upload, docs, GitHub) are demoted to a footer bar. No instructional text in the UI.
         All 16 ARC3 palette colors are used as creative design elements (card accents,
         palette strips, decorative borders) rather than just panel backgrounds.
SRP/DRY check: Pass - page-only layout; shared pixel UI primitives live in Arc3PixelUI.tsx.
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

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
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
    <Arc3PixelPage>
      {/* 16-color palette strip as top visual identity */}
      <PaletteStrip cellHeight={8} />

      {/* Compact hero - no redundant sub-header, just a title + CTA */}
      <div className="bg-[var(--arc3-bg-soft)] border-b-2 border-[var(--arc3-border)]">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Tiny 4x4 pixel grid decoration using palette colors */}
            <div className="shrink-0 grid grid-cols-4 gap-px w-10 h-10" aria-hidden="true">
              {[9, 14, 11, 6, 8, 15, 12, 10, 7, 13, 9, 14, 11, 6, 8, 15].map((c, i) => (
                <div key={i} style={{ backgroundColor: ARC3_COLORS[c] }} />
              ))}
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight leading-tight">
                ARC-AGI-3
                <span className="text-[var(--arc3-dim)] font-normal text-xs ml-2">Interactive Reasoning Benchmarks</span>
              </h1>
              <p className="text-[11px] text-[var(--arc3-muted)] leading-snug mt-0.5">
                Play 2D Python games built on the ARCEngine sprite runtime. 64x64 pixel grids, 16-color palette.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PixelButton tone="green" onClick={() => setLocation('/arc3/upload')}>
              <Upload className="w-4 h-4" />
              Submit Game
            </PixelButton>
          </div>
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
                  {arcPrizeGames.map((game, idx) => (
                    <GameCard
                      key={game.gameId}
                      accentIndex={ACCENT_CYCLE[idx % ACCENT_CYCLE.length]}
                      onClick={() => setLocation(`/arc3/play/${game.gameId}`)}
                    >
                      <div className="p-3 space-y-2">
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
                        {game.description && (
                          <p className="text-[11px] text-[var(--arc3-muted)] leading-snug min-h-[2rem]">
                            {truncate(game.description, 120)}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-[var(--arc3-dim)]">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{game.authorName}</span>
                          </div>
                          {game.levelCount != null && game.levelCount > 0 && (
                            <span>{game.levelCount} levels</span>
                          )}
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
                  ))}
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
                  {teamGames.map((game, idx) => (
                    <GameCard
                      key={game.gameId}
                      accentIndex={ACCENT_CYCLE[(arcPrizeGames.length + idx) % ACCENT_CYCLE.length]}
                      onClick={() => setLocation(`/arc3/play/${game.gameId}`)}
                    >
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate">{game.displayName}</span>
                        </div>
                        {game.description && (
                          <p className="text-[11px] text-[var(--arc3-muted)] leading-snug min-h-[2rem]">
                            {truncate(game.description, 120)}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-[var(--arc3-dim)]">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{game.authorName}</span>
                          </div>
                          {game.levelCount != null && game.levelCount > 0 && (
                            <span>{game.levelCount} levels</span>
                          )}
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
                  ))}
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
