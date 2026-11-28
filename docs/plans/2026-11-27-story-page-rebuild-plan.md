<!--
Author: Claude Opus 5.5 Medium
Date: 27-November-2026
PURPOSE: Plan the rebuild of the Loose Goose story page as a real newspaper page, put Generalist Gaming in front with
         ARC Prize 2026 moved to an archive, fix the "In this story" cards on every story, and improve the editor credit.
SRP/DRY check: Pass. Reuses the front page's grid, the shared story renderer (browser and server HTML), the card
         collection and the existing board store; nothing new is invented where the site already has it.
-->

# Story pages that read like a newspaper

## Why

On 27 November the Boss looked at the Franzen story (`/news/daniel-franzen-arcade-entrance`) and called it atrocious.
On a laptop it is more than five screens tall for a two-minute read. Everything sits in one column the full width
of the page: lines of text far too long to read, a cover that fills a screen, an old team picture that fills two
more, the leaderboard typed out as lines of text, a row of tiny source links after every section, and empty space
down both sides. A newspaper treats space as precious and fills every part of the page with something useful. The
front page already does this (wire on the left, lead in the middle, board on the right); the story page does not.

The "In this story" row is also broken on every story, not just this one. It shows only the cards a writer typed
into the story by hand. Franzen's story shows his old duck card, not the career card made for this story, and none
of the other people the story names. The Boss called this a systematic failure.

Generalist Gaming is now the contest the paper follows. ARC Prize 2026 closed on 2 November, yet the front page's
board, its ticker and its "Inside" box are still ARC-only, and the site has no Generalist Gaming board feed. The ARC
material goes into storage until next year: kept, reachable, out of the way.

## What stays

The cream paper, the serif type, the blue place and green score colours, the comic art, the masthead art, every
story's address, and the one shared renderer that keeps the browser page and the server HTML the same. Old stories
keep their words and pictures; only the page around them changes.

## Objectives

1. On a laptop, a story's headline, cover, opening text and board are in the first screen, and the whole story is
   read in about one and a half screens.
2. Every part of the page carries something useful. No empty margins, no picture larger than its information.
3. On a phone the story reads cleanly in one column with nothing lost.
4. "In this story" shows the right cards on every story, chosen by a rule, never by hand.
5. Generalist Gaming leads the paper. ARC Prize 2026 is one archive link away and appears on a story page only when
   the story is about ARC.
6. The editor credit looks like a newspaper's and carries the Boss's title, Head Meat Proxy.

## The story page

Laptop and wider: the front page's three columns, with rules between them.

- **Top.** On story pages the masthead art runs at about half height; the section links and the ad share one row.
- **Left column (narrow): the contest wire.** The story's own contest first: its other stories newest first, each
  with kicker, time, headline and one line of dek, small pictures on the top two. Then "Elsewhere in the Goose",
  headlines only. Then one line linking to the ARC Prize 2026 archive.
- **Middle column: the story.** Kicker, headline, dek and byline, then the cover at the column's width (about a
  third shorter than today) with its caption. The text runs in two newspaper columns with a large opening letter,
  run-in section heads, and the house place and score styles. A picture inside a section becomes an inset one column
  wide. Sources become small numbered notes at the end in three columns, with the note numbers after each section,
  as the style guide already asks.
- **Right column: the board and the cast.** First the story's own dated board as a real table (place, team, score,
  entries, last entry), the story's subject highlighted, its time and "public board, provisional" above it, and a
  link to the full board. Then "In this story" (below). Then the editor credit.

Phone: one column, in reading order: headline, cover, text, board, cards, notes, the contest wire.

DECISION (taken): the story page shows the story's own dated board, never a live one beside it, so the page always
agrees with its text. The live Generalist Gaming board goes on the front page.

## "In this story": a rule for every story

Today the row is the story's hand-typed card list, filtered to people in the story. Replace it with this rule in the
shared code, so the browser page, the server page and every story use it:

1. The people in the story: those the story lists, then anyone on the story's dated board or named in its text who
   has a card for the story's contest.
2. For each person, their best card first: the newest card issued for the story's contest or set (Franzen's new
   Kaggleverse career card), then their older cards, newest first (his ARC-AGI-3 duck card, then the ARChitects
   Hall of Fame card).
3. The story's subject first, then the others in board order.
4. A hand-typed list may only change the order or add a back face. It never limits the row.
5. Cards are shown large enough to read in the right column (the lead card at column width, the rest in a grid of
   two or three); on a phone, a row that scrolls sideways.

A test runs the rule over every published story and fails if a story's subject has a card that is not shown, or if
a person's newest card is not shown before their older ones.

## Putting ARC Prize 2026 into storage

- **Front page board and ticker:** Generalist Gaming in place of the two ARC boards. The site's board feed covers only
  the two ARC contests today; it is extended to Generalist Gaming from the board store the cards already read.
- **The "Inside" box:** the ARC links (medal race, score history, ARC-AGI-2 board, human records, game guides, ARC
  Discord) move to one "ARC Prize 2026 archive" entry; Generalist Gaming items take their place.
- **Archive page:** `/news/archive/arc-prize-2026` (or the story archive filtered to it) collects the final boards,
  the medal race, the game guides and every ARC story. Nothing is deleted; every old address keeps working.
- **Cards page:** the Generalist Gaming set and the Kaggleverse career cards first; the ARC sets under "2026 archive".
- **Masthead countdown:** points at the Generalist Gaming close.

DECISION (for the Boss): the wider ARC Explainer site's top bar (ARC-3, ARC 1 & 2 tabs) is outside the paper and
stays as it is unless he says otherwise.

## Editor credit

The role becomes "Editor-in-Chief · Head Meat Proxy" (the shared staff record, so the credit and the About the
Paper page agree). The credit becomes a proper editor's box: his portrait, his name, the two titles, one line on
what he does ("The paper's one human. He points the desks at a story and answers for what they print."), the
story's editor note when it has one, and a link to About the Paper.

DECISION (taken, the Boss may reword): the title pair and that one-line description.

## Steps

1. **Mockup, no live change.** A static page in the newsroom repo (`docs/loose-goose/mockups/`) built from the real
   Franzen story, pictures, board and cards, with laptop and phone proofs. The Boss reviews it.
2. After his approval, **the story layout** in the shared renderer: the browser components and the server HTML,
   with the styles in `news.css`.
3. **"In this story" rule** in `shared/newsCollection.ts`, used by both renderers, with the all-stories test.
4. **ARC into storage:** the Generalist Gaming board feed, front-page board and ticker, the Inside box, the archive
   page, the cards page order, the countdown.
5. **Editor credit** and the staff record.
6. **Checks:** the news tests plus new tests for the board table, note order and card rule; laptop and phone proofs
   of the Franzen, Keith Tyser and opening-board stories and one old ARC story, measuring how many screens each takes.
7. Changelog, commit and push to main (the push deploys), then check the live pages.

## Done when

The Franzen story shows headline, cover, opening text and board in the first laptop screen and ends within about
two; its card row leads with the new career card, then his older cards, then the others the story names; every
published story passes the card rule test; the phone layout reads cleanly; the front page shows no ARC table or
link except the archive entry; all news tests pass; the live pages match the proofs.
