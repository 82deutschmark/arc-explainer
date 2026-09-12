/*
Author: Claude Opus 5
Date: 2026-09-07
PURPOSE: One definition of which ARC-AGI-3 tasks a visitor may be handed, shared by every
         surface that resolves "what should this person play next".

         WHY THIS FILE EXISTS. The category slug 'ai-generated' -- our own generator's
         unreviewed output, 571 tasks and the weakest thing on the site -- was written out
         by hand in four places: PIPELINE_CATEGORY in SyntheticLanding, PIPELINE_CATEGORY
         again in CommunityGamePlay, and HIDDEN_FROM_BROWSE plus the chip label in
         CommunityGallery. On 05-Sep the landing page started filtering that set out of the
         tiles it shows. The other three surfaces did not, and nothing made them.

         The result was reported on 07-Sep: the front page featured a reviewed task by id
         and thumbnail, said nobody had ever played it, and its Play button went to bare
         /play -- which re-resolved from the unfiltered queue and opened a pipeline task
         instead. Two selectors, two answers, and the page advertised the one it did not
         deliver.

         THE RULE. Hiding is a presentation decision and stays at the presentation layer;
         the catalog that resolves sources and thumbnails is not touched. What changed is
         that the decision now has ONE home, so a surface opts in by importing rather than
         by remembering.

         VISITOR vs REVIEWER is the distinction that matters here, and it is not the same
         as "front page vs everywhere else". A visitor is anyone we asked to come and play;
         they get the reviewed set. A reviewer opened /arc3/review to judge the generator's
         output, so they get all of it -- that queue exists to triage exactly the set a
         visitor is spared.
SRP/DRY check: Pass - owns the category constants and the two predicates over them, and
         nothing else. Ordering stays with the pages that render strips; queue resolution
         stays with the pages that route. No fetching here.
*/

/** Our own generation pipeline: unreviewed, and the set /arc3/review exists to judge. */
export const PIPELINE_CATEGORY = 'ai-generated';

/** The reviewed tasks: agent-generated, then played and revised until they hold up.
 *  NOT hand-authored -- copy that said so was untrue. Matches CommunityGallery's labels. */
export const AUTHORED_CATEGORY = 'arena';

/** Community tasks that have been through at least one revision pass. */
export const GLOWUP_CATEGORY = 'contributed-glowup';

/** Built in-house: hand-made by the two of us. The gallery calls them "Built in-house";
 *  they are the only tasks on the site a person wrote from nothing. */
export const CUSTOM_CATEGORY = 'custom';

/**
 * THE ALLOWLIST. Categories a visitor may be handed, and nothing else.
 *
 * 05-Sep-2026, Son Pham: "On the front page, we will only accept games with at least one
 * glow-up." That is arena + contributed-glowup, 94 tasks. The rule was written down and
 * then not implemented: the code excluded the generator's output and let the other 402
 * through, so a visitor who got past the 36 queued arena tasks started being handed
 * theredbluepill's 252-task community repo -- fine work, and not ours, so a verdict on it
 * answers nothing this site is asking.
 *
 * 07-Sep: `custom` joins them, on the user's call -- 31 tasks the gallery labels "Built
 * in-house", hand-made by the two of us. They predate the glow-up rule rather than
 * failing it, and they are the most obviously OURS work on the site, which is the actual
 * test this list applies. 125 tasks.
 *
 * AN ALLOWLIST, NOT A BLOCKLIST, and that is the point. A blocklist says which sets are
 * bad today; every category added later is visitor-facing by default and nobody finds out
 * until someone is playing it. 'ai-generated' arrived with 571 tasks the day after the
 * gallery shipped. The next one gets no such welcome.
 */
const VISITOR_CATEGORIES = new Set<string>([
  AUTHORED_CATEGORY, GLOWUP_CATEGORY, CUSTOM_CATEGORY,
]);

/** Anything with a category, which is every shape of task row the three surfaces pass in. */
interface Categorised { category?: string }

/**
 * Is this task one we would put in front of someone who came here because we asked them to?
 *
 * Every tile on the landing page links straight to /arc3/play/:id, so being shown and
 * being handed over are the same decision -- a set that is displayed but not playable
 * would just mean the curation is one click from being bypassed.
 */
export function isVisitorFacing(game: Categorised): boolean {
  return VISITOR_CATEGORIES.has(game.category ?? '');
}

/**
 * The tasks a visitor may be shown or handed. Reviewer surfaces do not call this.
 *
 * Widening it is one line: add a category to VISITOR_CATEGORIES. That is the intended
 * path for the pipeline set once it has been reviewed, which is the entire point of
 * reviewing it -- a task earns its way in by being glowed up, not by being generated.
 */
export function visitorFacing<T extends Categorised>(games: T[]): T[] {
  return games.filter(isVisitorFacing);
}

/** A task row with enough on it to be placed in a group and ordered inside one. */
export interface Groupable extends Categorised { gameId: string }

/**
 * ORDER WITHIN ONE GROUP. The gallery renders it and "Next task" walks it, and they must
 * agree — a strip whose order is not the order the Next button follows is a strip that
 * lies about what comes next.
 *
 * 12-Sep-2026, Hieu Pham via Son: "People like to play game one after the other. So change
 * it so that Next task is literally next task in the group." He plays g0xx and g5xx in id
 * order, and the site was not handing them over that way.
 *
 * TWO RULES, AND WHICH APPLIES DEPENDS ON THE GROUP:
 *
 * 1. The pipeline set keeps the review queue's order — newest generated work first, with
 *    the near-duplicates and the random-mashable held back. That order is the server's
 *    (Arc3Triage) and it is the entire product of triage; a reviewer opening /arc3/review
 *    is asking for it by name.
 *
 * 2. EVERY OTHER GROUP SORTS BY ID, ASCENDING. This is what the gallery already meant to
 *    do -- "Sources other than our pipeline have no verdicts, so they all tie here and
 *    keep manifest order" -- and did not: the review queue carries 36 `arena` entries as
 *    well as the pipeline's, so the arena strip rendered 36 tasks in triage order and the
 *    other 14 after them. Restricting the queue's authority to the set it was built for
 *    makes the code do what its own comment says. Sorting on the id rather than trusting
 *    the catalog's incidental order is deliberate: `custom` is already out of order
 *    upstream (tl01, pr01, ng01, eh01 are appended), and any future append would break
 *    the rest silently.
 */
export function withinGroupOrder(
  a: Groupable,
  b: Groupable,
  queuePlace: Map<string, number>,
): number {
  if (a.category === PIPELINE_CATEGORY && b.category === PIPELINE_CATEGORY) {
    const byQueue = (queuePlace.get(a.gameId) ?? Infinity) - (queuePlace.get(b.gameId) ?? Infinity);
    if (byQueue !== 0) return byQueue;
  }
  return a.gameId.localeCompare(b.gameId);
}
