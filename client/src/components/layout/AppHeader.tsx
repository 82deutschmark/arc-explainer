/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-11
 * PURPOSE: Enhanced app header with ARC-inspired colorful branding using emoji squares.
 * Creates visual interest and brand identity while maintaining clean layout.
 * Integrates with AppNavigation for main navigation structure.
 * SRP/DRY check: Pass - Single responsibility (header layout), reuses AppNavigation component
 */
import React from 'react';
import { Link } from 'wouter';
import { AppNavigation } from './AppNavigation';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
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
                <div className="font-bold text-lg leading-tight">ARC Explainer</div>
                <div className="text-[10px] text-muted-foreground leading-none">Abstraction & Reasoning</div>
              </div>
            </div>
          </Link>
          <div className="flex flex-1 items-center justify-end overflow-hidden">
            <AppNavigation />
          </div>
        </div>
      </div>
    </header>
  );
}
