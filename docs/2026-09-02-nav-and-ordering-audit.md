# Navigation, ordering, and credit: an audit and the fixes

Author: Claude Opus 5
Date: 2026-09-02
PURPOSE: Record what was wrong with the site's own wayfinding and with the order tasks are
         shown in, because both were quietly working against the thing the site is for, and
         neither was visible from inside any single page.
SRP/DRY check: Pass — a findings document. Every rule it describes is enforced in code;
         nothing here needs to be remembered to stay true.

## 1. The front door had no handle

`arc3.markbarney.net/` renders the synthetic programme's landing page (see `RootLanding`
in `App.tsx`, which switches on hostname). **Nothing in the site chrome linked to it.** The
brand mark — the one control every site on earth uses for "take me home" — pointed at
`/arc3/gallery`.

That is also where the nav's **Browse** goes, so the brand mark was a duplicate button.
Two of the site's most prominent controls did the same thing, and the best page on the site
could only be reached by typing the URL.

**Fixed**: the brand mark points at `/`. On the synthetic host that is the landing page; on
the main host `/` redirects to the gallery, so it is still genuinely home. One control, one
meaning.

## 2. The gallery led with the worst work on the site

Section order was `ai-generated`, `custom`, `redbluepill`, `official`. Two problems:

- **`ai-generated` led.** That is the 571-task generator dump — the least finished thing
  here. The order had been corrected once already (it used to lead with `official`, which
  made the page read as a mirror of arcprize.org) and overshot.
- **`arena` was not in the list at all.** The 50 hand-authored tasks — the only ones built
  level by level, six to eight levels each, and reviewed one at a time — fell through to
  the unknown-category tail and rendered **last, under a raw slug heading**. The most
  finished work on the site was below the slop and unlabelled.

**Fixed**: `arena` (labelled "Hand-authored") leads, then in-house, then the community
catalog, then the official set, and the generator dump last. The pipeline output still
needs judging and still leads `/play`'s review queue, which is the surface that exists to
judge it. A browsing surface should open on the work that stands up.

**The review queue was already right** and is worth stating so nobody "fixes" it: `/play`
sorts by `generation` descending, the arena batch is generation 1000, and all 36 queued
hand-authored tasks occupy the first 36 positions. Reading `arc3Triage.json` in file order
suggests otherwise — the arena rows sit at the bottom of the file — which is a trap, not a
bug.

## 3. A quarter of the catalog was credited in one paragraph

252 of the tasks in the gallery are **[theredbluepill/arc-interactive](https://github.com/theredbluepill/arc-interactive)**,
mirrored under MIT. `client/src/utils/arc3Attribution.ts` derives the per-task source link
and the gallery's community section carries the licence notice — but a credit you only see
after scrolling to the right section of one page is not what a quarter of the catalog has
earned.

**Fixed**: ARC-Interactive is now the first external link in the site chrome, on every
page, ahead of ARC Prize and arc3.sonpham.net. The per-task deep links and the licence
notice stay where they are.

Worth knowing about that repo, because it is more than a task dump: 200+ community games,
tutorial stems `ez01`–`ez04` for new joiners, `--mode human` for playing them locally,
solvability checking under the shipped rules, and competition mode matching the real
toolkit. It is the same design principle this play surface runs on — goals learnable
through play rather than from docs, under one interface for humans and agents.

## 4. Pages nobody could find

Routes with no entry point anywhere in the chrome: `/` (above), `/arc3/hypotheses` (shipped
the same day and linked from nowhere), `/arc3/playground`, `/arc3/archive/games`.

**Fixed**: "About ARC-3" was a single link and is now an **ARC-3** dropdown with a Reference
group (About, Archive) and a Research group (Hypothesis traces, Agent playground). A page
reachable only by typing its URL is a page nobody visits, and the nav was asserting the
site is three things when it is eight.

`/arc3/mechanics` stays out, deliberately — it is the unlisted spoiler guide, and putting
it in the nav would defeat it. See `docs/2026-09-02-arc3-canvas-click-plan.md`.

## 5. Second pass: the landing page, the play bar, and the nav's own look

**Four stat cards that repeated the prose around them.** The landing page carried a row of
100% / 0.50% / task count / unplayed count. The first two appear verbatim in the hero
paragraph directly above; the second two are the opening line of the ask directly below.
All four were restatements set in a bigger font, and in a row they read as a dashboard
bolted onto an argument. Deleted. The citation stays — it is what makes the hero's claim
checkable rather than asserted.

A number earns a card when the card is the first place the reader meets it. That is the
rule; the comment where they used to be says so, so they do not grow back.

**The landing page opened on the slop.** Its tile strips used `pipelineFirst` — the 571
unreviewed generated tasks led every strip on the first page a visitor sees. Now
`authoredFirst`, matching the gallery and the review queue. Three surfaces, one answer
about what is worth someone's time; a visitor shown one task here and handed a different
one by Play has been told the site does not know its own mind.

**Three links to the gallery on one page**, plus Browse in the nav. The footer's was the
third and is now a link to the research page instead, which nothing else on the page
reached.

**The play page stranded you.** It renders its own slim bar rather than the site header —
correctly, because stacking `AppHeader` over the console is the double-chrome bug in point
1 of that file's header, and a dropdown menu over a game someone is concentrating on is
worse than useless. But the bar held only "All tasks", so from a task there was no route to
the landing page or anything else, and the one control every site puts in that corner was
missing. The brand mark is now there and goes home. Two links, both distinct, still no menu.

**The nav's own look.** The wordmark subtitle read `🟦 ARC 3 · archive: ARC 1 🟥 ARC 2 🟨` —
squares on the wrong side of two of the three labels, the numbers out of order, and an
"archive:" nobody needs in a nine-pixel line. It is a wordmark, not a sentence: now
`🟥 ARC 1 · 🟨 ARC 2 · 🟦 ARC 3`.

In the row itself a single 🟦 sat after the ARC-3 group and nowhere else, left over from a
pass that removed a square from between every item. One square used once reads as a stray
character. Each cluster now opens with its own palette square — 🟦 for the ARC-3 row, 🟥🟨
for ARC 1 & 2, 🟩 for Arena — which is the same palette as the brand mark beside it, and
reads as a system rather than as decoration.

## The pattern, again

Every one of these is the same shape as the control bugs in
`docs/2026-09-02-arc3-handoff-for-senior-review.md`: **a per-page decision that is wrong
when you look at the set.** No single page's nav is wrong. The gallery's section order is
defensible read alone. It is only from above that the brand mark duplicates Browse, the
best games render last, the biggest contributor is a footnote, and four pages have no door.

Whoever picks this up next: audit wayfinding the way we now audit controls — across the
whole surface, mechanically where possible, not one page at a time.
