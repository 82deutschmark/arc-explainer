/*
Author: Cascade (Claude Sonnet 4)
Date: 2026-01-31
PURPOSE: Gallery page for browsing community games. Uses ARC3 pixel UI theme for
         visual consistency with the rest of ARC3 Studio. Supports search and sorting.
SRP/DRY check: Pass — single-purpose game gallery; uses shared pixel UI primitives.
*/

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ArrowLeft,
  Play,
  Upload,
  Zap,
  Users,
  Gamepad2,
} from 'lucide-react';
import { Arc3PixelPage, PixelButton, PixelPanel, SpriteMosaic } from '@/components/arc3-community/Arc3PixelUI';

interface CommunityGame {
  id: number;
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
  playCount: number;
  tags: string[];
  uploadedAt: string;
}

interface GamesResponse {
  success: boolean;
  data: {
    games: CommunityGame[];
    total: number;
    limit: number;
    offset: number;
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export default function CommunityGallery() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState<string>('playCount');

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  queryParams.set('orderBy', orderBy);
  queryParams.set('orderDir', 'DESC');
  queryParams.set('limit', '50');

  const { data, isLoading } = useQuery<GamesResponse>({
    queryKey: [`/api/arc3-community/games?${queryParams.toString()}`],
  });

  const games = data?.data?.games || [];
  const total = data?.data?.total || 0;

  return (
    <Arc3PixelPage>
      {/* Header */}
      <header className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/arc3">
              <PixelButton tone="neutral">
                <ArrowLeft className="w-4 h-4" />
                Back
              </PixelButton>
            </Link>
            <span className="text-[var(--arc3-dim)]">|</span>
            <Gamepad2 className="w-5 h-5 text-[var(--arc3-c14)]" />
            <div>
              <span className="text-sm font-semibold">Game Gallery</span>
              <span className="text-[11px] text-[var(--arc3-dim)] ml-2">{total} games</span>
            </div>
          </div>

          <PixelButton tone="green" onClick={() => setLocation('/arc3/upload')}>
            <Upload className="w-4 h-4" />
            Submit Game
          </PixelButton>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Search and filters */}
        <PixelPanel tone="blue" className="mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--arc3-dim)]" />
              <input
                type="text"
                placeholder="Search games..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--arc3-dim)]">Sort:</span>
              <select
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                className="px-2 py-1.5 text-xs font-mono border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] focus:outline-none focus:border-[var(--arc3-focus)]"
              >
                <option value="playCount">Most Played</option>
                <option value="uploadedAt">Newest</option>
                <option value="displayName">Name</option>
              </select>
            </div>
          </div>
        </PixelPanel>

        {/* Games grid */}
        {isLoading ? (
          <PixelPanel tone="neutral">
            <div className="text-center py-8">
              <div className="text-sm text-[var(--arc3-dim)]">Loading games...</div>
            </div>
          </PixelPanel>
        ) : games.length === 0 ? (
          <PixelPanel tone="yellow" title="No Games Found">
            <div className="text-center py-6">
              <p className="text-[11px] text-[var(--arc3-muted)] mb-4">
                {search ? 'No games match your search' : 'No community games available yet'}
              </p>
              <PixelButton tone="green" onClick={() => setLocation('/arc3/upload')}>
                <Upload className="w-4 h-4" />
                Be the First to Submit!
              </PixelButton>
            </div>
          </PixelPanel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <div
                key={game.gameId}
                className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel)] shadow-[4px_4px_0_var(--arc3-c3)] hover:shadow-[6px_6px_0_var(--arc3-c3)] transition-shadow"
              >
                {/* Game card header */}
                <div className="px-3 py-2 border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-c9)] flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--arc3-c0)] truncate">
                      {game.displayName}
                    </span>
                    {game.tags?.includes('featured') && (
                      <span title="Featured"><Zap className="w-3.5 h-3.5 text-[var(--arc3-c11)] shrink-0" /></span>
                    )}
                  </div>
                </div>

                {/* Game card body */}
                <div className="p-3 space-y-3">
                  <p className="text-[11px] text-[var(--arc3-muted)] leading-relaxed min-h-[2.5rem]">
                    {game.description ? truncate(game.description, 120) : 'No description provided'}
                  </p>

                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-[var(--arc3-dim)]">
                      <Users className="w-3 h-3" />
                      <span>{game.authorName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[var(--arc3-dim)]">
                      <Play className="w-3 h-3" />
                      <span>{game.playCount} plays</span>
                    </div>
                  </div>

                  <PixelButton
                    tone="green"
                    onClick={() => setLocation(`/arc3/play/${game.gameId}`)}
                    className="w-full"
                  >
                    <Play className="w-4 h-4" />
                    Play Game
                  </PixelButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer stats */}
        {games.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-[11px] text-[var(--arc3-dim)]">
              Showing {games.length} of {total} community games
            </p>
          </div>
        )}
      </main>
    </Arc3PixelPage>
  );
}
