/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: Guard the front page's From X strip against going stale. The strip reads the
 *          exported content/news/social.json through loadNewsArchive(); a post older than the
 *          one-week window must leave the index (as discussions and wire stories already do), so an
 *          edition desk that stops exporting empties the strip instead of showing weeks-old posts.
 *          Uses two real exported posts as templates, re-dated, in a throwaway archive folder.
 * SRP/DRY check: Pass — exercises the real store reader and schema; no new helper.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { loadNewsArchive } from '../server/services/news/newsStore';

const DAY_MS = 86_400_000;

it('keeps a From X post from the past week and drops one older than a week', () => {
  const exported = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/news/social.json'), 'utf8'));
  const [freshTemplate, staleTemplate] = exported;
  const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
  const fresh = { ...freshTemplate, postedAt: at(2 * DAY_MS), checkedAt: at(DAY_MS) };
  const stale = { ...staleTemplate, postedAt: at(10 * DAY_MS), checkedAt: at(9 * DAY_MS) };
  // A post with no recorded posting time is judged by when it was checked.
  const undatedStale = { ...exported[2], postedAt: null, checkedAt: at(8 * DAY_MS) };

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'news-social-'));
  try {
    fs.writeFileSync(path.join(directory, 'social.json'), JSON.stringify([fresh, stale, undatedStale]));
    const { index, skipped } = loadNewsArchive(directory);
    expect(skipped.filter(entry => entry.file === 'social.json')).toEqual([]);
    expect(index.social!.map(post => post.id)).toEqual([fresh.id]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
