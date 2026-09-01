/*
Author: Claude Opus 5
Date: 2026-09-01
PURPOSE: Where a mirrored task actually came from, and the credit that has to travel with
         it. Today that is one catalog: the 252 tasks in the `redbluepill` category are
         theredbluepill/arc-interactive, which is MIT-licensed. MIT requires the copyright
         and licence notice to accompany the work, and we were serving a quarter of the
         gallery from it with no attribution anywhere on the site. That is an obligation,
         not a courtesy.

         THE MAPPING IS DERIVED, NOT TABULATED. A manifest id is `<slug>-<version>` and the
         source lives at `environment_files/<slug>/<version>`. Both id shapes occur —
         `ab01-v1` (81 of them) and `as01-63be02fb` (171) — and both follow the same rule,
         so splitting on the LAST hyphen covers the set. Verified 01-Sep-2026 against the
         repository's own git tree: 252 of 252 resolve to a directory that exists. A table
         would go stale the moment they publish a task; this cannot.

         An id that does not fit the shape falls back to the repository root rather than
         emitting a deep link that 404s — a wrong link is worse than a general one.

         SPOILER NOTE, and it decides where these links may appear. The linked directory
         holds a `metadata.json` carrying the title, description and tags the mirror
         deliberately strips. The PATH is opaque, so the link leaks nothing by itself, but
         it is one click from a full spoiler. Same accepted class as "the Python is
         readable in devtools" — and it is why the play surface shows this only once a run
         is over, never beside a task someone is still working out.
SRP/DRY check: Pass — one source of truth for the URL and the credit strings, used by the
         gallery and the play surface rather than duplicated in both.
*/

export const REDBLUEPILL = {
  /** Upstream's own category slug for this catalog. */
  category: 'redbluepill',
  owner: 'theredbluepill/arc-interactive',
  repoUrl: 'https://github.com/theredbluepill/arc-interactive',
  licence: 'MIT',
  licenceUrl: 'https://github.com/theredbluepill/arc-interactive/blob/main/LICENSE',
} as const;

/**
 * The upstream directory for one community task.
 *
 * @param gameId a manifest id such as `ab01-v1` or `as01-63be02fb`
 * @returns a deep link to that task's source directory, or the repository root when the
 *          id does not split into slug and version.
 */
export function redbluepillSourceUrl(gameId: string): string {
  const at = gameId.lastIndexOf('-');
  if (at <= 0 || at === gameId.length - 1) return REDBLUEPILL.repoUrl;
  const slug = gameId.slice(0, at);
  const version = gameId.slice(at + 1);
  return `${REDBLUEPILL.repoUrl}/tree/main/environment_files/${slug}/${version}`;
}

/** True when this task is one we owe credit for. */
export const isRedbluepill = (category: string): boolean => category === REDBLUEPILL.category;
