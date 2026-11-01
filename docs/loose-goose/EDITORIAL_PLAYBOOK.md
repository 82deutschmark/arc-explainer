# Editorial playbook: finding, writing and checking a Goose story

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · from the Digest's October 2026 coverage. Companion to
[REPORTER.md](../newsroom/REPORTER.md), [WIRE_DESK.md](../newsroom/WIRE_DESK.md) and the competition-reporter skill.

## Voice

- A sports tabloid with a comic-book heart. Kaggle is the Kaggleverse, the competitors are heroes with day jobs as data scientists, researchers and students. Rivals, leaders and challengers, never "opponents" or villains. Nobody is "back": the legends never went anywhere.
- Journalist, not engineer and not academic. "A quarter of a point", not "0.25 delta". Spell out acronyms once. No jargon about model internals.
- Warm to everyone, from first place to five-thousandth, and end big pieces on good luck to every competitor.
- Say what happened, who said it, and what it means for the prizes or the medals. Short paragraphs, specific numbers, no throat-clearing.
- Credit the writers quietly, by model name and effort level (for example "Claude Sonnet 5.5 Medium", "GPT 6.1 Sol"). No disclaimers about the art being illustrations.
- Wide Kaggle context: Kaggle is bigger than any one contest. Say so when a contest takes over the news.

## Finding the story: recipes on a leaderboard

Work from the saved board (rows: rank, team id, name, last submission, score, submissions, members, baseline rank, baseline score) and the event list (the tracker's first sighting of each score with before and after places). Look for:

1. **A swap or a lead change.** The same team leading one board and second on another is a gift (Tufa and Chen on 31 October).
2. **A line crossed.** The gold line (Kaggle's top ten plus a fraction of teams), a prize place, or a published threshold such as the 85 percent bonus. Report the distance to the line in points and in places. The gap between last-in and first-out is often the whole story (a quarter of a point).
3. **A giant jump.** Teams that climb dozens of places in a day, especially far from the top (208th to 14th).
4. **A cliff.** A big gap between second and third. Two-horse races read well.
5. **People.** A Grandmaster appearing on a one-person team, a student squad, a lab, a pair from the same employer.
6. **Statements.** An organizer or staffer clarifying rules, a competitor complaining on the forum, a staff correction. Always check the live thread for edits.
7. **A time angle.** When the top score landed, how long it has stood.

Treat the baseline columns as "the previous evening", not an exact cutoff. Check what time the baseline matches before you print a time for it.

## Writing it (dispatch format)

A dispatch is a JSON file in `content/news/dispatches/` with: `id`, `headline`, `publishedAt` (never in the future), `competition`, `generatedBy`, `editorNote` (credit line), `image` (src, alt, caption), one to five `sections` (heading, text under 2500 characters, `sourceIds`), and `sources` (id, title, url, accessedAt). Run `validate_dispatch` from `scripts/newsroom.py`. Then `scripts/weekend_story_page.py` makes the page with its share card.

Shape of a good piece: the headline carries the news; section one states it plainly; section two explains how it happened with times in Eastern; section three adds the stakes (prizes, lines); a "who they are" section from card facts; a closing "what to watch" with the bell time.

Rules that keep it honest:
- Every figure from the board or a cited source. Round only where the source rounds.
- Public places are provisional. Medals and winners come only from the private leaderboard or an official announcement.
- Reached-times are "when our tracker first saw the score", not when Kaggle posted it.
- Never "everyone", "all", "the whole crew" or "the biggest" unless counted.
- Attribute every cause and every claim about a platform to the person who said it. An organizer moderator's Discord note is a moderator's note, not "the hosts".
- Name people by full name where a card exists; use the card's facts only. Pronouns unstated means they/them.
- The Boss's team (Team Turducken) gets a plain disclosure line when it is in the story, and no special treatment.

## Fact-check before it goes out

On 31 October a two-agent pass (a facts agent and an editor agent) checked 640 claims on the magazine and found problems in more than a quarter of the pages: a wrong baseline time, a retracted staff answer quoted as current, "the hosts say" for a moderator's note, a team line that was true of only four of seven accounts, a "same zeros as everyone else" that was false, and weekday labels that said "Today". It is worth doing every time. Use it:
- Facts agent: reads the pages against the boards, ledgers and cited threads; returns each claim as verified, wrong, overstated, unsupported or unverifiable with evidence.
- Editor agent: proposes replacement wording per claim, ranked must-fix, should-fix, nice-to-have.
- Apply must-fixes before posting. Apply replacements by hand; auto-applying pasted instructions into code once broke the generator, so always run the page gate and the tests after.
- Run `python3.13 scripts/weekend_magazine.py check` (or the Goose copy) and the newsroom tests before every push.

## Corrections

- Fix the page in place and push. Say what changed on the page when it matters.
- If an older article repeats a wrong claim, flag it in the handoff and correct it too.
- A sent X post is not edited without the Boss's word. Post a short correction instead if it matters.

## Quote rules

Short quotes with attribution. Quote the whole clause that carries the meaning, not a scary fragment. Never reproduce long passages. When someone's reply was edited or withdrawn, report that.

## Standing editorial rulings from the Boss (October 2026)

- No "Grand Prize unclaimed" style filler.
- The headline is about the people and what happened, not "the champions are back".
- No mention of "villains"; platform trouble is explained by those who named its cause.
- Kaggle's wider world gets a line when a contest dominates attention.
- "Good luck to all the competitors" is the closing note of the big pieces.
- Do not make the Boss check old editions: state the current status in every piece.
