# ECHO//64: Time-Loop Puzzle Heist  NOT CHOSEN
**Authoring model:** GPT-5.2-Extra-High
**Date:** 2026-01-30

> **You don’t “solve” a room. You *rehearse* it—then bring the rehearsal with you.**

This document proposes a flagship, out-of-the-box game concept that leans into ARCEngine’s immovable constraints:
- Output is always a **64×64** frame using a **16-color palette**
- Gameplay is **turn-based**
- Each action may emit **1–N frames** (hard cap **1000 frames/action**)

---

## 1. Elevator Pitch

**ECHO//64** is a turn-based puzzle heist where you **record short runs**, then **loop the level** and play alongside your **past selves** (“echoes”) who automatically replay your recorded actions. You win by designing a *timeline* that makes impossible coordination feel inevitable: holding pressure plates while you slip through, pushing blocks in sync, timing lasers, and solving multi-step mechanisms—without ever leaving a 64×64 grid.

If ARCEngine is a tiny stage, **ECHO//64** turns it into a *time orchestra*.

---

## 2. Why This Fits ARCEngine (Without Bending Any Rules)

ARCEngine’s constraints aren’t a limitation here—they’re the genre.

- **Turn-based input** → perfect for deterministic “tick” simulation of multiple agents.
- **Multi-frame per action** → gives us cinematic micro-moments: rewind flashes, echo spawn shimmer, door slide animations (still under the 1000-frame cap).
- **Sprite transforms (rotate/mirror/scale)** → later levels can introduce “temporal tools” (rotate a key, downscale through vents, mirror a recorded path).
- **Collision modes (TANGIBLE/INTANGIBLE/INVISIBLE)** → we can create clean rules for echoes vs. player vs. hazards.
- **ACTION6 (click w/ x,y)** + **camera UI overlays** → timeline controls, tool selection, and level hints without breaking the 64×64 output.

---

## 3. The Player Fantasy

You’re not a character. You’re the **planner**.

Each loop is a rehearsal. Each echo is a specialist you trained—by being them once. The “aha” isn’t moving a block; it’s realizing **you can schedule yourself**.

---

## 4. Core Game Loop (30-Second Version)

1. Enter a room with an exit, mechanisms, and hazards.
2. Make a **short run** (e.g., 6–12 turns). Your inputs are recorded.
3. Trigger **LOOP** → time rewinds, an **echo** spawns, and it replays that run every loop.
4. Repeat, stacking echoes until the room becomes solvable through synchronized execution.
5. Escape.

The room doesn’t need randomization; it needs *timing*. The excitement comes from building a solution that plays itself.

---

## 5. Controls & Inputs (Engine-Native)

- `ACTION1–4`: Move (Up/Down/Left/Right)
- `ACTION5`: Context action (Loop / Interact / Wait—depending on the room)
- `ACTION6`: Click (timeline UI buttons; optional “place a marker” tools)
- `ACTION7`: Undo (high-value for puzzle iteration; implemented at the game level)

---

## 6. Pillars (Non-Negotiables)

1. **Deterministic choreography**: same inputs → same results.
2. **Readable 64×64 clarity**: every mechanic is legible at a glance.
3. **Short iteration loops**: solutions are discovered by trying, undoing, and looping—fast.

---

## 7. World Objects (Puzzle Vocabulary)

These are deliberately “simple shapes, deep interactions” objects:

### 7.1 Mechanisms
- **Pressure plates**: toggle doors/bridges while occupied.
- **Timed switches**: activate for N turns after being pressed.
- **One-way gates**: allow passage in one direction (prevents degenerate solutions).
- **Conveyors** (optional): move any sprite standing on them each tick.

### 7.2 Hazards
- **Lasers**: line hazards that toggle on/off by state or timer.
- **Cameras / sentries**: cone-of-vision detection; being “seen” resets the loop or fails the level.
- **Crushers**: periodic moving walls.

### 7.3 Tools / Pickups (Room-Specific)
- **Keycards**: open a door when held by *any* agent (player or echo).
- **Weights**: can be dragged onto plates.
- **Mirror/rotate tokens** (advanced): apply a transform to the *next recording* (a twist only ARCEngine makes cheap).

---

## 8. The Signature Mechanic: Echoes

### 8.1 Echo Spawn Rule
When the player triggers **LOOP**, we:
- rewind the room to its initial state,
- spawn a new echo at the start,
- bind it to the just-recorded action list.

### 8.2 Echo Playback Rule
Each turn:
- every echo executes its recorded step for that turn index (or waits if the recording is shorter),
- then the player acts,
- then the world updates mechanisms/hazards.

This ordering is tunable, but it must be consistent per game.

### 8.3 Collision Rule (Design Choice)
To keep puzzles clean and avoid “echo traffic jams”, we adopt:
- **Echoes collide with the world** (walls, doors, blocks).
- **Player does not collide with echoes** (you can pass through your ghosts).

Echoes still matter because they interact with plates/switches/hazards and push blocks (where enabled). This gives you cooperation without frustration.

---

## 9. What Makes This Feel Expensive (Even on 64×64)

### 9.1 The Timeline UI
Use the camera’s interface layer to reserve a thin strip (letterbox area) for:
- current loop number,
- run length indicator,
- “Loop now” / “Reset room” clickable buttons,
- per-echo icons (active/disabled).

This is where ACTION6 shines: the game becomes *plan-driven*, not just movement-driven.

### 9.2 Micro-Cinematics (Within the Frame Cap)
Each Loop action can emit a small multi-frame sequence:
- fade to palette color,
- spawn echo silhouettes,
- rewind “scanline” effect,
- snap back to start.

It’s a cheap way to make the game feel premium without breaking constraints.

---

## 10. Example Rooms (The “Oh, That’s Good” Moments)

### Room 1: The Two-Plate Door
- Door only opens when **two plates** are held simultaneously.
- First run: stand on plate A and LOOP at the right time.
- Second run: echo holds plate A while you reach plate B and exit.

### Room 4: The Laser Interleave
- Laser alternates on/off every turn.
- Echo is recorded to “trip” a switch on the safe beats while you cross.

### Room 7: The Block Sync
- A heavy block needs to be pushed two tiles in one “cycle”.
- Your echo pushes from one side on turn 3 while you push from the other on turn 3.

### Room 12: The Mirror Vault (Advanced)
- Your recording is mirrored left/right for a specific echo type.
- You solve a symmetric lock by recording a path that becomes its own counterpart.

---

## 11. Content Plan (How This Becomes a Real Game)

### Campaign
- **40–60 handcrafted rooms**, grouped into 5 “heist wings”
  - Training: plates + doors
  - Security: lasers + cameras
  - Logistics: blocks + conveyors
  - Paradox: transform tools (rotate/mirror/scale)
  - Master Vault: multi-mechanic orchestration

### Challenge Modes
- **Minimal loops**: solve in as few echoes as possible.
- **Speed choreography**: limit run length to 6 turns.
- **No-undo**: mastery runs for streamers.

---

## 12. Technical Notes (Reality Check)

This is entirely feasible in ARCEngine:
- Each agent (player/echo) is a `Sprite` tagged (e.g., `player`, `echo`).
- Record actions as a list of direction IDs per run.
- Use deterministic update order per tick.
- Use the UI interface layer for timeline buttons and indicators.
- Keep animation sequences small (e.g., 8–24 frames) per action to stay well under 1000 frames/action.

Nothing requires changing engine constraints—just leaning into them.

---

## 13. Roadmap (If You Fund It)

### Phase 1 — Prototype (1–2 weeks)
- 1 room, looping + echoes working, basic plate/door, basic UI strip.

### Phase 2 — Vertical Slice (3–5 weeks)
- 10 rooms, 3 mechanism types, polished Loop animation, Undo, room reset.

### Phase 3 — Content & Polish (6–10 weeks)
- Full campaign, difficulty curve, visual language pass, challenge modes.

---

## 14. Investment Pitch (The Part Where I Ask For The Check)

You want a game that showcases the engine’s uniqueness, not another maze reskin.

**ECHO//64** is:
- **distinctive** (time-loop co-op with yourself reads instantly in a GIF),
- **constraint-native** (64×64 + turn-based becomes the selling point),
- **content-scalable** (rooms are cheap to build once the mechanic exists),
- **sticky** (players chase “one fewer loop” solutions).

Fund this and we ship a flagship demo that makes ARCEngine look like it was built for something bigger than it is.

---

## Appendix: Other “Out-of-the-Box” Concepts Worth Prototyping

If you want a portfolio of wild bets, here are additional concepts that exploit ARCEngine features directly:

1. **Circuit Witchcraft** — click-to-place logic tiles; turn-based signal propagation opens/locks paths (ACTION6 + placeable areas).
2. **Gravifold** — rotate the entire room 90°; gravity reorients and everything “falls” each turn (rotation + deterministic physics-lite).
3. **Ink Budget** — you draw walls/bridges with clicks, but ink is scarce; puzzles are about minimal strokes (placeable + UI).
4. **Palette Heist** — steal colors from guards/objects; your palette state changes what’s visible and what collides (color remap + invisible blockers).
5. **Zoom Thief** — shrink to enter vents, grow to shove machinery; the *same room* plays differently at different scales (scale + collision).
6. **Train Mini-Dispatcher** — schedule trains on a 16×16 track map; click switches, avoid collisions, deliver cargo on time (multi-sprite ticks).
7. **The Folding Map** — the room folds like paper; edges glue together temporarily, changing adjacency (world manipulation + camera tricks).
8. **Glyphsmith** — assemble spells by merging rune fragments into exact silhouettes; cast spells that become level geometry (merge + pixel compare).
