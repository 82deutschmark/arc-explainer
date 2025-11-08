import React from 'react';
import { Link } from 'wouter';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppNavigation } from './AppNavigation';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center gap-3">
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer">
              <div className="font-bold text-lg">ARC Explainer</div>
            </div>
          </Link>

          <div className="flex flex-1 items-center gap-3">
            <AppNavigation />
          </div>

          <div className="hidden sm:flex">
            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
              <a
                href="https://github.com/82deutschmark/arc-explainer"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5"
              >
                <Github className="h-4 w-4" />
                <span className="text-xs">Open Source</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}