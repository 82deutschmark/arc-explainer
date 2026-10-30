/**
 * Author: Claude Sonnet 5.5 Low
 * Date: 30-Oct-2026
 * PURPOSE: The per-season SET DESIGN REGISTRY for the Card Cabinet. Baseball cards change look every year, so
 *          which look draws a card is a data row, not code: each row names the season, the series name printed on
 *          the pennant, the set name, the publisher and the key of the look module that draws it. 2025's painted
 *          Hall of Fame cards are preserved as issued and have no row here (they are never re-rendered). Adding
 *          2027 is one more row in content/news/series.json, plus a new look module only if the design changes
 *          (then add its key to SET_LOOKS). The same file holds the contest titles and the sponsor card text,
 *          which are data too. Lookups are used by the renderer (lookForSeason) and by the adapter (setForSeason).
 * SRP/DRY check: Pass. Reads and validates one JSON file; no drawing, no card maths.
 *
 * CHANGELOG
 * 30-Oct-2026 v1 (Claude Sonnet 5.5 Low): first version; one row (2026, look topps86, placeholder series name).
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** The look modules that exist. A new design adds its key here and one module that draws it. */
export const SET_LOOKS = ['topps86'] as const;
export type SetLook = typeof SET_LOOKS[number];

const setSchema = z.object({
  id: z.string().min(1), season: z.string().regex(/^\d{4}$/),
  /** The series name printed on the round pennant. A placeholder until the Boss names the set. */
  name: z.string().min(1), setName: z.string().min(1), publisher: z.string().min(1),
  look: z.enum(SET_LOOKS),
  /** The newsroom calendar the as-of day is read in. */
  timeZone: z.string().min(1),
}).strict();
const sponsorSchema = z.object({
  organisation: z.string().min(1), bio: z.string().min(1),
  facts: z.array(z.object({ text: z.string().min(1), sourceUrl: z.string().url() }).strict()),
}).strict();
const seriesFileSchema = z.object({
  version: z.literal(1), sets: z.array(setSchema).min(1),
  /** Kaggle's full title for a contest, by competition slug. */
  contestTitles: z.record(z.string()),
  /** Hand-written card text for the competition sponsors, by person id; every fact cites a source. */
  sponsors: z.record(sponsorSchema),
}).strict().superRefine((file, ctx) => {
  for (const key of ['id', 'season'] as const) if (new Set(file.sets.map(row => row[key])).size !== file.sets.length)
    ctx.addIssue({ code: 'custom', message: `Duplicate set ${key}` });
});
export type SetDesign = z.infer<typeof setSchema>;
export type SponsorProfile = z.infer<typeof sponsorSchema>;
export type SeriesFile = z.infer<typeof seriesFileSchema>;

const cache = new Map<string, SeriesFile>();
/** Read and validate content/news/series.json (cached per file path). */
export function loadSeriesFile(directory = path.join(process.cwd(), 'content/news')): SeriesFile {
  const file = path.join(directory, 'series.json');
  let found = cache.get(file);
  if (!found) cache.set(file, found = seriesFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))));
  return found;
}

/** Every set, oldest season first. */
export const setDesigns = (): SetDesign[] => [...loadSeriesFile().sets].sort((a, b) => a.season.localeCompare(b.season));
export const setById = (id: string): SetDesign | null => loadSeriesFile().sets.find(row => row.id === id) ?? null;
export const setForSeason = (season: string): SetDesign | null => loadSeriesFile().sets.find(row => row.season === season) ?? null;
/** The look module key that draws a season's cards; throws for a season with no row (a 2025 card is never re-rendered). */
export function lookForSeason(season: string): SetLook {
  const row = setForSeason(season);
  if (!row) throw Error(`No set design registered for season ${season}`);
  return row.look;
}
export const contestTitle = (slug: string): string | null => loadSeriesFile().contestTitles[slug] ?? null;
export const sponsorProfile = (personId: string | undefined): SponsorProfile | null => (personId && loadSeriesFile().sponsors[personId]) || null;
