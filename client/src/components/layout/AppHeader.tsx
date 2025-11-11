/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-11
 * PURPOSE: Compact app header with ARC-inspired colorful branding, yellow square dividers,
 * and prominent ARC3 playground icon. Zero margins for edge-to-edge layout.
 * Integrates with AppNavigation for main navigation structure.
 * SRP/DRY check: Pass - Single responsibility (header layout), reuses AppNavigation component
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Github, FlaskConical } from 'lucide-react';

export function AppHeader() {
  const [location] = useLocation();

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

        <div className="flex gap-0.5 text-xs">
          <span>🟨</span>
          <span>🟩</span>
        </div>

        {/* ARC3 Playground Icon - prominently featured */}
        <Link href="/arc3/playground">
          <Button
            variant={location === '/arc3/playground' ? 'default' : 'ghost'}
            size="sm"
            className="flex items-center gap-1.5 h-8 px-2"
          >
            <FlaskConical className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">ARC3 Playground</span>
          </Button>
        </Link>

        <div className="flex gap-0.5 text-xs">
          <span>🟦</span>
          <span>🟪</span>
        </div>

        <a
          href="https://github.com/82deutschmark/arc-explainer"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="sm" className="flex items-center gap-1.5 h-8 px-2">
            <Github className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">GitHub</span>
          </Button>
        </a>

        <div className="flex gap-0.5 text-xs">
          <span>🟥</span>
          <span>🟧</span>
        </div>
      </div>
    </header>
  );
}
