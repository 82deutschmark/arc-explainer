/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: One brand and premiere gate for newspaper pages, metadata and card
 * captions. A prepared config remains the old paper until an enabled release has
 * passed its time gate and official closing checks. No timer or scheduled job.
 * SRP/DRY check: Pass — browser and server import the same checked configuration.
 */
import config from './newsBrand.json';

export interface NewsBrandConfig {
  version: number; enabled: boolean; notBefore: string; name: string; legacyName: string; logo: string; tagline: string;
  requiredCompetitions: string[];
  closeChecks: { competition: string; status: string; sourceUrl: string; checkedAt: string; closeAt: string }[];
}

export function newsBrandAt(now = Date.now(), value: NewsBrandConfig = config) {
  const ready = value.enabled && Number.isFinite(Date.parse(value.notBefore)) && now >= Date.parse(value.notBefore)
    && value.requiredCompetitions.every(slug => value.closeChecks.some((raw: unknown) => {
      const check = raw as { competition: string; status: string; sourceUrl: string; checkedAt: string; closeAt: string };
      if (check.competition !== slug || check.status !== 'closed') return false;
      const at = Date.parse(check.checkedAt), close = Date.parse(check.closeAt);
      try {
        const source = new URL(check.sourceUrl);
        return source.protocol === 'https:' && ['www.kaggle.com', 'kaggle.com'].includes(source.hostname)
          && (source.pathname === `/competitions/${slug}` || source.pathname.startsWith(`/competitions/${slug}/`)) && Number.isFinite(at) && Number.isFinite(close)
          && at >= close && at <= now;
      } catch { return false; }
    }));
  return { name: ready ? value.name : value.legacyName, logo: ready ? value.logo : null,
    tagline: ready ? value.tagline : null, goose: ready };
}

export const NEWS_BRAND = newsBrandAt();
export const NEWS_NAME = NEWS_BRAND.name;
