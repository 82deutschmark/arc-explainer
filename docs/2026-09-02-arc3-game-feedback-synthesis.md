<!--
Author: Claude Opus 5 (Bubba sub-agent, label arc3-feedback-synthesis)
Date: 02-September-2026
PURPOSE: Every piece of recorded player feedback on the ARC-3 tasks, in one place and in
plain English. Pulls the write-only feedback notes out of the database (they are never
returned by any endpoint, so nobody can read them from the site), sets them beside the
Boss's direction from 02-Sep, and turns both into a ranked list of things to do next.
A notes document for a human to action, not a build report.
SRP/DRY check: Pass — no existing doc collects the player feedback. The junk-game audit
covers the generated catalog's defects; this covers what people said while playing.
-->

# What players actually said about the ARC-3 games

**Read this first.** This is a small sample. There are 36 feedback responses total,
covering two evenings of hand-play on 01-Sep and 02-Sep. The site mints a fresh session id
every time someone opens a task, so we genuinely cannot count how many different people
this is. Judging by the timing and the voice of the notes, it is one or two testers — most
of it the Boss. Treat everything below as a careful read of a few play sessions, not as
survey data.

The other thing to know up front: the 36 responses cover **two different sets of games**,
and the verdicts on them are opposites. Do not average them together.

- **The 50 authored tasks** (ids starting `t`) — 15 responses. These are going well.
- **The generated catalog** (ids starting `q`) — 21 responses. These are going badly.

---

## (a) What players reported

### The authored tasks — people like these

15 responses across 14 tasks. 13 of them left a written note, which is a high rate and
means the feedback here is real rather than a checkbox reflex.

| What they ticked | How many of 15 |
| --- | --- |
| Enjoyed it | 11 |
| Never understood it | 10 |
| Solved it | 8 |
| Felt impossible | 5 |
| Felt broken | 2 |
| Inputs did nothing | 0 |

8 of the 15 reached level 1 or higher, topping out at level 8, and one task was finished
outright. The other 7 never cleared level 1 — so these are not uniformly working either.

The sharper line is how the sessions *ended*. Not one authored session was recorded as a
loss: 14 were still in progress when the player stopped, and 1 was completed. People walk
away from these. They do not die in them.

### The generated catalog — people bounce off these immediately

21 responses across 20 tasks. Only 3 left a note, which itself says something.

| What they ticked | How many of 21 |
| --- | --- |
| Felt impossible | 19 |
| Never understood it | 18 |
| Felt broken | 11 |
| Inputs did nothing | 4 |
| Enjoyed it | 0 |
| Solved it | 0 |

**Every single one of these ended at level 0 as a loss.** Not one person cleared a level,
enjoyed one, or solved one. That is the contrast with the authored set: every generated
session ended in a death, and no authored session did.

### The one number that matters most

How long people stuck with a task before giving up. Both figures cover only the tasks that
someone actually left feedback on, which is the like-for-like comparison:

- **Generated tasks (20 of them):** a median of **5 moves**, ranging from 1 to 16.
- **Authored tasks (14 of them):** a median of about **190 moves**, ranging from 19 to 646.

Roughly forty times the patience, for the same person on the same afternoon.

That is the case for polishing the authored set rather than starting over. People are
already willing to sit with these for hundreds of moves. The generated ones they abandon
before the screen finishes settling.

The generated results independently confirm the cull work already done in the junk-game
audit (`docs/2026-09-01-arc3-junk-game-audit.md`). Nothing new to decide there — it is
just nice to see a human arrive at the same verdict the static checks did.

### The written notes, grouped

**Things that are actually broken** — these are bugs, not taste:

- `ta3597a87` — *"Level 8 cannot be beaten because the energy goal piece in the top right
  locks the room."* This player reached level 7 and enjoyed it. A named, specific cause.
- `t4049adae` — *"I never really worked out what to do and I still beat the first six
  levels. Not sure if level seven is winnable or I just never figured out the correct
  mechanic."*

**Won without understanding anything** — the most interesting result in the whole set:

- `t89a4dc45` — finished all 8 levels, and still ticked "never understood it":
  *"I never quite worked out what to do but it seemed incredibly simple without ever
  coming up with a hypothesis at all. This was ridiculously easy."*
- `t7725dccf` — ticked both solved it and never understood it.
- `t4049adae` — beat six levels, never worked out the mechanic.

**Too plain / needs decoration** — three separate notes, unprompted:

- `t2774d7a8` — *"Seemed weird. Could definitely use more garnish. Is a big empty screen.
  Lots more clickable areas could be used. This is just not a very good one."*
- `ta6acc86e` — *"It was not at all clear that I had to approach the door thing from a
  certain angle. It's something where more art and more decoration would go a long way in
  these games."*
- `t7725dccf` — *"Not very unique or imaginative really. Definitely needs a glow up."*

**Genuinely hard, in a good way:**

- `t6d44af56` — *"Super hard for humans."*
- `t6acac767` — *"I both worked out what to do and didn't work out what to do. I got very
  stuck on level 3. Very strange game."*
- `t7114b1e1` — *"This one was crazy. Never figured out what the mechanics were."*

**The positive reference point.** `t643da6ee` is the one to hold up as the standard. Son
Pham's reaction was *"this one feels so ARC."* The player reached level 6, ticked both
solved it and enjoyed it, and wrote: *"It was enjoyable because it was easy to figure out.
The mechanics were a little weird. We could definitely improve on the mechanics and it
could definitely use a glow up."*

**The three played today (02-Sep)** are worth calling out because they say the same thing
the Boss said in chat a few hours later:

- `t088853a8` — *"This could be made enjoyable with a glow up and also made further out of
  distribution. I would do things like making the energy bar somewhere totally different.
  Look somewhere, look different. Also I'd probably do some different coloration."*
- `t7725dccf` — *"Not very unique or imaginative really. Definitely needs a glow up."*
- `t643da6ee` — quoted above.

So the direction below did not come out of nowhere. It came out of playing them.

---

## (b) What the Boss said

From the Boss, verbatim (02-Sep, #arc-3):

> "I mean the bones are there. It made seven levels that we can do another pass on and add
> noise, decoration, glow up, and stuff too but the base thing that it made is just kind of
> very formulaic... When I talk about adding a glow up to some of these games, what I mean
> is we're gonna add things like decorative elements that might change color or flash but
> not actually do anything. Moving certain indicators, like a health bar, out of an area
> where we would expect it to be, maybe making it a different shape than we would expect it
> to be. Instead of a bar we're going to make it actually like some sort of weird pyramid
> or pie shape or something else that reduces in a bizarre way."

Also from today, when Son Pham asked "Is Game generator seriously getting this good?", the
Boss answered: *"Yes and no. It looks good but I'm playing it right now and it's really
simple."*

**Why this matters, not just how it looks.** ARC-3 tasks are supposed to be hard to figure
out but easy to check once you have. Right now the authored games are the opposite: they
look tidy and read as familiar at a glance. A health bar in the top-left corner tells an
agent what it is without the agent having to work anything out. Decoration that flashes but
does nothing, and a meter that is a lopsided pie instead of a bar, take that freebie away.
The agent has to determine what actually matters instead of matching a layout it has seen a
thousand times. The decoration is not garnish. It is the difficulty.

---

## (c) What to do, most useful first

**1. Fix level 8 of `ta3597a87`.** Cheap.
A player got to level 7, enjoyed it, and hit a wall with a named cause: the energy goal
piece in the top right locks the room. This is the only confirmed hard blocker in the
authored set, and it is sitting on one of the better-received games.
*Done looks like:* level 8 is completable, and someone plays through it to prove it.

**2. Answer whether level 7 of `t4049adae` is winnable.** Cheap to check.
A player beat six levels and could not tell if seven was broken or just hard. We should
not be guessing about our own games.
*Done looks like:* a plain yes or no, written down. If no, it joins item 1.

**3. Write the glow-up recipe before glowing anything up.** Cheap, and it unblocks 4-6.
One short page naming the moves: where a meter is allowed to sit, what shapes it can take,
what kinds of inert decoration are allowed, and how much is too much. Without this, every
game gets decorated differently by whoever picks it up, and we cannot tell later which
choices helped.
*Done looks like:* a written recipe any game can be pointed at.

**4. Move the meters and change their shape.** Cheap once item 3 exists.
Take the health/energy indicator out of the corner people expect. Make it a pie, a wedge,
a lopsided pyramid — something that drains in a way you have to watch to understand. The
Boss named `t088853a8`'s energy bar specifically, and the written note left on that task
that same afternoon asks for exactly the same thing.
*Applies to:* `t088853a8` first, then `t7725dccf` and `t643da6ee`.
*Done looks like:* you cannot tell what the meter is from a single screenshot.

**5. Add decoration that does nothing.** Cheap.
Elements that flash and change color and have no effect on play. This is the piece that
does the real work — it forces the player to separate what matters from what does not,
which is the whole point.
*Applies to:* `t2774d7a8` most urgently — a player called it "a big empty screen" and asked
for "more garnish." Then the three played today.
*Done looks like:* every authored game has at least a few inert moving parts, and a fresh
player cannot immediately tell which parts are live.

**6. Full glow-up pass on the three played today.** Not cheap — this is per-game art work.
`t088853a8`, `t7725dccf`, `t643da6ee`. These are the three the Boss has actually played
recently and called formulaic. Do them properly as the worked examples, then judge whether
the rest of the 50 are worth the same treatment.
*Done looks like:* the Boss plays all three again and does not use the word formulaic.

**7. Make the door approach readable in `ta6acc86e`.** Cheap.
A player solved it and enjoyed it but said it was never clear the door had to be approached
from a particular angle. That is a hidden rule, not a hard one.
*Done looks like:* the angle requirement is visible on screen before you fail it.

---

## (d) Open questions

**Winning without understanding is a separate problem, and decoration does not fix it.**
Three tasks were beaten or solved by someone who ticked "never understood it," and one of
those was a clean 8-level completion described as "ridiculously easy." That is the ARC-3
property backwards — easy to do, nothing to discover. Making a layout unfamiliar is real
value and worth doing. It does not make a mechanic deeper. Someone needs to decide whether
the fix for `t89a4dc45` is decoration or a rebuilt mechanic, because right now it is
finishable by mashing.

**We do not know how many people this is.** A fresh session id is minted per play, so 36
responses is not 36 people. Almost certainly one or two. If we want numbers that mean
anything, we need more hands on the games before we cull or promote anything on this basis.

**"Formulaic" has not been pinned down.** The Boss's word covers the whole authored set,
but we only have notes on 14 of the 50 tasks. Nobody has looked at the other 36 to see
whether they are formulaic in the same way or in different ways.

**How much decoration is too much?** Nobody has said. Enough inert clutter and the game
stops being hard to discover and starts being unreadable. The recipe in item 3 is where
that line gets drawn, and it will need someone to play the result.

**Where the notes live.** The written feedback is deliberately never shown on the site —
showing one player's "you have to push the blocks onto the switches" to the next player
would give the whole thing away. The only way to read these is a direct database query.
Worth knowing before anyone goes looking for them in the app and concludes there is no
feedback.

---

## What I checked and did not use

- `docs/arc3-game-analysis/*.md` — these are strategy notes on the official ARC-3 preview
  games, not feedback on ours. Nothing relevant.
- Bubba's memory log — arc3 entries there are build-toolchain notes. No player feedback.
- The retired feedback table holds 2 older rows on generated tasks. Nothing useful in them.
