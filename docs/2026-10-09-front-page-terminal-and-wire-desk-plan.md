# The ARC Daily Digest: a dense front page, a wire desk and edition posts

Author: Claude Opus 5.5 · 9 October 2026 · requested by the Boss

## What the Boss asked for

- Post every new edition to X, saying "early edition" (6 am) or "late edition" (6 pm). No paid
  X API: Codex drives the signed-in browser, as the 2 pm recap already does.
- Use the leaderboard data on the front page: who is jumping up, who is new, who sits on the
  medal lines. Make the paper the place people check during the last month of the contest.
- Think like a newspaper editor: information-dense, like a financial terminal or a sports page.
  No wasted space, no startup landing-page look. "Explore the contests" (six tall cards) and
  "The people behind the puzzles" (a dark band with a slogan) go.
- Write the data into readable articles, the way financial journalism does: tables from the
  tape, short wire stories on the moves, analysis in the editions.
- Small, cheap models write those stories: GPT-6 Luna through Codex, as the paper's reporters,
  working with our pictures, people records and notebook.

## Decisions

1. **Live data is code; prose is the reporters'.** A compact market digest for both boards is
   computed on the server (`shared/newsMarkets.ts`, `GET /api/news/markets`) from the saved
   board documents: medal lines now and a day earlier, the leader and the margin, field size,
   the top of the table, the past day's gainers, climbers, newcomers, gold-line changes and the
   teams on the bubble, plus rows for every notebook and ledger team. Single-digit kilobytes
   instead of the 600 KB the full boards cost, so the front page stays quick.
   It is a new narrow module, not a move of `storyData.ts`, which three pages and a test use.
2. **Unknown stays unknown.** A team's earlier rank or score is used only when the saved history
   supports it (top-300 trails without a possible gap, or the top-500 score-change feed);
   otherwise the cell is blank. The same rule the editions follow.
3. **The wire desk.** A Codex automation running GPT-6 Luna writes one to three short sourced
   stories a few times a day from a prepared brief (`scripts/newsroom_wire.py prepare`). The
   brief offers leads (moves, newcomers, the gold line, verified people on moving teams, public
   posts), their sources and the pictures we own for them. `validate` rejects any figure in the
   prose that is not in the brief, any source or team not offered and any picture not offered.
   Stories are immutable files under `content/news/wire/` with evidence beside them.
   GPT-6 Sol keeps the two editions.
4. **Front page as a broadsheet.** Nameplate with ears (edition and countdown on the left, the
   sponsor on the right), a terminal-style ticker of both boards, then three columns: What's
   News (wire stories and edition summaries), the lead edition run in full with the ARC-AGI-2
   edition under it, and the board in agate type. Below: market movers, where the past winners
   stand now (faces and honors from the ledger, current rank from the digest), around the
   contests, an index of the rest of the site, a compact notebook and the archive. Georgia for
   prose, monospace for figures, hairline rules instead of cards. No new web fonts.
5. **Edition posts.** `scripts/newsroom_x.py edition` drafts the post from the published
   editions ("Early edition" or "Late edition", both headlines when they fit, the lead article
   link) and waits until that link opens. The edition runs post it once through the signed-in
   browser with the 2 pm job's outbox and send-once rules. The site labels editions Early and
   Late too; the data keeps `morning` and `evening`.
6. **Failure stays contained.** If the digest is unavailable the market sections render nothing
   and the editions still lead. The crawler HTML for `/news` keeps describing the real page.

## Steps

- [x] Digest module, endpoint and fixture tests.
- [x] Front page and stylesheet; crawler copy.
- [x] Wire desk: contract (TS and Python), `newsroom_wire.py`, wire page, tests, `WIRE_DESK.md`.
- [x] Edition posts: helper, tests, `X_POSTING.md`.
- [x] Early/Late labels (share-card design version bump), method copy, REPORTER desk note,
      VISUALS, AGENTS, CHANGELOG.
- [ ] Push, then set up the GPT-6 Luna automation and the edition-post step in the two edition
      automations.
