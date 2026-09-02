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
  /** Ask crawlers not to index this page. Added for the ARC-AGI-3 mechanic guide, which
   *  is a full answer key to tasks the play surface needs people to meet blind: a search
   *  result for it would quietly poison the human baseline the site exists to collect.
   *  This keeps it out of indexes; it is NOT access control -- the route stays public. */
  noindex?: boolean;
}

export function usePageMeta({ title, description, canonicalPath, noindex }: PageMetaOptions): void {
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

    // index.html already ships a <meta name="robots"> with the site-wide directive, so
    // APPENDING a second one leaves two contradictory tags in the head and hands the
    // decision to whichever crawler is reading. Mutate the existing tag instead, and put
    // its old value back on unmount -- this is a single-page app, so a noindex left behind
    // would follow the user onto every page they visit next and de-index the site.
    if (!noindex) return;
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const tag = existing ?? document.createElement('meta');
    const previous = existing?.getAttribute('content') ?? null;
    if (!existing) {
      tag.setAttribute('name', 'robots');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previous === null) tag.remove();
      else tag.setAttribute('content', previous);
    };
  }, [title, description, canonicalPath, noindex]);
}
