# ARC Daily Digest: Claude Code fallback plan

Author: Claude Sonnet 5.5 Low; gaps 10-11 and the Step 3 writer-list note added by Claude Opus 5.5 Max after the pipeline sanity check
Date: 2026-10-14
PURPOSE: Records how the ARC Daily Digest is automated today, what fallback already exists on Claude Code, where it falls short, and what to do about it. Planning only; nothing here has been built or changed.
SRP/DRY check: Pass. This reuses the existing backup desk (`docs/newsroom/FALLBACK.md`, `scripts/newsroom_fallback.sh`) rather than proposing a second one.

## 1. How the Digest runs today

Codex automations in the ChatGPT app write the whole paper. The definitions live in `~/.codex/automations/<id>/automation.toml`. Changes go through GPT-6, never by hand-editing.

| Job | Model | Schedule (ET) | Status |
|---|---|---|---|
| Morning edition (early) | GPT-6.1 Sol | 6 am daily | active |
| Evening edition (late) | GPT-6.1 Sol | 6 pm daily | active |
| Wire desk | GPT-6 Luna | every 2 hours, on the even hour | active |
| Research desk | GPT-6.1 Sol | hourly | active |
| Personal briefing | GPT-6.1 Sol | 5:30 am, 5:30 pm | active |
| Daily X recap | GPT-6.1 Sol | 2 pm | active |
| Midnight bridge desk, October 13 preflight | n/a | one-shot | paused |

Editions run in `arc-explainer-newsroom`, the wire in `arc-explainer-wire`. Workflow docs: `docs/newsroom/REPORTER.md`, `WIRE_DESK.md`, `SOCIAL_DESK.md`, `ART_DESK.md`, `X_POSTING.md`. Helpers: `scripts/newsroom.py`, `newsroom_wire.py`, `newsroom_x.py`, and the social, people and artwork helpers.

## 2. A Claude Code fallback already exists

Set up 10 October 2026. A launchd agent (`com.arcdaily.fallback`) runs `scripts/newsroom_fallback.sh` from its own checkout, `arc-explainer-fallback`, on branch `claude/newsroom-fallback`.

- 6:50 am and 6:50 pm: if today's edition is not on main and no Codex run is in progress, it runs Claude Haiku 5.5 headless.
- 9:40 am, 12:40 pm, 3:40 pm, 9:40 pm: wire backup, only if Codex reports it is signed out.
- It uses the Claude Code subscription sign-in with every API key variable unset, so it cannot bill the paid API.
- Logs: `~/Library/Logs/arc-daily-fallback/`. The workflow and its differences from the Codex path are in `docs/newsroom/FALLBACK.md`.

Checked today: the detection runs on schedule and correctly stands down when Codex delivers. The Claude run itself has never fired for real, because Codex has delivered every time. So the part that matters is untested.

## 3. Gaps

1. **Never rehearsed.** The headless Claude run has no log of ever completing. It may fail on permissions, a stale checkout, or a docs mismatch, and nobody would know until the night it is needed.
2. **Only covers two things.** Editions and the wire. The research desk, personal briefing and 2 pm X recap have no backup.
3. **Weak trigger for editions.** It only notices a completely missing edition, an hour or so late. A half-finished run (published but with broken art, missing second contest, no X draft) is treated as delivered.
4. **Weak trigger for the wire.** It only steps in when Codex is signed out. A Codex outage with a valid sign-in (quota, app crashed, Mac asleep) is not covered.
5. **Model is Haiku only.** Fine as a safety net; thin for a front page the Boss wants people to check daily. (Resolved: moving to Sonnet 5.5.)
6. **No browser.** No X posting, social scan, Kaggle browsing or people portraits. Posts are only drafted.
7. **Single point of failure.** Both desks live on the same Mac Mini. If it is asleep, off or offline, neither runs.
8. **Docs drift.** The fallback checkout falls behind main; the script fast-forwards it, but FALLBACK.md can go stale as REPORTER.md changes.
9. **Silent failure.** Only a Mac notification, which nobody sees if the Boss is away.
10. **Contradicts the picture rule** (found in the sanity check, `docs/2026-10-14-arc-daily-pipeline-sanity-check.md`). Every front page now needs an illustration, but FALLBACK.md says skip browser work and Claude Code has no image tool. The backup can reuse an approved scene through `scripts/newsroom_artwork.py`; FALLBACK.md must say so, and say what to do when none fits.
11. **Locks itself out.** The runner stops on a dirty folder, so one half-finished backup run disables every later one until someone cleans it by hand.

## 4. Plan

**Step 1: Rehearse it.** Run the fallback by hand against a throwaway day in a safe mode (no push) for the morning, the evening and one wire shift. Fix whatever breaks. This is the single most valuable step.

**Step 2: Make the trigger honest.** Judge an edition "delivered" by what the site needs (both contests, art present, valid data), not just file existence. Add a wire check on "no wire story or heartbeat for several hours while Codex shows no run", not only signed-out.

**Step 3: Model (decided).** Claude Sonnet 5.5 for every fallback job. Replace Haiku in the fallback script and FALLBACK.md, and credit Sonnet 5.5 as the writer on published stories. This needs the allowed-writer list changed everywhere it lives, in one change: `scripts/newsroom.py`, `scripts/newsroom_wire.py` and `shared/news.ts` (edition list, wire list and byline credits). Changing only the Python side would let a Sonnet edition publish and then take the site's news pages down; better still, make it one shared list first (sanity check finding 2).

**Step 4: Extend coverage by priority.** Edition first (done), then the 2 pm X recap and personal briefing as drafts, then the research desk. Skip anything that needs a browser; those stay drafts for the Boss.

**Step 5: Loud failure.** Send a message the Boss will actually see (Discord to Bubba, the same channel as his other notes) when the fallback steps in, finishes, or fails.

**Step 6: Manual switch.** One documented way for the Boss to say "Codex is down, run Claude now" for any job, and one way to hand back to Codex afterwards, so the two never both publish.

**Step 7: Keep docs in step.** When REPORTER.md or WIRE_DESK.md change, FALLBACK.md gets a one-line check in the same change. Add this to the newsroom change checklist.

## 5. Rules that must hold

- Never publish a second copy of an edition.
- Never use a paid API key; subscription sign-in only.
- Never force-push; stage only the intended `content/news/` files.
- Every figure comes from the brief; unknowns stay unknown.
- Change Codex automations only by asking GPT-6, never by hand.
- Credit the writing model by name and effort level on anything it publishes.

## 6. Decision for the Boss

Decided by the Boss on 14 October 2026: the fallback uses Claude Sonnet 5.5 for everything (editions, wire and drafts). This replaces the earlier idea of Haiku for the wire and a stronger model for editions. Record it in FALLBACK.md and the fallback script when built.
