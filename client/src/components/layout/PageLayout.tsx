import React from 'react';
import { AppHeader } from './AppHeader';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AppHeader />
      <main className={className}>
        {children}
      </main>
    </div>
  );
}