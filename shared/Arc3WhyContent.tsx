/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: The write-up "Creativity can't be interpolated", the home of it on the Boss's own site.
         Boss, 1-Nov-2026: the write-up and the lead page belong here; GitHub Pages is only a side
         link for people who won't come here. Words are his, carried over from the GitHub Pages
         note, with the one heading that pointed at that page changed. Rendered on the server
         for crawlers and in the browser by Arc3Why, so links are plain anchors.
Updated: 2026-11-08, Claude Sonnet 5.5 Medium. The Boss: tidy the presentation, talk up the producer and the iteration, say these are
         the best of and were played by people, and that nobody lost a job. Rewritten in his words (his 8-Nov message); the
         research-paper tour and the human-numbers paragraph are cut.
Updated: 2026-11-08 (later), Claude Sonnet 5.5 Medium. The Boss: lean on Budd and Scarfe's paper, drop the bitterness, keep Boden and the
         phylogeny out, check the numbers, make it more academic. Paper claims read from the MLST archive page and full text; ARC's
         claims from arXiv 2603.24621 (section 3.6, the ten-person calibration); counts from the live player on 8-Nov-2026
         (1,358 games incl. 25 public; 800 ai-generated + 252 redbluepill; 46 approved).
SRP/DRY check: Pass - text only, one copy. The playable games under it belong to Arc3Why.
*/
import React from 'react';

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 mb-3 text-[24px] sm:text-[28px] font-bold leading-[1.2] tracking-[-.3px]">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="mb-4">{children}</p>;
const LINK = 'underline underline-offset-2';

export default function Arc3WhyContent() {
  return (
    <article className="text-[18px] leading-[1.65]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <h1 className="text-[40px] sm:text-[56px] font-bold leading-[1.05] tracking-[-1px] mb-3">Slop, constraints, and a person in the loop.</h1>
      <p className="text-[21px] leading-[1.4] mb-8 opacity-70">Notes from a game production pipeline, after Budd and Scarfe’s “Why Creativity Cannot Be Interpolated.”</p>

      <P>I’m a video game producer. I’ve produced games at a AAA studio that will stay nameless, and for this project I directed a team of coding agents and a few collaborators, Son and Ronen among them. This page explains what we made, why most of it was thrown away, and why the rest looks the way it does. The explanation is not mine. It comes from a paper by two friends of mine, Dr. Jeremy Budd and Dr. Tim Scarfe of Machine Learning Street Talk: <a className={LINK} href="https://archive.mlst.ai/paper/why-creativity-cannot-be-interpolated/">Why Creativity Cannot Be Interpolated</a> (2026). What follows is a report on how its argument held up in a workshop.</P>

      <H2>What the paper claims</H2>
      <P>The paper’s central claim is that novelty is not creativity. A system can produce output that is new, one piece at a time, and still not be creative, because genuine creativity requires respect for the constraints of the domain it works in. Budd and Scarfe call “slop” the conjugate failure: what you get when novelty is not constrained by understanding.</P>
      <P>Two further claims matter here. First, current AI is only meaningfully creative under human supervision. A model is coherent within any single frame but has no trajectory of its own, and its output resolves into a coherent whole only when a competent person supplies the grounding. Second, human and AI co-creation is the most promising path, with a warning attached: done well it offers a fresh perspective, done badly it reduces the work to slop. In the authors’ phrasing, “AI amplifies what you bring to it.” They also caution against wild extrapolation from today’s systems to near-term labour-market disruption.</P>

      <H2>The constraints of this domain</H2>
      <P>ARC-AGI-3 states its constraints. Each environment was attempted by ten people, and only environments fully solved by at least two of them, independently and on a first look, were admitted. The private games are harder than the public ones but remain solvable by people. The public set is, in ARC’s words, intentionally easier, with a stronger emphasis on clarity and fun (<a className={LINK} href="https://arxiv.org/abs/2603.24621">the ARC-AGI-3 paper</a>, section 3.6). A game that belongs in this domain is therefore one that a person can pick up cold and figure out, that is hard for an AI, and, in the public set, pleasant to play.</P>
      <P>By the paper’s definition, a game that breaks these constraints is slop however new it looks. Many of the synthetic game sets I examined appear to break them in the most basic way. A solver or a scripted solution shows that a game can be won, which says nothing about whether a person can work it out, and none of the sets I looked at published a record of people playing. Several look easier for a program than for a person, which is the reverse of what the domain asks for.</P>

      <H2>What we found when we counted</H2>
      <P>We were no exception. The player on this site now holds 1,358 of our games, which includes the 25 public ones. Of the rest, about a thousand came out of batch generators. Forty-six are approved, and those are the games on this page. More than nine in ten of what we made did not survive being played. The paper would predict that outcome: generation without understanding gives you volume, and judging the volume is a separate job that needs a person.</P>

      <H2>Method: the person is the outside check</H2>
      <P>Our pipeline follows the paper’s division of labour. The agents write the code and the art. A person plays each version, says what is unclear, dull or derivative, and decides what is kept. The lock-target line went through eight versions on the way to LT03 that way, and most of the feedback on all of these games is mine. The agents supplied speed. I supplied what the paper calls grounding, and what Kenneth Stanley, whom the authors cite, calls a nose for the interesting. A producer’s job, which is to say what a game is for and when it is finished, turns out to be the job the paper assigns to the human.</P>
      <P>The same reading applies to the question everyone in games is asking. In this project no artist and no programmer lost a job. What changed is how fast one person could iterate. That is a modest claim about one workshop, and it is consistent with the paper’s caution against sweeping forecasts: its authors note that spreadsheets did not lead to fewer accountants.</P>

      <H2>Limits</H2>
      <P>Not every game here is mine. Some came from Son and Ronen, and some started as GPT or Claude output that people then played and reworked. I cannot promise any idea is new. The working bet is that games a person played and fixed make better practice for an agent than games only a program checked. Nobody has measured that yet, and nothing on this page claims it.</P>
    </article>
  );
}
