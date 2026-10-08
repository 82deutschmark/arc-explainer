/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Common page shell with visible breadcrumbs matching shared structured data.
 * SRP/DRY check: Pass — breadcrumb labels and paths come from shared SEO policy.
 */
import { Link, useLocation } from 'wouter';
import { clientRouteMeta, pageBreadcrumbs } from '@shared/seo';
import React from 'react';
import { AppHeader } from './AppHeader';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, className }: PageLayoutProps) {
  const [location] = useLocation();
  const tags = clientRouteMeta(location);
  const crumbs = tags.noindex ? [] : pageBreadcrumbs(tags);
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AppHeader />
      {crumbs.length > 0 && <nav aria-label="Breadcrumb" className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pt-4 text-xs text-muted-foreground">
        {crumbs.map((crumb, index) => <React.Fragment key={crumb.url}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {index === crumbs.length - 1 ? <span aria-current="page">{crumb.name}</span> : <Link href={new URL(crumb.url).pathname} className="underline underline-offset-4">{crumb.name}</Link>}
        </React.Fragment>)}
      </nav>}
      <main className={className}>
        {children}
      </main>
    </div>
  );
}