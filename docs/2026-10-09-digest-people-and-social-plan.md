# ARC Daily Digest: people, sources and social briefing

The user approved this bounded implementation on 9 October 2026, including the Sunday meeting bridge and reuse of verified Hall of Fame artwork. Implementing in the existing newspaper design; publication and the described schedules are authorized.

## Design boundary

The current newspaper design is looking good to the user. Extend its existing components and routes. Do not replace the front-page layout, remove reporting or advertising sections, redesign the masthead, or change existing permanent links. The front page remains the important scheduled recap; supporting material branches into dedicated pages. Renaming the publication is a small wording change, not a design project.

## Scope

- Rename the masthead to The ARC Daily Digest while retaining permanent URLs and immutable editions.
- Add a compact link to a dedicated How This Is Made page explaining AI drafting, source checks, edition cutoffs and sponsorship. Include the requested line: “When we’re not Kaggling, a little spare compute takes a turn at the sports desk.”
- Keep persistent sourced people separate from competition teams. Store dated membership observations, verified accounts, narrow facts and explicit Hall of Fame links.
- Show the people behind covered teams and their other observed competition entries; use sports-desk language with attribution and respect.
- Build a durable portable competition-reporting skill, with the ARC adapter in reporter documentation. Keep internal research questions outside public content.
- Collect X at 5 am, 11 am, 5 pm and 11 pm Eastern; private briefings at 5:30 am/pm; consume public leads in 6 am/pm editions and the existing 2 pm recap.
- The daily scan's primary purpose is to enhance the news: announcements, reactions, research releases, relevant threads and linked primary material. The scan frequency does not imply posting that often. Keep the existing one-post 2 pm authorization; additional news alerts produce drafts unless separately authorized.
- Add the exact one-line community invitation, linked to the already-used ARC Discord invite: “Can't get enough ARC gossip? Come join us in the ARC Discord.”
- Signed-in browser and GPT-6 Sol subscription only. Restricted posts remain private. Existing Discord outputs remain drafts.

## Weekly meeting integration

The same collected source archive supplies public posts from the past seven days to Bubba's arc-weekly-announcement skill. It groups repeated stories, keeps exact source links and posting dates, and refreshes relevant sources. If the archive is unavailable, the existing twitter-watch workflow remains the fallback. The user still selects and approves the meeting bullets; Sunday 18:00 UTC, the event link and Discord announcement format remain the existing workflow. Subscriber material is excluded from the community announcement.

## Rollout

1. Approved by the user; local drafts completed.
2. Saved a real initial catch-up briefing and reviewed the small UI additions in the built client.
3. Verified people/roster links, public-source filtering and duplicate protection; reviewed the exact website diff and pushed.
4. Activated the approved research schedules and connected the existing editions/X recap to the shared archive. Daily collection produces evidence even when nothing is posted.

## Implementation and verification

- [x] Public identity ledger and shared display helpers, including explicit historical-card links.
- [x] Include public person and social citations in prepared evidence; preserve article immutability.
- [x] Incremental social archive with duplicate protection, per-account coverage status and restricted/public separation.
- [x] Reporter documentation and portable discoverable skill; internal roster research notes.
- [x] End-to-end sample briefing and public source cards; verify actual sources and identities.
- [x] Focused checks for cross-competition membership, restricted-source exclusion, missed-run recovery and duplicate publication.
- [x] Review exact diff, fetch/rebase safely, commit and push; configure authorized schedules through app tools.

Cartoon reply: inspect the actual X profile before attempting a send, because the user has already completed the upload.

## Verified implementation evidence

- Eleven verified people; sixteen separately keyed ARC-2/ARC-3 roster observations. Exact historical Hall of Fame mappings reuse existing public PNGs; unknown handles remain handles.
- Five public source posts and two private subscriber summaries ingested from the signed-in browser. Posting timestamps were read from the author’s own permalink, separating quoted-post timestamps. The initial collection is explicitly partial; the next scan fills coverage gaps.
- Private sample: `/Users/macmini/bubba-workspace/reports/arc-daily-social/briefings/2026-10-09-initial.md`. Public export contains neither subscriber post ID. Internal derived notes: `reports/arc-daily-social/people-notes.md`.
- Fresh integration preparation returned both boards ready and inserted source IDs for verified people, roster observations and relevant public posts. No manual preview edition was published.
- 14 Python checks and 21 news/SEO checks passed; client production build passed. Full repository type checking reports existing errors outside changed files (SnakeBench, Johan Land ingestion and legacy tests).
- Desktop front-page/profile and 390 px phone profile reviewed. The existing front-page stories, illustration, ads and archive remain; phone newspaper has no horizontal overflow. Preview screenshots saved under `reports/arc-daily-social/proofs/`.
- Bubba’s weekly skill was updated and validated in its workspace. Sunday 18:00 UTC, the event link, selected bullets and recurring Discord boundaries are preserved.

## Publication and scheduling

- Website implementation pushed to origin main as `2c7e7584`; scheduled reporting checkout confirmed clean on `codex/newsroom-publisher` with the correct origin. No deployment status check.
- App tool created `arc-daily-digest-research-desk` (05:00/11:00/17:00/23:00 Eastern) and `arc-daily-digest-personal-briefing` (05:30/17:30 Eastern). Both active, GPT-6 Sol.
- Existing morning edition, evening edition and 14:00 X recap updated through the app tool to consume the archive. Their times, model and existing publication/send scopes are preserved. Saved configuration verified read-only.
- Bubba weekly bridge committed locally as `9ad610b5`, only the skill, bridge plan and changelog. No external sends or OpenClaw configuration changes.
- The initial briefing has its own initial-delivery key so the scheduled evening briefing can include new 17:00 research.
