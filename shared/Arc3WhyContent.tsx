/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: The write-up "Creativity can't be interpolated", the home of it on the Boss's own site.
         Boss, 1-Nov-2026: the write-up and the lead page belong here; GitHub Pages is only a side
         link for people who won't come here. Words are his, carried over from the GitHub Pages
         note, with the one heading that pointed at that page changed. Rendered on the server
         for crawlers and in the browser by Arc3Why, so links are plain anchors.
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
      <h1 className="text-[40px] sm:text-[56px] font-bold leading-[1.05] tracking-[-1px] mb-3">Creativity can’t be interpolated.</h1>
      <p className="text-[21px] leading-[1.4] mb-8 opacity-70">Why these games were made the slow way, with a person in the loop.</p>

      <P>I’m a video game producer. I learned to write code in the ’80s for one reason: I wanted to make games. I’m still not good at clever code on my own. But when I iterate with a partner who can write code, I’m sometimes able to supply the clever parts. That’s how I work.</P>

      <H2>Coding agents are amazing. They aren’t creative.</H2>
      <P>Coding agents are wonderful. I can get things built now that were never possible for me before. But on their own they aren’t creative. They aren’t discovering anything new or thinking of anything new. They put together the old, which is great, and we can do a lot with that. We just shouldn’t mistake it for something it isn’t.</P>
      <P>That’s my caveman version. Dr. Jeremy Budd and Dr. Tim Scarfe wrote the careful one, <a className={LINK} href="https://archive.mlst.ai/paper/why-creativity-cannot-be-interpolated/">Why Creativity Cannot Be Interpolated</a> (Machine Learning Street Talk, 2026), and they’re more careful than I am. They hedge, and they say outright that they aren’t claiming AI can never be creative. Here’s how I read it, in chicken-farmer terms.</P>
      <P>When they say a model interpolates, they mean it recombines what already exists. You get something that looks new, with no picture of why the pieces fit together. They call that quasi-creativity.</P>
      <P>They borrow a split from Margaret Boden: creativity that explores inside a framework, and creativity that reshapes the framework itself. Either way it has to respect the rules of the domain. In game terms, that’s the difference between a new level and a new rule that changes what the old levels mean.</P>
      <P>What the human brings is taste: domain knowledge, a nose for what’s interesting, knowing what’s missing, and knowing which question to ask. The authors point to systems that pair a generator with an outside check, and for now they call people and AI working together the most promising path. In my shop the agent makes the thing and a person playing the game is the outside check.</P>
      <P>I’m talking about the tools we have today. Today the agent builds, and I decide what is worth building and whether it’s any good.</P>

      <H2>If you’re not deep in ARC-AGI-3</H2>
      <P>ARC says part of this in <a className={LINK} href="https://arxiv.org/abs/2603.24621">its own paper</a> (section 3.6), but I haven’t seen it put plainly for people outside the deep end of ARC-AGI-3. Three things to know.</P>
      <ul className="list-disc pl-6 space-y-4 mb-4">
        <li><strong>The 25 public games are the tutorial level.</strong> ARC calls them intentionally easier and says they don’t fully cover the mechanics of the private set. “My agent beats all 25 public games, as efficiently as a human” is fine. It’s also like saying you speed-ran the tutorial level of a video game. Not that impressive. The public 25 are a small taste of the mechanics, the easiest stuff, there to get you started. They’re not a tour of everything you’ll meet. I haven’t seen the semi-private games, but I expect them to be deviously difficult.</li>
        <li><strong>The public 25 had to be a little fun.</strong> ARC says they got a stronger emphasis on clarity and fun, so they’re easy for humans and at least somewhat fun for humans. My guess is the private games got less of that. I can’t see them, so it’s a guess. I expect stuff that isn’t fun for humans, while still being somewhat easy for a person and hard for an AI.</li>
        <li><strong>A generated game that no person played is slop.</strong> I’ve seen plenty of procedurally generated game packages from people who pointed a coding agent at the problem and said, “Hey, do this.” Mechanics-wise, okay, cool. Most of it is complete slop: no human curation, no human intent, and it has probably never been played by a human. Here’s my tell. ARC scores an agent against what real people did, with human action baselines behind the numbers. If a synthetic game set ships with no human action numbers at all, I assume nobody played it. That’s a tell, not proof.</li>
      </ul>

      <H2>What’s below</H2>
      <P>Only games that got worked on until they were worth keeping. The old batch that never got iterated on is gone. Where a person has played a game, the card shows how many actions it took and how many levels got cleared. Some don’t have human numbers yet, and the card says so with a dash. By my own test above, those aren’t finished.</P>

      <H2>Whose games these are</H2>
      <P>Not all of them are mine. Some came from Son and Ronen, and some of Son’s came out of his own head. Some we pulled out of the GPT and Claude slop soup, and then people got their hands on them. I don’t know that any of them are new ideas. What we added was human creativity.</P>
    </article>
  );
}
