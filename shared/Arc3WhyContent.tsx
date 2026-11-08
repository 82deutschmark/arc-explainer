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
      <h1 className="text-[40px] sm:text-[56px] font-bold leading-[1.05] tracking-[-1px] mb-3">The best of, after a lot of playing.</h1>
      <p className="text-[21px] leading-[1.4] mb-8 opacity-70">A game producer, a pile of coding agents, and the games that survived being played by people.</p>

      <P>I’m a video game producer. I’ve produced games at a AAA studio that will stay nameless, and I learned to write code in the ’80s for one reason: I wanted to make games. I’m still not a great programmer. I don’t need to be. What I know is what makes a game work, what makes it confusing, and when it’s done.</P>

      <H2>These are the best of</H2>
      <P>I looked at the other synthetic game sets out there. They’re nice, and they’re procedurally generated, obviously. Not one of them had human plays, and I’d bet not one was fun. Nobody had iterated on them. Somebody pointed a machine at the problem and shipped what came out.</P>
      <P>These are different. Every game on this page is the result of real human iteration, mostly mine. Someone played a version, said what was wrong, the agents fixed it, and someone played it again. LT03 went through eight versions. I’m proud of these.</P>

      <H2>Nobody lost their job</H2>
      <P>The games industry is at a turning point with AI in production and AI art, and I know a lot of people are scared. So let me say it plainly: no artists lost their jobs here. No programmers lost theirs. Nobody did. All that happened is that I got to iterate faster, much faster.</P>
      <P>Iteration speed is what game development comes down to. Historically you either had a cracked solo developer from the early days, or a big corporate studio with the people and the time. What these tools gave me is the speed of the first with the discipline of the second: the producer’s job, run at a pace that wasn’t possible before.</P>

      <H2>They laughed</H2>
      <P>A year and a half ago, when these coding tools were taking off, software engineers laughed at them. A lot of them laughed at me for using them. What could a video game producer, a project manager, possibly know about building anything?</P>
      <P>It turns out quite a bit. The agents write the code. They don’t notice that a game is dull, or confusing, or has nothing new in it. That takes someone who has spent a career shipping games. Running a pipeline of AI tools well is a producer’s skill.</P>

      <H2>If you’re coming from ARC-AGI-3</H2>
      <P>ARC calls its 25 public games intentionally easier, and says they don’t fully cover the mechanics of the private set (<a className={LINK} href="https://arxiv.org/abs/2603.24621">its own paper</a>, section 3.6). Beating all 25 is the tutorial level. These games are built to be hard for an AI in ways a person finds easy, and people have played and reworked every one. Why that matters is covered in <a className={LINK} href="https://archive.mlst.ai/paper/why-creativity-cannot-be-interpolated/">Why Creativity Cannot Be Interpolated</a>, if you want the careful version.</P>

      <H2>Whose games these are</H2>
      <P>Not all of them are mine. Some came from Son and Ronen, and some of Son’s came out of his own head. Some started as GPT and Claude output that people then played and reworked. I can’t promise any idea is new. I can promise people played them and kept sending them back until they worked.</P>
    </article>
  );
}
