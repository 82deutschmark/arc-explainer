# Using the ARC Prize cards in the news

Author: Claude Sonnet 5.5 Medium · 30 October 2026 · written at the Boss's request so every writer, Codex desk and
Claude run uses the cards the same way. Read this with [TEAM_PLAYBOOK.md](TEAM_PLAYBOOK.md) (lookup and registry rules)
and [CARD_ART_BRIEF.md](CARD_ART_BRIEF.md) (artwork).

**Name.** The set is **ARC Prize** (2026). "Card Cabinet" was only an internal development name: never print it in a
story, caption, post or commission brief. Say "the ARC Prize cards", or "card P026". Each year's set gets its own
look, the way baseball sets do; the 2025 set is the painted ARC Hall of Fame and stays up as the earlier set.

## What a card is

One numbered card for every Kaggle **competitor** (P-numbers), **competition sponsor** (François Chollet, Mike Knoop;
also P-numbers) and **team** (T-numbers). People get a card because they are achieving something in the competition,
so having one is already a distinction. Words to use: competitor, sponsor, team. Never "player".

- **Front:** our own ARC Hall of Fame cyberpunk rendering of the real person, a tier border and medallion in Kaggle's
  own ladder (Novice, Contributor, Expert, Master, Grandmaster; each tier looks richer than the last), the ARC Prize mark,
  card number, a LIVE or FINAL stamp with one as-of date, and the standing (rank, peak, score, submissions).
- **Back:** career table (finishes, field size, medals), season standings, teammates, a "did you know" strip.
- Everything printed is drawn from sourced data. Standings are the saved board at the stamped date, not live.

## Before you write: look everyone up

For every person or team you name, find their card first (`/news/cards`, `/api/news/cards`, or `content/news/cards.json`
plus `people.json`). Match by name, exact Kaggle handle and aliases; handles that look alike are different people. The card
tells you tier, medals, best finishes, teammates, honours and what art exists. Facts on the card are safe to reuse;
refresh current rank and score from the run's board evidence, since the card carries its own as-of date.
No card for someone? Keep the verified name and handle, note the gap in your handoff, and do not invent a bio, team,
honour or likeness to fill it.

## Featuring cards in a story

The story page has an **In this story** shelf. It shows the real card front of every person the story names or cites,
side by side, each linking to that person's card page; a person without a card shows as a small portrait tile. The shelf
is built from the text, so you control it:

1. **Name people by full name** in the headline, dek or section text (a handle that is the person's public name works:
   "xz"). That puts their card on the shelf. Cite a person's source ID in a section's sources
   (`person-<id>-identity|fact|archive|roster-<n>`) and they appear too.
2. **Teammates who are not named or cited do not appear.** Do not pad: feature the people the story is about.
3. **The featured person** is the one named first in the headline, else in the dek, else first cited. Choose your
   headline with that in mind: the story's lead art and share preview follow them.
4. **Write the card in:** a sentence that uses what the card holds is better than a generic one. "Grandmaster Ivan
   Sorokin, first in last year's ARC Prize" beats "a strong competitor". Use Kaggle's tier words exactly. Sponsors are
   introduced by what they did, not by explaining who they are.
5. **Link the card.** Give the card permalink (`https://arc.markbarney.net/news/cards/<card id>`) in handoffs, captions
   and social drafts wherever you mention the person, so readers can open and collect it.
6. **Cards never override evidence.** A card is a lookup, not permission to invent motives, quotes, plans or a rivalry.

## Pictures

- To show a card in a post or story art, use the card image endpoints (below), never a screenshot or a crop.
- A reviewed custom illustration still leads a routine X announcement (see [X_POSTING.md](X_POSTING.md)). When a post is
  about one person and there is no custom illustration, attach that person's **share preview** (1200x630) and link the
  card page; for a collection note, show the card front.
- Do not commission or generate card art during a news run unless ordered. Art is bound in `content/news/cards.json`
  only after review; the provenance record in `content/news/artwork/` must exist, and rejected pieces stay unbound.
  New art follows [CARD_ART_BRIEF.md](CARD_ART_BRIEF.md): 5:7, clean (no text, no frame), room for the code-drawn border,
  badges and stats.
- No card art yet shows a designed "rendering on the way" card. That is intentional; say nothing about it in copy.

## Endpoints

| what | address |
|---|---|
| Card page (share this link) | `/news/cards/<card id>` |
| Whole collection, with the earlier Hall of Fame set | `/news/cards` |
| Front or back PNG, 750x1050 | `/api/news/cards/<card id>/image.png?side=front` or `side=back` |
| Thumbnail | `/api/news/cards/<card id>/thumb.webp?side=front&w=300&v=<version>` |
| Share preview, 1200x630 | `/api/news/cards/<card id>/share.png` |
| Data | `/api/news/cards` |

Card ids look like `person-ivan-sorokin-2026` and `team-turducken-2026`.

## Checklist before you file

- Every named competitor, sponsor and team looked up; card links in the handoff.
- Headline and dek name the person the story is about (that sets the lead art and the shelf).
- Tier words are Kaggle's; nobody is a "player"; sponsors are not explained.
- Standings come from this run's board evidence, with the date; card facts are reused, not embellished.
- Missing card or art: gap recorded, nothing invented.
