/**
 * Author: Claude Opus 5
 * Date: 2026-09-06
 * PURPOSE: The arc3 landing page's palette and type stacks, in one place, so the page and
 *          the components it composes cannot drift apart.
 *
 *          Extracted from SyntheticLanding.tsx when the leaderboard-standing and
 *          harness-gap components were added. Copying the palette into each new component
 *          would have made it the SIXTH inline copy in this directory, and a shared border
 *          colour that is right in five files and wrong in one is the kind of bug nobody
 *          files and everybody sees.
 *
 *          SCOPE, DELIBERATELY NARROW. CommunityGallery, CommunityGamePlay, Arc3Review and
 *          Arc3HypothesisResearch each still declare their own `ARC` object. Those are NOT
 *          all the same palette -- the play surface and the review console run dark on
 *          purpose -- so folding them in here is a real refactor with real decisions in it,
 *          not a rename. Left alone rather than half-done.
 *
 *          LIGHT, ON PURPOSE. This page ran on the console's near-black palette, inherited
 *          from the play surface where a dark ground is right: it is a game screen and the
 *          frames are saturated pixel art that needs somewhere quiet to sit. A landing page
 *          is not a game screen. Dark chrome made it read as a research console for people
 *          already inside the project rather than an invitation to someone who has never
 *          heard of any of this. Task thumbnails keep their own dark cells (`tile`), so the
 *          frames still sit on the ground they were drawn for and the page's only saturated
 *          colour is the work itself.
 * SRP/DRY check: Pass - tokens only, no components and no logic. SyntheticLanding.tsx now
 *          imports these instead of declaring them.
 */

export const ARC = {
  ground: '#FFFFFF',
  text: '#111111',
  dim: '#4A4A4A',
  faint: '#767676',
  cell: '#F6F5F4',
  border: '#E2E0DE',
  pink: '#C42F89',
  pinkAlt: '#A8256F',
  control: '#393736',
  green: '#2E8B1F',
  yellow: '#B8860B',
  /** The dark ground a task frame is drawn against, kept inside the tiles. */
  tile: '#141414',
} as const;

export const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";

/** Kept for chrome, ids and code, matching CommunityGallery and the official ARC-AGI-3 task pages. */
export const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace";

/**
 * One date format for every measurement the page shows.
 *
 * Every number on this page renders with the date it was taken, so this is used constantly
 * and must not vary between components -- "6 Sep 2026" beside "September 6, 2026" reads as
 * two different sources. en-GB, UTC, because the underlying captures are UTC and shifting
 * them into the reader's zone can move a capture to the wrong day.
 */
export function formatCaptureDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown date';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
