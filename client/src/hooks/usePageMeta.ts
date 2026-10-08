/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Apply the shared page metadata contract to the browser, including social
 *          tags and structured data. Page hooks can refine dynamic routes without
 *          leaking a previous page's canonical, image or indexing directives.
 * SRP/DRY check: Pass — shared/seo owns URL policy and schema generation.
 */
import { useEffect } from 'react';
import type { RouteMetaTags } from '@shared/routes';
import { ROUTE_META_TAGS } from '@shared/routes';
import { clientRouteMeta, completeMeta, INDEX_ROBOTS, normalizePath, SITE_ORIGIN, structuredData } from '@shared/seo';
let currentMeta: RouteMetaTags | undefined;

export function applyPageMetadata(input: RouteMetaTags): void {
  const tags = completeMeta(input);
  currentMeta = tags;
  document.title = tags.title;
  const setMeta = (name: string, value: string, property = false) => {
    const attribute = property ? 'property' : 'name';
    const matches = [...document.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${name}"]`)];
    const tag = matches.shift() || document.createElement('meta');
    matches.forEach(duplicate => duplicate.remove());
    tag.setAttribute(attribute, name);
    tag.content = value;
    if (!tag.parentNode) document.head.appendChild(tag);
  };
  setMeta('description', tags.description);
  setMeta('robots', tags.noindex ? 'noindex,follow' : INDEX_ROBOTS);
  for (const [key, value] of Object.entries({ 'og:site_name': 'ARC Explainer', 'og:locale': 'en_US', 'og:type': tags.type || 'website', 'og:url': tags.url, 'og:title': tags.title, 'og:description': tags.description, 'og:image': tags.image!, 'og:image:alt': tags.imageAlt! })) setMeta(key, value, true);
  for (const [key, value] of Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:url': tags.url, 'twitter:title': tags.title, 'twitter:description': tags.description, 'twitter:image': tags.image!, 'twitter:image:alt': tags.imageAlt! })) setMeta(key, value);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = tags.url;
  let schema = document.getElementById('page-structured-data');
  if (!schema) { schema = document.createElement('script'); schema.id = 'page-structured-data'; schema.setAttribute('type', 'application/ld+json'); document.head.appendChild(schema); }
  schema.textContent = JSON.stringify(structuredData(tags));
}
interface PageMetaOptions {
  title?: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
  type?: string;
}
export function usePageMeta({ title, description, canonicalPath, noindex, jsonLd, type }: PageMetaOptions): void {
  useEffect(() => {
    const route = normalizePath(window.location.pathname);
    const base = currentMeta?.url === `${SITE_ORIGIN}${route}` ? currentMeta : clientRouteMeta(route);
    // Registered static pages use the same prose on the server and in the browser.
    const isRegistered = Object.hasOwn(ROUTE_META_TAGS, route);
    applyPageMetadata({ ...base,
      ...(!isRegistered && title ? { title } : {}),
      ...(!isRegistered && description ? { description } : {}),
      ...(!isRegistered && canonicalPath ? { url: `${SITE_ORIGIN}${normalizePath(canonicalPath)}` } : {}),
      ...(noindex !== undefined ? { noindex } : {}),
      ...(jsonLd ? { jsonLd } : {}),
      ...(type ? { type } : {}),
    });
  }, [title, description, canonicalPath, noindex, jsonLd, type]);
}

/** Bridge older title-only page effects into the shared metadata writer. */
export function setPageTitle(title: string): void {
  const route = normalizePath(window.location.pathname);
  if (Object.hasOwn(ROUTE_META_TAGS, route)) {
    applyPageMetadata(clientRouteMeta(route));
  } else {
    const base = currentMeta?.url === `${SITE_ORIGIN}${route}` ? currentMeta : clientRouteMeta(route);
    applyPageMetadata({ ...base, title });
  }
}
