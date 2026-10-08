/**
 * Author: Codex
 * Date: 2026-10-08
 * PURPOSE: Retire the obsolete model/trustworthiness rankings. Existing bookmarks see
 *          a notice and current destinations; no historical ranking queries are made.
 *          Production HTML uses the same route metadata and returns HTTP 410.
 * SRP/DRY check: Pass — reuses shared route metadata, page metadata and router links.
 */
import { Link } from 'wouter';
import { ROUTE_META_TAGS } from '@shared/routes';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Leaderboards() {
  usePageMeta({ noindex: true });
  const meta = ROUTE_META_TAGS['/leaderboards'];
  return (
    <section className="mx-auto max-w-3xl space-y-5 px-4 py-16">
      <p className="text-sm text-muted-foreground">This page is no longer available</p>
      <h1 className="text-3xl font-semibold">Model rankings retired</h1>
      <p>{meta.description}</p>
      <nav aria-label="Available resources" className="flex flex-wrap gap-5">
        <Link className="underline underline-offset-4" href="/kaggle-leaderboard">Current Kaggle standings</Link>
        <Link className="underline underline-offset-4" href="/analytics">Recorded puzzle results archive</Link>
        <Link className="underline underline-offset-4" href="/home">Resource Hub</Link>
      </nav>
    </section>
  );
}
