# Kaggle primer for the news desk: competitors, teams, contests

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · written at the Boss's request after the Saturday
special showed the desk did not have this written down. Lookup table: [HANDLE_CROSSWALK.md](HANDLE_CROSSWALK.md).

## Three different things

1. **A Kaggle account (handle)** is one person (rarely a shared account). It carries a global career:
   tier (Novice, Contributor, Expert, Master, Grandmaster), medals, highest-ever rank. The handle is
   the lowercase name in the profile address, for example `cpmpml`. It follows the person everywhere.
   The displayed name can differ from the real name (`cpmpml` is shown as CPMP).
2. **A team** exists **per contest**. It has its own numeric team id, its own name and its own
   roster, and it can be renamed, merged or dissolved before the deadline. Kaggle shows the team name,
   not necessarily the members, on the board; the members come from the roster and merge history.
3. **A contest** is a separate ledger. ARC-AGI-2 and ARC-AGI-3 are two contests with two boards, two
   submission limits and different hardware. Nothing carries over except
   the people.

## What that means for copy

- **Same person, different team, different contest.** CPMP (`cpmpml`) and Darragh (`darraghdog`) are the
  two-person team **nvbanana** in ARC-2 and two of seven on **NVARC3** in ARC-3. Both are true at once;
  scores and places are unrelated. Giba (`titericz`) has his own solo ARC-2 entry and is also on NVARC3.
  Yi-Chia Chen has a solo entry in both contests under different team ids.
- **Same team name does not mean same roster.** Never carry a roster from one contest to the other.
  Use the team id and the contest named in `competitors.json`.
- **Career medals belong to the person, never the team's current run.** Say "career golds", not
  "the team has gold".
- **Kaggle handle is not the X handle.** Match them only through a link on the person's own profile, a
  reciprocal link, or a source the playbook accepts. A post that merely tags someone proves the tag, not
  the Kaggle account (this is why Chan Kha Vu's teammates are *candidates* in `handle-candidates.json`).
- **Private versus public board.** Public places are provisional; the private board decides the
  medals after the close. A score swing between them is expected and is often the story.
- **Submission limits.** Each contest caps scored submissions per day, so a failed run can cost a
  day. That is why infrastructure trouble hurts so much late in a contest.

## Where each fact lives

| Question | Ledger |
|---|---|
| Who is this person, which accounts are verified | `content/news/people.json` |
| Which team, which members, in which contest | `content/news/competitors.json` (id `arc-2-<teamId>` / `arc-3-<teamId>`) |
| Probable, unconfirmed identities (do not publish as fact) | `content/news/handle-candidates.json` |
| Everything above in one flat table | `content/news/handle-crosswalk.json`, `HANDLE_CROSSWALK.md` |

Regenerate the table with `python3.13 scripts/newsroom_crosswalk.py` after any change to those ledgers.
