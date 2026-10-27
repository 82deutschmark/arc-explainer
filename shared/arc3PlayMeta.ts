/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Identical page and share metadata for approved game pages in HTML and client navigation.
 * SRP/DRY check: Pass — the catalog decides approval; this only describes the public play page.
 */
import type { RouteMetaTags } from './routes';
import { SITE_ORIGIN } from './seo';
export function approvedPlayMeta(id: string, label: string): RouteMetaTags {
  return {
    title: `Play ${label} — ARC-AGI-3 reasoning game | ARC Explainer`,
    description: `Play ${label}, a human-reviewed original ARC-AGI-3 reasoning game. Discover its rules through play in your browser. No login required.`,
    url: `${SITE_ORIGIN}/arc3/play/${id}`, noindex: false, type: 'website',
    image: `${SITE_ORIGIN}/api/arc3-mirror/games/${id}/thumbnail?size=512`,
    imageAlt: `${label} opening game board`,
  };
}
