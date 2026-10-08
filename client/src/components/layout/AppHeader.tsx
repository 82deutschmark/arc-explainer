/**
 * Author: Codex / Claude Code using Sonnet 4.5 / Claude Haiku 4.5 / Claude Opus 5
 * Date: 2026-10-07
 * PURPOSE: Compact app header with ARC-inspired colorful branding. Zero margins for
 * edge-to-edge layout. Includes the OpenRouter sync banner and the full AppNavigation.
 * On phones the navigation gets its own row so the Leaderboard label stays readable.
 * 2026-08-29: the subtitle leads with ARC-3 and marks 1 & 2 as archive. The old resource
 * hub is still at /home, linked from the "ARC 1 & 2" nav dropdown.
 * 2026-09-03: the brand mark resolves to the landing page on every host -- not because
 * the mark is clever, but because `/` is the landing page on every host now.
 * 2026-09-02: the brand mark points at / and not at /arc3/gallery. Two reasons, and both
 * were live complaints. It was the SECOND control going to the gallery -- the nav's
 * "Browse" is the first -- so the one place every site puts "take me home" was a
 * duplicate. And on arc3.markbarney.net / is not a redirect: it renders the synthetic
 * programme's landing page, which had NO link to it from anywhere in the chrome. The
 * front door existed and nothing on the site opened it.
 * SRP/DRY check: Pass - Single responsibility (header layout), reuses AppNavigation component
 * See docs/2026-08-29-arc3-forward-nav-plan.md.
 */
import React from 'react';
import { Link } from 'wouter';
import { AppNavigation } from './AppNavigation';
import { OpenRouterSyncBanner } from './OpenRouterSyncBanner';

export function AppHeader() {
  return (
    <>
      <OpenRouterSyncBanner />
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 sm:h-12 sm:flex-nowrap sm:py-0">
        {/* The mark goes to the landing page, which is what `/` now renders on every host
            (see the root Route in App.tsx). It briefly needed a host-aware helper, because
            `/` meant the landing on one host and a redirect to /arc3/gallery on the other
            -- which also made this mark a second link to the gallery next to the nav's
            "Browse". Root is one page now, so `/` is enough again. */}
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group min-w-fit">
            {/* ARC-inspired colorful logo */}
            <div className="flex flex-col gap-0.5 group-hover:scale-110 transition-transform">
              <div className="flex gap-0.5 text-[10px] leading-none">
                <span>🟥</span>
                <span>🟧</span>
                <span>🟨</span>
              </div>
              <div className="flex gap-0.5 text-[10px] leading-none">
                <span>🟩</span>
                <span>🟦</span>
                <span>🟪</span>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="font-bold text-base leading-tight whitespace-nowrap">ARC Explainer</div>
              {/* Three labels, one square each, in order. It used to read
                  "🟦 ARC 3 · archive: ARC 1 🟥 ARC 2 🟨" -- squares on the wrong side of two
                  of the three, an "archive:" nobody needs in a nine-pixel subtitle, and the
                  numbers out of order. It is a wordmark, not a sentence. */}
              <div className="text-[9px] text-muted-foreground leading-none whitespace-nowrap flex items-center gap-1">
                <span>🟥 ARC 1</span>
                <span className="opacity-40">·</span>
                <span>🟨 ARC 2</span>
                <span className="opacity-40">·</span>
                <span>🟦 ARC 3</span>
              </div>
            </div>
          </div>
        </Link>

        {/* min-w-0, not overflow-x-auto: AppNavigation owns the scroll container now, so the
            right rail stays pinned instead of being pushed out of view. */}
        <div className="flex w-full min-w-0 items-center justify-end sm:w-auto sm:flex-1">
          <AppNavigation />
        </div>
      </div>
    </header>
    </>
  );
}
