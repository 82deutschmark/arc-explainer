/**
 * Author: GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
 * Date: 2026-10-11
 * PURPOSE: Preserve links to the former production page by directing readers to the
 *          unified About the Paper page. Crawler content uses the same canonical destination.
 * SRP/DRY check: Pass — reuses the existing redirect component and shared staff path.
 */
import Redirect from '@/components/Redirect';
import { NEWS_STAFF_PATH } from '@shared/newsStaff';

export default function NewsMethod() {
  return <Redirect to={NEWS_STAFF_PATH} />;
}
