/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-27
 * PURPOSE: Display the existing reference article shared with initial HTML rendering.
 * SRP/DRY check: Pass — one article for readers and crawlers, no duplicate summary document.
 */
import Arc3ReferenceContent from '@shared/Arc3ReferenceContent';
import { usePageMeta } from '@/hooks/usePageMeta';
export default function Arc3Story() {
  usePageMeta({ canonicalPath: '/arc3' });
  return <Arc3ReferenceContent />;
}
