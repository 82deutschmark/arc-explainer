# Player and team sports cards

Author: GPT-6 / Codex · October 29, 2026

## Goal

Make the existing Card Cabinet work like sports cards. A player is a lasting identity with
current teams, prior teams and Kaggle history. A team is a separate card with its own art,
competition record and roster. People and teams can share their own permanent card address.
Keep the existing artwork and the front/back presentation.

## Implementation

1. **Connect the records.** Reuse the verified people ledger, observed memberships, team
   snapshots and existing card registry. Add links from a player's teams to their team cards
   and from a team's roster to each player's card. Fall back to the sourced profile when a
   subject has no card. Match exact verified Kaggle handles and competition/team identities.
2. **Show the player's career.** Put their current observed teams on the front. Show dated
   current and previous team observations on the reverse and full card page, along with all
   sourced career highlights and public Kaggle accounts. Preserve simultaneous ARC2/ARC3
   memberships. Older observations alone cannot prove a player joined or left a team; label
   stale latest records as last observed. Keep public standings distinct from official honors.
3. **Give every card an address.** Add `/news/cards/:id`, with the selected card, its full
   record and links to connected player/team cards. Add an Open card link and Copy card link
   control to the Cabinet. Shared pages advertise that card's name, canonical URL and card PNG.
   A missing card gets a useful 404. A failed clipboard operation reveals the selectable URL.
4. **Keep browsing useful.** Retain collection search, player/team filters, contest filters,
   original art, card numbers and PNG downloads. Include career/team history in search. Keep
   team names and roster links readable on phones and usable with a keyboard.
5. **Verify and publish.** Check exact roster links, concurrent memberships, previous-team
   ordering, stale observations, card-page metadata and missing-card behavior. Run focused
   collection/rendering/HTTP checks and the production build. Review the final diff, update
   this plan and the changelog, commit and push to main. A successful push finishes publication.

## Scope

Use facts and artwork already in the repository. Do not invent Kaggle achievements or fill
unknown identities. Do not regenerate illustrations, publish held stories, send social posts,
change newsroom schedules or inspect deployment credentials. No browser publication checks.

## Completion

- [x] Connected player/team data and complete sourced history
- [x] Collection links and standalone card pages with sharing controls
- [x] Focused verification and production build
- [x] Changelog and final review; commit and push are the final publication operation

Validation: 79 collection, card rendering, PNG, HTTP, front-page and existing news checks
passed. Two archive-wide checks exceeded their old ten-second limit; both passed with time
for the complete archive after the final build finished. The production build passed.
The broad TypeScript check retains 12 existing diagnostics outside the changed files.
The card review caught and fixed external-source links being sent through the internal router.
