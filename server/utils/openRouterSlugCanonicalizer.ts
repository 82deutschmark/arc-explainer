/**
 * Author: GPT-5
 * Date: 2026-01-10
 * PURPOSE: Canonicalize OpenRouter model slugs so variants (like :free) collapse to a single
 *          model when a canonical slug exists in the curated library list.
 * SRP/DRY check: Pass - single utility for slug normalization shared across DB write paths.
 */

import { MODELS } from '../config/models.ts';

const COLLAPSE_SUFFIXES = new Set(['free', 'exacto']);

function stripCollapsibleSuffix(slug: string): string {
  if (!slug) return '';
  const trimmed = slug.trim();
  const match = trimmed.match(/:(?<suffix>[^/]+)$/);
  if (!match?.groups?.suffix) return trimmed;
  const suffix = match.groups.suffix.toLowerCase();
  if (!COLLAPSE_SUFFIXES.has(suffix)) return trimmed;
  return trimmed.slice(0, trimmed.length - (suffix.length + 1));
}

function buildOpenRouterCanonicalMap(): Map<string, string> {
  const map = new Map<string, { nonFree?: string; free?: string }>();

  for (const model of MODELS) {
    if (model.provider !== 'OpenRouter') continue;
    const raw = (model.apiModelName || model.key || '').trim();
    if (!raw) continue;

    const base = stripCollapsibleSuffix(raw);
    const bucket = map.get(base) ?? {};
    if (raw.endsWith(':free')) {
      if (!bucket.free) bucket.free = raw;
    } else {
      if (!bucket.nonFree) bucket.nonFree = raw;
    }
    map.set(base, bucket);
  }

  const canonical = new Map<string, string>();
  for (const [base, bucket] of map.entries()) {
    canonical.set(base, bucket.nonFree ?? bucket.free ?? base);
  }
  return canonical;
}

const OPENROUTER_CANONICAL_MAP = buildOpenRouterCanonicalMap();

export function canonicalizeOpenRouterSlug(slug: string): string {
  if (!slug) return '';
  const trimmed = slug.trim();
  if (!trimmed) return '';
  const base = stripCollapsibleSuffix(trimmed);
  return OPENROUTER_CANONICAL_MAP.get(base) ?? trimmed;
}

export function canonicalizeOpenRouterSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  for (const slug of slugs) {
    const canonical = canonicalizeOpenRouterSlug(slug);
    if (canonical) seen.add(canonical);
  }
  return Array.from(seen);
}
