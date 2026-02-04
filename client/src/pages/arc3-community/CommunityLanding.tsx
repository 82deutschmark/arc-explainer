/*
Author: GPT-5.2
Date: 2026-02-02
PURPOSE: ARC3 Studio landing page for the ARC Prize / ARC-AGI-3 community track. Presents this
         section as a full-service platform (browse/play/upload) and uses the official ARC3 color
         palette exclusively (client/src/utils/arc3Colors.ts) with a pixel/sprite-inspired UI.
         Also fixes incorrect ARCEngine repository links and removes hard-coded editorial metadata
         (difficulty/levels) from the landing UI.
SRP/DRY check: Pass - page-only layout; shared pixel UI primitives live in Arc3PixelUI.tsx.
*/

import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Github, Play, Upload, BookOpen, Archive, Sparkles } from 'lucide-react';
import { Arc3PixelPage, PixelButton, PixelPanel, SpriteMosaic } from '@/components/arc3-community/Arc3PixelUI';

interface CommunityGame {
  id: number;
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
}

interface GamesResponse {
  success: boolean;
  data: CommunityGame[];
}

const ARCENGINE_REPO_URL = 'https://github.com/arcprize/ARCEngine';

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export default function CommunityLanding() {
  const [, setLocation] = useLocation();
  const { data: featuredGames, isLoading } = useQuery<GamesResponse>({
    queryKey: ['/api/arc3-community/games/featured'],
  });

  const games = featuredGames?.data ?? [];

  const summaryLines = useMemo(
    () => [
      'Build and share ARC-AGI-3 style reasoning games as 2D sprites.',
      'Upload Python source, get validation, then publish after review.',
      'Play community games in a 64x64 pixel grid runtime.',
    ],
    [],
  );

  return (
    <Arc3PixelPage>
      {/* Top "HUD" bar */}
      <header className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SpriteMosaic seed={3} width={10} height={3} className="w-20 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--arc3-c11)]" />
                <span className="text-sm font-semibold tracking-tight">ARC3 Studio</span>
                <span className="text-[11px] text-[var(--arc3-dim)]">ARC Prize / ARC-AGI-3</span>
              </div>
              <p className="text-[11px] text-[var(--arc3-dim)] leading-snug">
                Community-built games powered by ARCEngine (Python 2D sprite engine).
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 shrink-0">
            <a
              href={ARCENGINE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-[var(--arc3-border)] bg-[var(--arc3-c3)] text-[var(--arc3-c0)]"
              title="Open ARCEngine repository"
            >
              <Github className="w-4 h-4" />
              ARCEngine
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
            <a
              href="https://github.com/arcprize/ARCEngine#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-[var(--arc3-border)] bg-[var(--arc3-c9)] text-[var(--arc3-c0)]"
            >
              <BookOpen className="w-4 h-4" />
              Creator Docs
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
            <PixelButton tone="green" onClick={() => setLocation('/arc3/upload')}>
              <Upload className="w-4 h-4" />
              Submit Game
            </PixelButton>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <PixelPanel
              tone="purple"
              title="Full-service community platform"
              subtitle="Build, upload, validate, play - all inside ARC3."
              rightSlot={
                <div className="text-[11px] text-[var(--arc3-c0)] opacity-90">
                  Routes: <span className="font-semibold">/arc3</span>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3">
                  <p className="text-xs font-semibold mb-1">Browse</p>
                  <p className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                    Find community games and jump straight into play.
                  </p>
                </div>
                <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3">
                  <p className="text-xs font-semibold mb-1">Upload</p>
                  <p className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                    Paste Python source for an ARCEngine game; we validate it before review.
                  </p>
                </div>
                <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3">
                  <p className="text-xs font-semibold mb-1">Play</p>
                  <p className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                    The runtime renders a 64x64 grid with crisp pixel edges.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <PixelButton tone="green" onClick={() => setLocation('/arc3/gallery')}>
                  <Play className="w-4 h-4" />
                  Browse Games
                </PixelButton>
                <PixelButton tone="pink" onClick={() => setLocation('/arc3/upload')}>
                  <Upload className="w-4 h-4" />
                  Upload Your Game
                </PixelButton>
                <a
                  href="https://github.com/arcprize/ARCEngine#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-[var(--arc3-border)] bg-[var(--arc3-c9)] text-[var(--arc3-c0)]"
                >
                  <BookOpen className="w-4 h-4" />
                  Read Creator Docs
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>
            </PixelPanel>

            <PixelPanel
              tone="yellow"
              title="Submitting your ARCEngine game (Python)"
              subtitle="Clear expectations, no marketing fluff."
            >
              <div className="space-y-3">
                <div className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                  {summaryLines.map((line) => (
                    <div key={line} className="flex gap-2">
                      <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3">
                    <p className="text-xs font-semibold mb-1">What to upload</p>
                    <p className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                      A Python class that subclasses <span className="font-semibold">ARCBaseGame</span> and implements{' '}
                      <span className="font-semibold">step()</span>.
                    </p>
                  </div>
                  <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3">
                    <p className="text-xs font-semibold mb-1">What happens next</p>
                    <p className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                      Uploads are validated, then reviewed before they become publicly visible.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <PixelButton tone="green" onClick={() => setLocation('/arc3/upload')}>
                    <Upload className="w-4 h-4" />
                    Go to Upload
                  </PixelButton>
                  <a
                    href={ARCENGINE_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-[var(--arc3-border)] bg-[var(--arc3-c3)] text-[var(--arc3-c0)]"
                    title="Open ARCEngine repository"
                  >
                    <Github className="w-4 h-4" />
                    ARCEngine on GitHub
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>
              </div>
            </PixelPanel>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <PixelPanel tone="blue" title="Sprite sheet (ARC3 palette)">
              <div className="grid grid-cols-2 gap-3">
                <SpriteMosaic seed={31} width={14} height={10} className="w-full" />
                <SpriteMosaic seed={73} width={14} height={10} className="w-full" />
              </div>
              <p className="mt-3 text-[11px] text-[var(--arc3-dim)] leading-snug">
                This section intentionally uses only the official ARC3 palette to keep pixels crisp and readable.
              </p>
            </PixelPanel>

            <PixelPanel tone="green" title="Featured games" subtitle="Minimal metadata: name, author, play.">
              <div className="space-y-2">
                {isLoading && (
                  <div className="text-[11px] text-[var(--arc3-dim)]">Loading featured games...</div>
                )}

                {!isLoading && games.length === 0 && (
                  <div className="text-[11px] text-[var(--arc3-dim)]">No featured games available.</div>
                )}

                {games.map((game) => (
                  <div
                    key={game.gameId}
                    className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate">{game.displayName}</span>
                        <span className="text-[11px] text-[var(--arc3-dim)]">by {game.authorName}</span>
                      </div>
                      {game.description && (
                        <p className="mt-1 text-[11px] text-[var(--arc3-muted)] leading-snug">
                          {truncate(game.description, 140)}
                        </p>
                      )}
                    </div>
                    <PixelButton tone="green" onClick={() => setLocation(`/arc3/play/${game.gameId}`)}>
                      <Play className="w-4 h-4" />
                      Play
                    </PixelButton>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <PixelButton tone="blue" onClick={() => setLocation('/arc3/gallery')}>
                  <Play className="w-4 h-4" />
                  Browse All Games
                </PixelButton>
                <PixelButton tone="purple" onClick={() => setLocation('/arc3/archive')}>
                  <Archive className="w-4 h-4" />
                  Legacy Preview Archive
                </PixelButton>
              </div>
            </PixelPanel>
          </div>
        </div>
      </main>
    </Arc3PixelPage>
  );
}
