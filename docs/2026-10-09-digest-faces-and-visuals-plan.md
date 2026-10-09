# ARC Daily Digest: faces, honors and the visuals map

Author: Claude Opus 5.5 · 9 October 2026

## Goal

The Boss reviewed GPT-6 Sol's new people pages: text-only cards ("totally insufficient, like these
cards for Jack Cole"), while the site already holds last year's illustrated Hall of Fame cards for
the past winners and every contestant has a Kaggle profile picture. He asked for a face wherever a
person appears, past winners' records to show, no redesign, a guide to every picture we have for
other assistants, and a note GPT-6 reads so its scheduled jobs use all of it.

## Decisions

- **One portrait per person**, square, under `client/public/news-images/people/`. Hall of Fame art
  first (face cropped from the person's own single-person card), else their own Kaggle picture,
  else initials. Group cards (ARChitects) are never cropped into individual faces; the founders
  crop shows both founders. Kaggle pictures are saved, not hotlinked, and a re-run removes our
  copy if the owner removed theirs.
- **Validation in both readers.** `scripts/newsroom_people.py` (publish path, scheduled runs) and
  `newsStore.ts` (site) accept an optional `portrait` whose source is the person's own verified
  Kaggle account or their own Hall of Fame card. Hall of Fame art may now be `.jpeg` or a spaced
  filename (`/jackcole.jpeg`, `/arc founders.png`).
- **Honors reuse `hallOfFame`.** Labels read like an almanac and link to the card; sources are
  the official ARC Prize results pages. Honors only where the person's own roster or credit
  supports them (Hartmann's start in 2025: he was not on the 2024 Kaggle roster).
- **Faces follow citations, not a layout engine.** A story shows the people its sections cite
  (`person-<id>-…` source IDs), then verified people on its teams. The front-page Hall of Fame band
  shows past winners from the latest editions first. Variety comes from the reporting.
- **New people with primary sources:** Ivan Sorokin (NVARC write-up credits `sorokin`; ARC Prize
  credits the NVARC paper to I. Sorokin and Puget; NVIDIA report) and Daniel Franzen (ARChitects'
  write-up credits `dfranzen`), plus notebook records for Franzen's two solo entries.
- **GPT-6's jobs** already read `AGENTS.md`, `docs/newsroom/REPORTER.md` and the reporter skill
  every run, so the note lives there; scheduled runs may not edit automations. The note asks
  GPT-6 to add `VISUALS.md` to its automations' reading list in its next interactive session.
- **Timing.** The 6 pm edition rewrites `people.json`/`competitors.json` into canonical form, so the
  ledger edits are applied by an idempotent script after that edition lands, then pushed.

## Done

- [x] Portrait crops (Cole, Smit, Puget, Sorokin, founders) and six Kaggle pictures via the new
      `portrait` command; Mithil A Vakde has the default avatar and shows initials.
- [x] Schema, validators, `portrait` and `check` commands; Python and site tests.
- [x] Faces on directory cards, profiles (header + honors + picture credit), rosters, notebook
      cards, front-page stories and dispatches, article pages, community posts; Hall of Fame band
      follows the news; empty "On the record" hidden; each card's art shown once per profile.
- [x] Hall of Fame: an anchor on every card, scroll to the linked card after load.
- [x] Server-rendered person pages carry the portrait and honors.
- [x] `docs/newsroom/VISUALS.md`; desk note atop `REPORTER.md`; `AGENTS.md` callout and section 5.7;
      reporter skill "Show the people"; leads for the research notebook.
