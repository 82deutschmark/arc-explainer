/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: /arc2, the home for ARC-1 and ARC-2 resources. Boss, 1-Nov-2026: the hub at /home is
         ARC-AGI-3 only, and ARC-2 resources go somewhere else. These entries moved from the
         old hub unchanged, along with its list of every public section of the site.
SRP/DRY check: Pass - uses the route metadata for the section list; the hub owns ARC-3 entries.
*/
import { ARC12_READING } from '@shared/arc3ResourceHub';
import { ROUTE_META_TAGS } from '@shared/routes';
import { Link } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ARC, MONO, SANS } from '@/pages/arc3-community/landingTheme';

type Resource = { title: string; href: string; description: string; fullPage?: boolean };
const SECTIONS: { title: string; resources: Resource[] }[] = [
  { title: 'Play and learn', resources: [
    { title: 'Human ARC', href: '/human-arc/', fullPage: true, description: 'Draw solutions, take a puzzle assessment and review your results using an anonymous player profile.' },
    { title: 'Space Force Mission Control', href: 'https://sfmc.markbarney.net/', fullPage: true, description: 'A mission-based introduction to pattern puzzles, with a space theme for younger players and curious beginners.' },
    { title: 'ARC puzzle browser', href: '/browser', description: 'Explore ARC-AGI-1 and ARC-AGI-2 tasks, examples and recorded model explanations.' },
  ] },
  { title: 'ARC-AGI-2 competition', resources: [
    { title: 'ARC-AGI-2 Kaggle leaderboard', href: '/kaggle-leaderboard/arc-2', description: 'Public standings for the ARC-AGI-2 contest. Public standings are not final private results.' },
    { title: 'ARC-2 hard set', href: '/arc2/hard-set', description: 'Team research on the hardest ARC-2 puzzles, with notes on each.' },
  ] },
  { title: 'Results archives and research tools', resources: [
    { title: 'Hugging Face results archive', href: '/analytics', description: 'Charts, dataset coverage and model comparisons built from imported ARC Prize records. An archive, not a feed of the latest official results.' },
    { title: 'ARC-1 and ARC-2 scoring', href: '/scoring', description: 'Combine stored attempts and inspect dataset scores, coverage and available costs.' },
    { title: 'Model comparison', href: '/model-comparison', description: 'Compare recorded attempts and puzzle-level outcomes for selected models.' },
    { title: 'RE-ARC', href: '/re-arc', description: 'Generate additional ARC-style evaluation tasks and validate submissions.' },
    { title: 'Worm Arena', href: '/worm-arena', description: 'Watch archived model matches and inspect replays from a separate game environment.' },
    { title: 'Contributor profiles', href: '/hall-of-fame', description: 'People and projects in the ARC community, including dated historical results.' },
  ] },
];

export default function Arc2Resources() {
  usePageMeta({
    title: 'ARC-1 and ARC-2 resources | ARC Explainer',
    description: 'Puzzle browsers, assessments, scoring, results archives and research tools for ARC-AGI-1 and ARC-AGI-2.',
    canonicalPath: '/arc2',
  });
  return (
    <div style={{ background: ARC.ground, color: ARC.text, fontFamily: SANS, minHeight: '100vh' }}>
      <div className="max-w-[1000px] mx-auto px-4 sm:px-5 py-10">
        <h1 className="text-[34px] font-bold tracking-[-.5px] mb-2">ARC-1 and ARC-2 resources</h1>
        <p className="text-[15px] mb-8" style={{ color: ARC.dim }}>
          The grid puzzles. For the ARC-AGI-3 games, walkthroughs and everything else, go to the{' '}
          <Link href="/home" className="underline">ARC-3 resource hub</Link>.
        </p>
        {SECTIONS.map((section) => (
          <section key={section.title} className="mb-9">
            <h2 className="text-[11px] tracking-[2.5px] uppercase pb-2" style={{ fontFamily: MONO, borderBottom: `2px solid ${ARC.text}` }}>{section.title}</h2>
            {section.resources.map((r) => (
              <p key={r.href} className="py-2 text-[14px] leading-[1.5]" style={{ borderBottom: `1px solid ${ARC.border}`, color: ARC.dim }}>
                {r.fullPage
                  ? <a href={r.href} className="font-semibold underline underline-offset-2" style={{ color: ARC.text }}>{r.title}</a>
                  : <Link href={r.href} className="font-semibold underline underline-offset-2" style={{ color: ARC.text }}>{r.title}</Link>}
                {' '}{r.description}
              </p>
            ))}
          </section>
        ))}
        <section className="mb-9">
          <h2 className="text-[11px] tracking-[2.5px] uppercase pb-2" style={{ fontFamily: MONO, borderBottom: `2px solid ${ARC.text}` }}>Further reading</h2>
          {ARC12_READING.map((r) => (
            <p key={r.url} className="py-2 text-[14px] leading-[1.5]" style={{ borderBottom: `1px solid ${ARC.border}`, color: ARC.dim }}>
              <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2" style={{ color: ARC.text }}>{r.title} ↗</a>
              {' '}{r.by}. {r.desc}
            </p>
          ))}
        </section>
        <nav aria-label="All public sections" className="pt-2">
          <h2 className="text-[11px] tracking-[2.5px] uppercase pb-2 mb-3" style={{ fontFamily: MONO, borderBottom: `2px solid ${ARC.text}` }}>Every public section of this site</h2>
          <ul className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ROUTE_META_TAGS).filter(([, meta]) => !meta.noindex).map(([href, meta]) => (
              <li key={href}><Link href={href} className="underline underline-offset-2" style={{ color: ARC.dim }}>{meta.title.replace(/ \| ARC Explainer$/, '')}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
