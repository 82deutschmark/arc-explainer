<!--
Author: Claude Opus 5
Date: 06-September-2026
PURPOSE: Plan for the arc3.markbarney.net landing-page pass — retire the three claims that
         are already false or go stale on contact (poster-as-confirmed, hard-coded
         leaderboard placing, and the "models mostly cannot" hero argument that GPT-6
         Astra overturned on 02-Sep-2026), replace the placing with a live Kaggle-fed
         standing, and rebuild the page's central argument on claims that survive the next
         frontier release. Records the verified source numbers and their provenance so the
         implementation does not have to re-derive them.
SRP/DRY check: Pass — reuses the existing Mac Mini Kaggle job (authenticated + already
         scheduled) rather than adding Kaggle auth to Railway; reuses BaseRepository/
         DatabaseSchema auto-create; reuses the landing page's own ARC palette. No new
         doc duplicates docs/2026-09-02-kaggle-leaderboard-monitoring.md, which stays the
         portable how-to; this is the site-integration plan.
-->

# arc3 landing page — a page that does not go stale

Target: `client/src/pages/arc3-community/SyntheticLanding.tsx` (519 lines), served at the
root of `arc3.markbarney.net`.

## 1. What is actually wrong

Three problems, in descending order of severity.

### 1.1 The hero argument is now false — not stale, false

The page's H1 and second paragraph assert the gap:

> Easy for you. Very hard for the best AI in the world.
> … On the official ARC-AGI-3 environments a person gets through the set and the frontier
> models get through almost none of it — a gap of nearly the whole benchmark, not a few
> points.

On **02-Sep-2026** ARC Prize published GPT-6 Astra's results. On the **ARC-AGI-3
semi-private set** — the same set the page's footnote cites 0.50% from — Astra scored
**99.9%**. The gap the whole page is built on is gone, and it closed four days before this
plan was written.

The file's own comments show the authors already fought this battle twice (an earlier draft
said models "score zero"; the next welded 0.50% into the H1). The lesson was recorded as
"assert the GAP, not the number". Astra shows the gap was itself a number in disguise — a
quantity that moves — and it moved.

The deeper fault is that the page was making a sweeping claim about AI at all. See §4: it
never needed one, and every version of that claim has expired within weeks. The fix is not a
better thesis, it is no thesis.

### 1.2 The leaderboard placing is hard-coded and wrong

```
On the ARC Prize 2026 competition leaderboard we are currently fifth.
```

Live state, `~/bubba-workspace/state/arc-prize-2026-arc-agi-3-leaderboard.json`, captured
2026-09-06T10:00Z: **rank 9**, score 4.84, field 2,831 teams. The adjacent sentence — "Tufa
Labs are fourth — one place ahead of us" — is now wrong twice over: Tufa Labs are not in the
top 10 at all on that capture.

### 1.3 The poster is presented as settled

```
We are also taking a poster to the ARC Prize Research Summit in Boston.
```

Not confirmed. The Luma page states registration "is subject to host approval" and mentions
no poster session at all; it gives the venue as **MIT, 77 Massachusetts Ave, Cambridge MA**.

**Decision (user, 06-Sep-2026): cut the sentence entirely** until something is confirmed.
Nothing conditional, nothing to go stale. The section keeps the leaderboard standing and the
Discord invite.

Separately — worth the user knowing, not for the page: a Bubba news digest from 28-Aug-2026
records the Summit as **23-Oct-2026** with **speaking applications closing 14-Sep-2026**.
That is eight days out. Unverified against the official source; flagged, not acted on.

## 2. Verified source material

Everything below was read off a live source on 06-Sep-2026. Nothing is illustrative.

### 2.1 GPT-6 Astra — `https://arcprize.org/results/openai-gpt-6-astra`

Published **02-Sep-2026**. 12 harness configurations = 2 harnesses × 6 reasoning tiers
(Max, XHigh, High, Medium, Low, None).

| Set | Harness | Best score | Cost |
|---|---|---|---|
| ARC-AGI-3 semi-private | Standard | 62.7% (max reasoning) | $26,098 |
| ARC-AGI-3 semi-private | Provider Adapter | **99.9%** (high reasoning) | $18,817 |
| ARC-AGI-2 | — | 95.0% (max reasoning) | — |
| ARC-AGI-1 | — | 98.5% (xhigh/high) | — |

The page does not state whether the dollar figures are per-set or per-task. **Do not assert
either.** Cite as published.

The two harnesses, in ARC Prize's own words:

- **Standard** — "enables a model to carry forward notes it chooses to keep with it
  throughout the environment."
- **Provider Adapter** — "preserves opaque reasoning state between requests and uses
  compaction for longer conversations, allowing the model to reuse prior work."

ARC Prize offers **no interpretive commentary** on the harness gap. Any reading of what it
means is ours and must be voiced as ours.

### 2.2 The per-environment breakdown — the durable finding

Derived from ARC Prize's published public-demo table, already extracted by Bubba to
`~/bubba-workspace/docs/astra-analysis/astra_v3_gaps.json` (25 environments × 12
configurations, **300 replay URLs**). Re-verified numerically for this plan:

- Provider Adapter reaches **1.00 on all 25** environments.
- Standard harness best is **below 1.00 on 14 of 25**.
- Worst three for the standard harness, *best across all six reasoning tiers*:
  **BP35 2.2%**, **G50T 3.0%**, **TU93 6.7%** — all three at 100% under the Provider Adapter.
- The Provider Adapter solves at **all six** reasoning tiers on 23 of 25 (exceptions: SK48,
  TN36).

The claim this supports, which is **structural and therefore durable**:

> On BP35, no amount of reasoning got the standard harness above 2.2%. Same model, same
> weights — change only how its own state is carried between requests, and it solves the
> environment. What was missing was not intelligence. It was memory.

That is a fact about the benchmark's shape, not a score, so the next release does not
falsify it. And 300 public replays make it checkable.

**Implementation caveat.** `base` = max(scores[0:6]) and `pa` = max(scores[6:12]) are
verified self-consistent, which establishes the standard/adapter split. The ordering
*within* each block of six (Max→None or None→Max) is **not** verified. Only make
order-independent claims ("across all six reasoning settings, never above 2.2%") unless the
ordering is confirmed against the live page first. An earlier draft of this plan asserted
"the adapter solves it even with reasoning off" — that was wrong and was caught by checking.

### 2.3 Kaggle standing

Competition `arc-prize-2026-arc-agi-3`, deadline 2026-11-02. Team "Son Pham & Mark Barney",
tracked by username `sonphamorg` (usernames are stable across team renames; team names are
not).

Mode B overwrites a single state file daily and no snapshot archive was ever kept for this
competition (the 6-hourly archiver LaunchAgent tracks `kaggriculture`, a different
competition). So there is no *structured* history.

**But a backfill from the Discord digests succeeded.** The daily digest is posted to
`#arc-3` by an OpenClaw cron job, and those runs are recorded in
`~/.openclaw/agents/main/sessions/*.jsonl`. Parsing the digest blocks out of them recovers
real, dated placings:

| Date | Rank | Field | Team name at the time | Source |
|---|---|---|---|---|
| 16-Aug-2026 (morning) | 43 | 2,342 | Logical Arbitrage | Discord digest |
| 16-Aug-2026 16:25 ET | **5** | 2,349 | Logical Arbitrage | Discord digest |
| 02-Sep-2026 | **4** | 2,708 | Son Pham & Mark Barney | state-file excerpt in `docs/2026-09-02-kaggle-leaderboard-monitoring.md` |
| 06-Sep-2026 | 9 | 2,831 | Son Pham & Mark Barney | live state file |

**Peak = 4th, 02-Sep-2026.** The page's "fifth" was real too — it was the 16-Aug figure,
just never updated.

Note the rename (**Logical Arbitrage → Son Pham & Mark Barney**), which is exactly the trap
`docs/2026-09-02-kaggle-leaderboard-monitoring.md` warns about: match on `TeamId` or member
username, never on team name. The backfill only works because `sonphamorg` is stable.

These four rows are seeded with `source='backfill'` and a provenance comment. Everything
after 06-Sep-2026 is observed.

## 3. Architecture — the Mac Mini pushes, the site never calls Kaggle

**Rejected: server-side pull from Railway.** Kaggle CLI 2.2.2 uses an OAuth token that
expires and needs a human at a browser to renew (`kaggle auth login --force`). On an
ephemeral Railway dyno that is a page that silently dies and keeps showing a months-old
rank — precisely the failure this whole exercise exists to prevent. Our own
`docs/2026-09-02-kaggle-leaderboard-monitoring.md` reaches the same conclusion for scheduled
jobs.

**Rejected: client-side fetch.** Kaggle publishes no unauthenticated leaderboard endpoint,
and browser CORS forbids it regardless.

**Chosen: push.** The Mac Mini already fetches this board daily, authenticated, on a
schedule that works. Add one small step that POSTs the result to us.

```
OpenClaw daily cron (06:00 ET)
  └─ kaggriculture_leaderboard.py --competition arc-prize-2026-arc-agi-3 …
       ├─ prints the Discord digest              (unchanged)
       ├─ writes ~/bubba-workspace/state/…json   (unchanged)
       └─ NEW: POST /api/kaggle/standing  (x-api-key)   ← added, non-fatal on failure
                    │
                    ▼
          kaggle_leaderboard_snapshots  (Postgres, auto-created)
                    │
                    ▼
          GET /api/kaggle/arc-agi-3/standing  (public, cached)
                    │
                    ▼
          <KaggleStanding /> on the landing page
```

**Why Postgres and not the `/app/data` volume.** Peak rank requires accumulating history,
which is a query (`MIN(rank)`), not a value. The repo already has a Postgres pool via
`BaseRepository` (`DATABASE_URL`), 19 auto-creating tables in `DatabaseSchema.ts`, and
CLAUDE.md forbids direct DB queries outside the repository pattern. A JSON blob on the
volume would need its own history format and its own append logic, and the volume shadows
repo-tracked files at `/app/data` — a known footgun already documented in
`Arc3MirrorCatalog.ts:107`.

**The push must be non-fatal to the digest.** The Discord digest is the job's primary
product and must not start failing because our site is redeploying. Wrap the POST so a
failure logs loudly and exits the *push* non-zero without taking the digest with it.

### 3.1 Staleness is the whole design

The point of this work is a page that does not lie. So:

- The GET **always** returns `capturedAt`. There is no shape of this response that carries a
  rank without a date.
- The component **never renders a rank without its date beside it.**
- Past **48 hours** (the job is daily; 48h tolerates one missed run) the component stops
  asserting a current rank entirely and falls back to peak-with-date. History does not go
  stale; a present-tense claim does.
- If there is no data at all, the section renders the durable prose alone. The page must be
  complete and honest with the endpoint returning 404.
- `staleTime` ~5 min, matching the file's existing queries. **No `refetchInterval`** — the
  upstream moves once a day and a live-ticking number would imply a freshness we do not have.

### 3.2 Honest framing of the rank itself

Per `docs/2026-09-02-kaggle-leaderboard-monitoring.md`: medals are awarded on the **private**
leaderboard at close. A public-board position is not a medal and not a result. The copy says
**"public leaderboard"** every time, or it is the same species of overclaim as the poster
line being fixed.

## 4. The framing — hobbyists at a bench, not a thesis about AI

**Corrected 06-Sep-2026 after user review.** A first draft of this plan proposed a
grand replacement argument ("A machine finally did it. Look at what it took."). That was
wrong in kind, not just in wording. The user's steer, verbatim:

> "You're not really getting it. It's not really a hero argument. We're hobbyists working
> on harness engineering and stuff, basically."

The page is not making a case about machine intelligence. It is two people describing what
they are working on and asking for help with the part they cannot do alone. Every sweeping
claim on the current page — including the one Astra falsified — exists because the page was
reaching for a thesis it never needed.

### 4.1 The register already exists, in the user's own words

From a message to Bubba, 05-Sep-2026, asking whether it worked as copy for this site:

> Two guys. No company. No funding. Top ten on the ARC-AGI-3 leaderboard, against actual
> labs with actual money.
>
> We build games that are easy for a human and absolute hell for an AI. We have a lot of
> them now. Some of them are genuinely good. A lot of them are garbage. Formulaic, ugly,
> unfair, occasionally just broken. We know. That's why we're asking.
>
> Come play them. Then roast us.

That is the voice: plain, specific, self-deprecating, no thesis. It also relocates the ask.
The old page asked for a *human baseline* — a research abstraction. This asks people to
**tell us which of our games are garbage**, which is a real thing a real person can do in
five minutes, and the feedback box is the point rather than a footnote.

Note that Bubba's own critique of that draft (same session) is the principle this whole
plan runs on:

> "I can't verify that number and it's the one claim a hostile reader will check first. If
> it ain't exactly right, the whole page reads as hype."

The claim he meant was "top ten on the ARC-AGI-3 leaderboard" — which is precisely what the
live standing component in §3 exists to keep honest.

### 4.2 Spine

1. **Who we are.** Two people, spare time, no lab, no funding — and a real position on a
   public leaderboard against funded teams. Live, dated, and never asserted from memory.
2. **What we work on.** Harness engineering: the scaffolding around a model rather than the
   model. Stated as our hobby, not as a discovery.
3. **Why that turns out to matter** — Astra, presented as the most striking recent example
   from our own field of interest, not as a statement about AI. Same model, same weights:
   on BP35 the standard harness never clears 2.2% at any reasoning setting, and the
   provider-adapter path solves it. What was missing was not intelligence, it was memory.
   Ours to voice as *our reading* — ARC Prize publishes no interpretation of the gap.
4. **What we need.** We made a lot of games. Some are good, plenty are garbage, and we
   cannot tell which from the inside. Play one, then tell us it was boring. That is the ask,
   and it is the one thing on the page that no frontier release can invalidate.

Astra belongs at (3) because harness engineering is literally what these two do — it is bench
news, not a civilisational claim. That framing is also why it cannot go stale: it is an
anecdote about a dated result in a field we work in, not the page's load-bearing argument.

**Durability rules to encode in the file's comments**, extending the convention already
there:

- No frontier score in body prose. Numbers live in one dated, cited block.
- Every number renders with its date and source adjacent.
- No claim the page cannot check. If a hostile reader would look it up, it is either live
  and dated, or it is cut.
- The ask is about our own tasks, which only our own visitors can settle.

## 5. The glow-up

One chart, and it earns its place by being the thing these two actually find interesting:
**standard harness vs Provider Adapter across all 25 public-demo environments**, sorted by
gap. Fourteen bars show a visible gap; three are near-total. Inline SVG in the page's
existing palette — no chart library, no new dependency. Static data from a dated report, so
it cannot go stale, and each environment links its replays for anyone who wants to check.

Framed as bench material — "this is the sort of thing we stare at" — not as an argument the
page is prosecuting. Consistent with §4: no thesis.

Everything else is restraint: keep the ARC palette, the MONO/SANS split, the tile treatment.
No shadcn card here — it would clash with the deliberate design this page already has.

The second visual change is subtraction. The current page carries three paragraphs of
argument that §4 removes; the reclaimed space goes to the tiles and the ask, which is what a
visitor is actually there for.

## 6. Work items

| # | File | Change |
|---|---|---|
| 1 | `server/repositories/database/DatabaseSchema.ts` | Add `kaggle_leaderboard_snapshots` to auto-create |
| 2 | `server/repositories/KaggleStandingRepository.ts` | **New.** Insert snapshot; read latest + peak. Extends `BaseRepository` |
| 3 | `server/routes/kaggle.ts` | **New.** `POST /api/kaggle/standing` (api-key), `GET /api/kaggle/:competition/standing` (public) |
| 4 | `server/routes/index` + `server/index.ts` | Mount the router |
| 5 | `shared/types.ts` | `KaggleStanding` shared between client and server |
| 6 | `client/src/components/arc3/KaggleStanding.tsx` | **New.** Rank + peak + date, staleness fallback, skeleton, silent-empty |
| 7 | `client/src/components/arc3/HarnessGapChart.tsx` | **New.** Inline-SVG chart from a checked-in dated extract |
| 8 | `client/src/data/astraHarnessGap.ts` | **New.** The 25-environment extract, with provenance header |
| 9 | `client/src/pages/arc3-community/SyntheticLanding.tsx` | Hero rewrite, Astra section, poster line, placing → component |
| 10 | `~/bubba-workspace/tools/kaggriculture_leaderboard.py` | Add optional `--push-url` / `--push-key`; non-fatal |
| 11 | OpenClaw cron job | Add the two flags to the ARC-3 daily |
| 12 | `CHANGELOG.md` | SemVer entry at top |

Items 10–11 are **outside this repo**, on the Mac Mini. They are the half that makes the
data flow, and the site degrades gracefully until they land — so 1–9 can ship first.

## 7. Verification

- `npm run test`, `npm run build`.
- Drive the dev server through the Browser pane (`preview_start`, `dev` config) — never a
  bare shell, per CLAUDE.md.
- Exercise all four standing states: fresh, stale >48h, no data, endpoint 500. The page must
  read correctly in every one.
- POST a snapshot by hand, confirm it renders; POST an older one, confirm peak does not
  regress.
- Screenshot the result for the user.

## 8. Decisions taken (user, 06-Sep-2026)

1. **Framing** — not a hero argument. Hobbyists doing harness engineering. See §4, rewritten
   after the user rejected the first draft's framing.
2. **Peak rank** — seed, and backfill from Discord. Backfill **succeeded**; four dated rows
   recovered, peak = 4th on 02-Sep-2026. See §2.3.
3. **Summit** — cut the sentence entirely. See §1.3. (Separate FYI recorded there: Summit
   reported as 23-Oct, speaking applications close 14-Sep.)

## 9. Still open

- **Tone calibration.** §4.1 takes the user's own 05-Sep draft as the register. Worth one
  check that the finished prose lands there, since "roast us" is a sharper voice than the
  page has today and the whole page shifts to match it.
- **How far the leaderboard component goes.** Minimum is rank + peak + date. It could also
  carry the field size, the gap to the leader, and movement since the last capture — all of
  which the digest already computes and the snapshot table would hold. Proposed: ship the
  minimum, keep the table wide enough to add the rest without a migration.
