/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Apply the shared page metadata contract to the browser, including social
 *          tags and structured data. Page hooks can refine dynamic routes without
 *          leaking a previous page's canonical, image or indexing directives.
 *          08-Oct-2026 (Claude Opus 5.5): pages can set their share image and article
 *          fields; social tags are written from shared socialMetaEntries().
 * SRP/DRY check: Pass — shared/seo owns URL policy and schema generation.
 */
import { useEffect } from 'react';
import type { RouteMetaTags } from '@shared/routes';
import { ROUTE_META_TAGS } from '@shared/routes';
import { clientRouteMeta, completeMeta, INDEX_ROBOTS, normalizePath, SITE_ORIGIN, SOCIAL_META_NAMES, socialMetaEntries, structuredData } from '@shared/seo';
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
  // Optional tags (image size, article fields) are removed first so none outlive their page.
  for (const name of SOCIAL_META_NAMES) document.head.querySelectorAll(`meta[property="${name}"]`).forEach(tag => tag.remove());
  for (const [attribute, name, value] of socialMetaEntries(tags)) setMeta(name, value, attribute === 'property');
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
  /** Absolute share image with its alt text and size; omit to keep the route's image. */
  image?: Pick<RouteMetaTags, 'image' | 'imageAlt' | 'imageWidth' | 'imageHeight'>;
  /** Open Graph article fields for `type: 'article'` pages. */
  article?: Pick<RouteMetaTags, 'publishedTime' | 'section'>;
}
export function usePageMeta({ title, description, canonicalPath, noindex, jsonLd, type, image, article }: PageMetaOptions): void {
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
      ...(image?.image ? image : {}),
      ...(article ?? {}),
    });
    // Option objects are compared by their contents, so callers can pass literals.
  }, [title, description, canonicalPath, noindex, jsonLd, type, image?.image, image?.imageAlt, article?.publishedTime, article?.section]);
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
