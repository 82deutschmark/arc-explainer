/**
 * Author: Claude Code using Sonnet 4.5 / Claude Haiku 4.5 / Claude Opus 5
 * Date: 2025-11-11 / 2025-12-24 / 2026-08-29
 * PURPOSE: Compact app header with ARC-inspired colorful branding. Zero margins for
 * edge-to-edge layout. Includes the OpenRouter sync banner and the full AppNavigation.
 * 2026-08-29: the subtitle leads with ARC-3 and marks 1 & 2 as archive. The old resource
 * hub is still at /home, linked from the "ARC 1 & 2" nav dropdown.
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
      <div className="flex h-12 items-center justify-between gap-4 px-4">
        {/* Home is `/`, whatever `/` means on this host -- the synthetic landing on
            arc3.markbarney.net, the gallery everywhere else (see RootLanding in App.tsx).
            Pointing the mark at the gallery directly duplicated "Browse" and left the
            landing page unreachable. */}
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
              <div className="text-[9px] text-muted-foreground leading-none whitespace-nowrap">🟦 ARC 3 &middot; archive: ARC 1 🟥 ARC 2 🟨</div>
            </div>
          </div>
        </Link>

        {/* min-w-0, not overflow-x-auto: AppNavigation owns the scroll container now, so the
            right rail stays pinned instead of being pushed out of view. */}
        <div className="flex flex-1 min-w-0 items-center justify-end">
          <AppNavigation />
        </div>
      </div>
    </header>
    </>
  );
}
