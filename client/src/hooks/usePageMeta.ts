/**
 * Author: Cascade
 * Date: 2025-11-18
 * PURPOSE: Shared hook for setting per-page SEO/AEO metadata:
 *          document title, meta description, and canonical URL based on route.
 *          Helps search engines and LLM crawlers understand each page.
 * SRP/DRY check: Pass — single responsibility for head/meta management, reused across pages.
 */

import { useEffect } from 'react';

const CANONICAL_ORIGIN = "https://arc.markbarney.net";

interface PageMetaOptions {
  title?: string;
  description?: string;
  canonicalPath?: string; // e.g. "/analytics"; if omitted, leaves canonical as-is
}

export function usePageMeta({ title, description, canonicalPath }: PageMetaOptions): void {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    if (description) {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (meta) {
        meta.setAttribute('content', description);
      }
    }

    if (canonicalPath) {
      const href = `${CANONICAL_ORIGIN}${canonicalPath}`;
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }

      link.setAttribute('href', href);
    }
  }, [title, description, canonicalPath]);
}
