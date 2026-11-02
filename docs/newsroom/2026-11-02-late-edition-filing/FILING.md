<!--
Author: Claude Opus 5.5 Medium
Date: 02-November-2026
PURPOSE: The reporter's filing for the 2 November Late edition: two stories ready for the editor, and an art request for each, to be drawn by Codex in its app.
SRP/DRY check: Pass. The stories live in the two article files beside this one; this note only hands them over.
-->

# Late edition filing: 2 November 2026

From Claude (reporter) to the editor and to Codex (graphic artist).

Two stories are written and pass the newsroom's checks against this afternoon's board, read at 19:15 UTC. Rechecked against the 21:15 UTC board: every place and score quoted still stands. tascj is #11, so the ARC-2 headline now says "#9 on arrival" rather than "top ten". Nothing has been published, posted or sent.

| Contest | Headline | File |
|---|---|---|
| ARC-3 (lead) | From #593 to the top ten: infinity’s overnight leap | `arc-3-article.json` |
| ARC-2 | One run, #9 on arrival: Kaggle’s #2 drops in on ARC-2 | `arc-2-article.json` |

Both were written against a preview brief (article ids ending `-preview`; the brief itself is working data and stays out of Git). At 6 pm, run the normal closing `prepare` without `--preview`. Copy the headline, dek, sections, team list, Discord line and intake review onto the fresh base. Recheck the quoted numbers against the fresh table, validate, then publish. Two editorial assignments mark these as tonight's leads: `nov02-late-infinity-leap` and `nov02-late-tascj-one-entry`. The new public facts the stories cite are filed in `content/news/competitors.json` (infinity, Progress, tascj).

## Art request 1: ARC-3 lead, "The bolt from #593" (required)

**Story in one line.** Infinity, two people in Ho Chi Minh City, sat on the same score for a month, far down the board. Then one run took them from #593 into the top ten overnight.

**Make the characters first.** Neither member has approved art. Build each from their own Kaggle profile picture, saved in `references/`. Never guess a face.

- **Van-Phuc Huynh**, `references/van-phuc-huynh-kaggle.jpg`. His picture is a desert thunderstorm over red-rock buttes, with one bright lightning bolt. Draw him as that storm: a living thundercloud character with a lightning bolt, no human face.
- **Trần M. Tiến**, `references/tran-m-tien-kaggle.png`. His picture is a simple line-drawn white cat with big round glasses and pink paw pads, peeking over a table edge beside a blue book. Keep the round glasses and the blue book. He must look nothing like Jan Disselhoff's orange cat below.

**Scene.** The paper's GPU Valley, in its usual comic-book style. Far down the slope, a long jammed queue of carts and siege engines winds uphill: the crowded middle of the board. Out of a red-rock storm, the lightning bolt strikes upward and carries the little round-glasses cat, clutching his blue book, out of the jam. They land on the top-ten ridge just below the two leaders' strongholds, with the storm-cloud teammate crackling above. It should feel like one sudden leap, not a climb.

**Background cast (optional; leave them out before crowding the picture).**

- Yi-Chia Chen's two rabbits on the highest fort, from `client/public/news-images/references/2026-10-12-chen-bunnies-character-v1-base.webp`.
- Tufa Labs' friendly spiders on the neighbouring fort, from `client/public/news-images/references/2026-10-12-tufa-labs-reference-1-v1.webp`.
- The ARChitects a little lower, hauling their siege tower up one step: fox David Hartmann, cat Jan Disselhoff, duck Daniel Franzen and mouse Sebastian Brodehl. Use `references/2026-10-12-david-hartmann-reference-1-v1.webp`, `references/2026-10-12-jan-disselhoff-reference-1-v1.webp`, `references/2026-10-12-daniel-franzen-reference-1-v1.webp` and `2026-10-26-sebastian-brodehl-hero-avatar.png` (all under `client/public/news-images/`). Use `2026-10-26-architects-dream-team-base.png` only to keep the four looking like themselves together. Do not rerun that scene.

**Style references only, not scenes to copy:** `2026-11-02-morning-hairpin-v1-base.webp` and `2026-10-18-top-ten-siege-full-crew-v1-base.webp`. The new picture needs a new setting, camera and action.

**Rules.** No text, numbers, scores, places or logos in the art; the score panel is added afterwards in code. No other real people. Make it with the built-in image tool in the app, then register and compose it under `docs/newsroom/ART_DESK.md`.

## Art request 2: ARC-2, "One wingbeat" (nice to have)

**Story in one line.** tascj, ranked #2 in all of Kaggle, made a single ARC-2 submission and arrived at #9.

**Make the character first.** tascj, `references/tascj-kaggle.png`. His picture is a pen-and-ink white goose, drawn in fine black engraving lines on pale grey. Keep that crosshatched ink look for him even inside a colour scene, so he reads as the drawing come to life.

**Scene.** A tall cliff of crowded ledges, with teams climbing ropes and ladders all the way up. The ink goose glides in on one wingbeat past all of them and lands neatly on a ledge near the top. Lower down, Daniel Franzen's duck climbs alone with a rope: sunglasses, cyber-engineer armour, from `client/public/news-images/cards/2026/daniel-franzen-duck-solo-v1.png`. Optionally, the storm cloud and the round-glasses cat from request 1 are halfway up, since the same pair plays ARC-2 as Progress.

**Rules.** The same rules as request 1 apply. One picture per contest at most.

## For whoever is building the movement detector

The newsroom's own brief missed both of tonight's leads, for three reasons:

1. **The comparison only covers the top 300.** Infinity started at #593, so the brief has no starting point for it. Its score change shows as blank, and it was never listed as a gainer. The board feed already carries every team's previous score and place in its previous-score and previous-place columns, so the brief should use those.
2. **Brand-new teams never count as gainers.** tascj entered at #9 with one submission, but a team with no earlier score is never a gainer. When it slipped to #11, it fell out of the brief entirely.
3. **The featured teams are a fixed list in the code.** They sit in the `FEATURED` constant in `scripts/newsroom.py`. Getting tascj into the brief meant adding an editorial assignment by hand.

## For the editor

- The ARC-2 goose arrives on the night of the Goose rebrand. That is a coincidence of tascj's own avatar, not something we made up.
- Times in the copy are Eastern Standard: clocks went back on 1 November.
- The 6:59 pm Eastern bell, and runs still being scored after it, may change any place in either story before it runs.
