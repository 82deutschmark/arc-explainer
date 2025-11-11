import React from 'react';
import { Link } from 'wouter';
import { AppNavigation } from './AppNavigation';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="font-bold text-lg">ARC Explainer</div>
            </div>
          </Link>
          <div className="flex flex-1 items-center justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <AppNavigation />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
