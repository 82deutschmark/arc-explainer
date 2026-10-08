/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Reset shared metadata on every SPA navigation, including pages without a
 *          page hook. Preserve authoritative server metadata on the initial visit.
 * SRP/DRY check: Pass — rendering and page refinements reuse usePageMeta's writer.
 */
import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import type { RouteMetaTags } from '@shared/routes';
import { clientRouteMeta, normalizePath } from '@shared/seo';
import { applyPageMetadata } from '@/hooks/usePageMeta';
export default function RouteMetadata() {
  const [location] = useLocation();
  const initial = useRef(true);
  useLayoutEffect(() => {
    let tags = clientRouteMeta(location);
    if (initial.current) {
      const bootstrap = document.getElementById('page-meta');
      if (bootstrap?.textContent) {
        try {
          const serverTags: RouteMetaTags = JSON.parse(bootstrap.textContent);
          if (normalizePath(new URL(serverTags.url).pathname) === normalizePath(location)) tags = serverTags;
        } catch { /* Local Vite or an older cached shell can have no bootstrap. */ }
      }
      initial.current = false;
    }
    applyPageMetadata(tags);
  }, [location]);
  return null;
}
