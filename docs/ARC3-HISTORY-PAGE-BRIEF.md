# ARC3 History Page — Design Brief

**Author:** Bubba (Claude Sonnet 4.6)
**Date:** 27-March-2026
**Branch:** arc3
**For:** Developer working on arc-explainer's ARC3 history/explainer page
**Purpose:** Capture the actual timeline, what we had when, and the editorial direction for the new history page — so you can build it without having to dig through the git log yourself.

---

## What This Page Is For

The site's original value proposition was: *plain-language explanation of what ARC-AGI is and why it matters, aimed at smart non-technical people.* That got lost when the community playground took over. This page is about getting back to that.

The route currently living at `/arc3/archive/games` — the games browser with spoiler pages, screenshots, and per-game analysis — is the closest thing we have to the old experience. That should become the foundation of the history page, but it needs to be:
- Stripped of the vibe-coded slop aesthetic
- Clearly dated and framed as historical ("this is what the competition looked like when...")
- Honest about the fact that the games themselves have changed — screenshots from late 2025 don't match the current ARCEngine versions

---

## The Actual Timeline (Research-Backed — Fill In Gaps Before Building)

**Important caveat:** My knowledge here is imperfect. Verify dates against arcprize.org announcements and the repo git log before hardcoding anything into UI copy.

### July–August 2025 — Preview Competition Launched
- The ARC-AGI-3 preview competition ran in **late July and early August 2025** — this is when the arc-explainer repo first started tracking ARC3 content (earliest relevant commits are dated July 26, 2025)
- At launch, a small set of games was available — the repo's `docs/arc3-game-analysis/` directory contains analysis docs for exactly **6 games**: `as66`, `ft09`, `lp85`, `ls20` (Locksmith), `sp80`, and `vc33`
- These were the preview games. The site had per-game spoiler pages with mechanic breakdowns written in plain language — this was the high-value content

### Late 2025 — Pared Down to 3 Games
- At some point during the preview period, the public-facing game set was reduced. The archive landing page references "the 6 official preview games" but the current `environment_files/` in arc-agi-3 shows that `as66` and `sp80` were later treated differently (they're referenced as "hidden" in the prod config). Verify exactly when and why the set changed.
- The repo shows Jan 2026 commits specifically skipping `sp80` and `as66` in the landing page replay rotation — these two became known as problematic/unplayable at some point

### Mid-March 2026 — Full ARCEngine Released
- **~March 12, 2026**: The full ARC Prize game engine (ARCEngine) was released publicly. This is the milestone that changed everything — from a small preview set to 40+ games, all playable via Pyodide in the browser
- The complete game list as of March 2026: `ab, ac, ar, ar25, bp35, cd82, cn04, cr, dc22, fd, fr, ft09, fy, g50t, gh, ka59, lb, lf52, lp85, ls20, m0r0, mr, mw, pc, pi, pt, px, r11l, re86, s5i5, sb26, sc25, sh, sk48, sn, sp80, su15, td, tn36, tr87, ts, tu93, vc33, wa30, ws03, ws04`
- The Observatory games (ws03/ws04 = World Shifter variants, px = Potion Mixer, sn = Sneeze) are Son Pham's additions to the platform — not ARC Prize Foundation games

---

## What the Page Should Actually Say

The editorial frame is: **"We've been watching this since the beginning. Here's what we learned."**

Structure suggestion:

### 1. What Is ARC-AGI-3? (One short section, no jargon)
- It's not like previous ARC tests. ARC-AGI-1 and -2 were pattern-matching on a grid with examples. ARC-AGI-3 is interactive — you're *playing a game* with no instructions, and you have to figure out the rules, the controls, and the goal just by experimenting.
- The 64×64 pixel grid with 16 colors is the entire interface. No text. No tutorial. No hints.
- The question ARC Prize is asking: can an AI figure out a new game the way a person would — by trying things, noticing what happens, and adapting?

### 2. The Preview Period (July–August 2025)
- Six games were released for a preview competition
- Describe each of the 6 briefly — what was the mechanic, what made it hard
- This is where the existing per-game analysis docs live (`docs/arc3-game-analysis/*.md`) — they have real content, use them
- Note: the games have since been updated. Screenshots from this period may not match current versions.

### 3. The Reduction (Late 2025)
- Fill in what actually happened here — when, which games remained, why

### 4. Full Release (March 2026)
- ARCEngine goes public. 40+ games. Community can submit their own games.
- Son Pham builds arc3.sonpham.net — the reference harness for playing and running agents
- What this means: the "benchmark" is now wide open, the question is whether AI can generalize across a diverse set of novel games

### 5. What We're Watching Now
- Brief, honest summary of where things stand for AI performance
- Link to arc3.sonpham.net for live play

---

## On the Current `/arc3/archive/games` Page

This is the starting point, not the destination. What's there:
- Games browser with the 6 preview games
- Per-game spoiler pages with level screenshots and mechanic notes
- Existing analysis docs in `docs/arc3-game-analysis/` — these are actually good content

What needs to change:
- **Strip the vibe-coded UI** — whatever generic card grid / pill button aesthetic is there now, replace it with something that feels intentional and editorial. Dense information, clear hierarchy, no random gradients.
- **Add a clear historical framing** — a timestamp banner or header saying "This content documents ARC-AGI-3 as it existed during the preview period (July–August 2025). The games have since been updated."
- **Be honest about the screenshots** — note that the game visuals/mechanics have been updated since the screenshots were taken

---

## What NOT to Do

- Don't reproduce Son Pham's site. He has the harness. We have the explainer.
- Don't build an interactive game player on this page — link to arc3.sonpham.net for that
- Don't use the archive banner component that says "archived content from the ARC3 preview period (2025)" in a generic dismissable way — the historical framing should be structural, not a toast
- Don't ship this page without verifying the exact dates of the preview competition and the reduction — I've given you my best reconstruction from the git log but dates need to be confirmed against primary sources (arcprize.org announcements)

---

## Files Worth Reading Before You Build

- `docs/arc3-game-analysis/ls20-analysis.md` — example of the detailed per-game content we had
- `docs/arc3-game-analysis/ft09-analysis.md`, `vc33-analysis.md`, etc. — same
- `client/src/pages/arc3-archive/Arc3ArchiveLanding.tsx` — current archive landing (the starting point to redesign)
- `client/src/pages/Arc3GameSpoiler.tsx` — per-game spoiler page (keep, but restyle)
- `client/src/pages/Arc3GamesBrowser.tsx` — games browser (keep, redesign)
- `Mark's Coding Standards.md` — follow these, file headers required on every file you touch
