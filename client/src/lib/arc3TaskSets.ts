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

/** Anything with a category, which is every shape of task row the three surfaces pass in. */
interface Categorised { category?: string }

/**
 * Is this task one we would put in front of someone who came here because we asked them to?
 *
 * 05-Sep-2026, Son Pham: "Fresh Off The Pipeline is a slop machine garbage of epic
 * proportion, hide them from main page for the time being." That call is this predicate.
 */
export function isVisitorFacing(game: Categorised): boolean {
  return game.category !== PIPELINE_CATEGORY;
}

/**
 * The tasks a visitor may be shown or handed. Reviewer surfaces do not call this.
 *
 * Shaped to be reverted in one line -- `return games` -- if the pipeline set is ever good
 * enough to show, which is the entire point of getting it reviewed.
 */
export function visitorFacing<T extends Categorised>(games: T[]): T[] {
  return games.filter(isVisitorFacing);
}
