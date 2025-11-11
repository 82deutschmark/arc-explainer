/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-11
 * PURPOSE: Compact app header with ARC-inspired colorful branding and colorful emoji dividers.
 * Zero margins for edge-to-edge layout. Includes full AppNavigation component.
 * SRP/DRY check: Pass - Single responsibility (header layout), reuses AppNavigation component
 */
import React from 'react';
import { Link } from 'wouter';
import { AppNavigation } from './AppNavigation';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 items-center justify-between gap-2 px-2">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer group">
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
              <div className="font-bold text-base leading-tight">ARC Explainer</div>
              <div className="text-[9px] text-muted-foreground leading-none">ARC 1 🟥 ARC 2 🟨 ARC 3 🟦</div>
            </div>
          </div>
        </Link>

        <div className="flex flex-1 items-center justify-end overflow-hidden">
          <AppNavigation />
        </div>
      </div>
    </header>
  );
}
