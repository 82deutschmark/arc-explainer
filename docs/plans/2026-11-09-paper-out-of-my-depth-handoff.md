# Handoff: the Paper Track essay, "Out of My Depth" (working title)

Author: Claude Fable 5.2 (effort level not shown to me)
Date: 09-November-2026, written 20:30 UTC
Deadline: the team's notes say 9 November 2026, 23:59 UTC. One site summary I read today said papers
were due on the 8th. I did not resolve it. Ask the Boss or read the Kaggle page before anything else.

Read this whole file before writing a word of the essay. Three assistants, me included, have already
written this paper badly in three different ways. The Boss is tired of it.

## 1. Where things stand

| Version | What it is | Why the Boss does not want it |
|---|---|---|
| v6, "Slop Breaks a Rule" | The technical paper. Dense, accurate, covers the submission. | Engineer voice. Fine as a source of facts. |
| v8, "The Capacity to Acquire Capacity" (merged) | A human-learning essay by GPT. | Abstract. No person in it. "We" learned things, nobody is there. |
| v9 | v8 with the synthetic-games facts pasted in (mine). | Mechanical. Over the word limit. |
| v10, "The Ruler Is a Person" (mine, live) | First-person rewrite. | I typed up his chat messages as prose, kept his throwaway lines, framed his result as "bought", and invented a line of biography. |

| v11, "Out of My Depth" (mine, live) | Written after this note, at the Boss's order to push my own version of section 3. First person, new prose, adds the frozen-model thread below. | Not yet read by the Boss. Start here. Run section 5 on it before changing anything. |

All five are live as unlisted previews under `client/public/specials/`. v10's submission paragraph and its
strip of six game pictures are reusable. Its voice is not.

The essay that should exist has not been written. Section 3 is the argument for it.

## 2. How the Boss wants this worked (learned the hard way)

- **His chat messages are production notes, not copy.** Never put his sentences into the essay. He
  dictates loose, searching notes ("I don't know what I'm trying to say"). Your job is to find what he
  means and say it the way a writer would. Lines I wrongly lifted: the hog at the fair, the god in a
  box, "accused of being smart". The only phrases of his that belong are the thesis lines he has used
  on purpose: "Slop doesn't respect the constraints of the domain" and "Intelligence is the capacity
  to add capacity."
- **This is his magnum opus, not a ticket.** He said so. The synthetic games are the centre. He wants
  a writer and a thinker, an outsider's essay with a soul. Not a software engineer, not a data
  scientist, not a boring academic paper.
- **Bring him the thinking before the draft.** He asked for guidance in tying threads together. Give
  him the spine in a few plain sentences, get his reaction, then write.
- **Do not go researching.** He told me to stop. If you need a fact about ARC-3, the team, or him, ask
  him. He answers fast.
- **Publishing is nothing.** Previews are unlisted and only he reads them. Push a draft live and send
  the link. Do not ask permission and do not announce it as an event.
- **Do not dunk on other teams' games.** Our own agents' bad output is fair game.
- **Son and the Boss both led the team.** Son's surname is unconfirmed; I wrote "Pham" from his site
  name. Ask.
- **Replies to him follow his global rules:** short, plain, no code, no hashes, almost no numbers.

## 3. The argument

One claim, three proofs.

**The claim: a mind is not a vessel, and filling one is not the same as teaching it.**

Three people have said this in three fields, and the essay's job is to notice they are the same
sentence:

- Paulo Freire said it about schools. His "banking" model of education: the teacher makes deposits,
  the student stores them, the exam checks the balance. (Pedagogy of the Oppressed, chapter 2. The
  Boss raised this himself. His alternative is "problem-posing" education: hand the learner a real
  situation and let them work on it.)
- Chollet said it about benchmarks. Skill at a task can be bought with data and built-in knowledge,
  so skill tells you little. Intelligence is how fast a learner turns a little experience into new
  skill.
- Budd and Scarfe said it about creative work. Recombining what was poured in gives you something
  new-looking that ignores what the domain cares about. They call that slop.

**The turn that makes it an essay.** A large language model is the best banking-model student ever
made: the largest deposit in history, and it passes exactly the exams that certify deposits, the bar
and the medical boards. That is what shook the Boss in December 2024. It did not show that machines
were intelligent. It showed what those certificates had been measuring all along.

He is the reverse case. No degree. He went to university and left because it is not how he learns. He
never got past calculus. He is 44. Nothing on paper says he is intelligent, and he does not think a
degree would prove it. What he has instead is that when he does not know something, he goes and finds
out. He is out of his depth most of the time and comfortable there.

So the two are mirror images. On paper the machine is the intelligent one. In ARC it is the other way
around. That is why ARC caught him: it is the one exam a deposit cannot pass, and the one exam an
outsider can referee. Most people cannot check an answer on a coding benchmark or an expert exam, so
they have to take the machine's word. A child can check ARC. "Easy for humans, hard for AI" matters
most at exactly the moment when so much that is hard for humans has become easy for AI.

**Proof one, the person.** A year and a half after first hearing of the benchmark, he co-led a team to
fifth on its public board. Not because skill was bought (my v10 framing, which he rejected), but
because the pairing works: the machine holds the deposit, the person does the asking. A producer's
trade is being answerable for work done by people who know more than he does.

**Proof two, the submission.** The harness is built the way he learns. Nobody hands the model
knowledge of any game. It sees objects and changes, makes a guess, tests the guess in code, and the
game answers. When we did hand it an answer it was wrong: an early prompt told it the bar at the edge
of the screen was probably a timer to ignore, and in most public games that bar is the move budget
that ends the game. The model's worst failure is the banking student's failure, fluent recitation: a
whole run calling a rival a confused "bot" while the rival was winning. This section is where the
score, the model, the harness credits and what lost must appear. Keep it exact. Facts are in v6.

**Proof three, the games. This is the centre.** The test turned around: ask the best-filled vessel to
pose a problem to a person. It produces something that runs, has levels and a winning line, and is not
a game. A game is a problem posed to someone who does not know yet, and the domain's only rule is
whether a person can pick it up cold and work it out. The count: over a thousand made, forty-six
kept, and none of the eight hundred batch-made ones. Every kept game is one a person played and sent
back. Honest starting point: when the engine came out the Boss could only reskin existing games, and
Son was the one making new, strange ones. Show the games. Say "cannot yet" and "passable, not
finished", never "cannot".

**The frozen model (added by the Boss after the first version of this note).** This is his answer to Universality. The measure of intelligence is the capacity to acquire new capacities. He has acquired them this year. The model in our entry is frozen: it cannot. Soon a larger one ships and this one is retired and replaced, not taught. He is the same mind, revised daily, with no successor. It ties straight to the entry: everything the entry learns is held outside the weights, in code the model writes during one game, and the harness discards it when the game ends. For Progress he asked "progress on what?" The v11 answer: it locates the gap as learning that outlasts a game, offers the human-played games, and keeps the record of what lost.

**The close.** The man school did not work for spent a year writing lessons for machines, as problems
to work out, not answers to store. Whether they teach anything is unmeasured, and the essay says so.
He still has no paper that says he is intelligent. Do not end on a score.

A motif worth using lightly: depth. Out of his depth, the deep end and the shallow end, a machine that
cannot tell when it cannot touch bottom. It came from him, so develop it, do not quote it.

Titles to offer him: "Out of My Depth", "Not an Empty Vessel", "The Dropout and the Valedictorian".

## 4. The rubric, honestly

The six questions are scored zero to five each. Read from arcprize.org's paper page on 9 November.

| Criterion | What it asks | Where this essay stands | How to earn it |
|---|---|---|---|
| Accuracy | Leaderboard performance of the linked submission | Banked. Fifth on the public board. Prose cannot change it. | State the scores exactly and link the notebook. |
| Theory | Why the approach works, not how | Strongest card. | The claim above explains the harness: it works because nothing is deposited and the game can say no. The essay must make that link out loud. |
| Novelty | New relative to public research | Good for the framing and the inverse test with a count. Poor for the mechanism, which v6 admits is mostly known. | Claim the framing and the game-making evidence. Do not claim the harness idea. |
| Universality | General beyond the competition | Fair. | The claim covers a person, a harness and a design process. Admit there is no result outside ARC. |
| Completeness | How fully the paper covers the submission | The danger. A personal essay scores near zero here. | One exact section on the entry, plus links to the notebook and the full technical write-up. Do not cut it for prose. |
| Progress | Does it raise anyone's chance of reaching the target | Weakest. | The useful, concrete things: open human-played games, the record of what lost, and a warning to everyone generating synthetic games that a solver's pass is not a person's pass. |

The page also asks a paper to contain an abstract, an introduction, prior work, the approach, results
and a conclusion. An essay can carry all six without those headings, but each must be findable.

Do not promise the Boss a win. An essay is a gamble against technical papers. What it buys is being
the one paper the judges have not read ten times.

## 5. Adversarial checks before the Boss sees a draft

Run these yourself, once each. Do not spin up a crowd of checkers (see the workflow-scale memory).

1. **Transcript check.** Put the draft beside the Boss's messages. Any run of five or more of his chat
   words is a failure. Rewrite it in a writer's sentence.
2. **Invented-biography check.** Every personal fact must be one he stated. The full list I have:
   game producer at a large studio he will not name; not an engineer or data scientist; never past
   calculus; went to university, did not graduate, it was not how he learns; no degree; 44; people
   have always called him smart and he has never known how smart; crisis in December 2024 when o3
   came out; started looking at benchmarks early in 2025 because he loves failure modes; first could
   only reskin games while Son made original ones; he played and judged the games. Anything else,
   ask him.
3. **Number check.** Every figure against v6 and the team's evidence file in bubba-workspace
   (`docs/plans/2026-11-08-arc-paper-track/evidence.md`). The game count comes from his own "why" page,
   counted 8 November. The random-play finding in the 5 November review is about our own twelve
   featured games, not the batch output. Do not move it.
4. **Quote check.** Chollet's definition and the Budd and Scarfe lines in v6 were checked by earlier
   sessions. I have no checked Freire quotation. Paraphrase him without quote marks unless the Boss
   supplies the line.
5. **Hostile judge, as Chollet.** Does it claim the Boss is intelligent? That machines cannot be
   creative? That training on these games helps? That Freire and Chollet say the identical thing
   (it is an analogy)? That the harness holds no built-in knowledge (it holds hand-written general
   knowledge about objects and change, which Chollet approves of; it holds nothing about any game)?
   Cut or soften each.
6. **Hostile judge, as an engineer who hates essays.** Can they tell from this page alone what was
   submitted, what it scored, and what the team added? If not, Completeness is lost.
7. **Education-history check.** The factory-school history and the remark about needing a degree to
   work at a big retailer were him thinking aloud. Keep the education thread personal (what school
   felt like to him). Do not assert history.
8. **Dunk check.** No other team named or implied.
9. **Word count.** The team's limit is 1,500. I do not know whether references count, so stay under
   with them included.
10. **The Freire-and-language-model comparison is probably not new by itself.** Do not claim it as a
    discovery. What is new is tying it to Chollet, to this benchmark, and to the game-making evidence.

## 6. Mechanics

- Build a page: copy `client/public/specials/arc3-paper-ruler-v10-preview/make_page.py`, which turns
  an `article.md` into the plain reading page and drops in the game pictures.
- Put it live: `tools/specials-publish/publish_specials.py` with the file paths. Commit the same
  files so the next full deploy keeps them.
- Game pictures and one-line descriptions: the arc3-synthetic-games repository, `docs/previews` and
  `docs/catalog.json`. Live site: https://82deutschmark.github.io/arc3-synthetic-games/
- The Boss submits to Kaggle himself. It needs a cover image and the public notebook link.
- Add a changelog entry for any new page.

## 7. Ask the Boss first

1. One true scene from this year when he was plainly in over his head, and what he did next. The
   essay needs one scene and I have none.
2. Son's surname, and whether Son has read the plan for a first-person piece under both names.
3. How much of the no-degree story he wants in public.
4. Which title.
