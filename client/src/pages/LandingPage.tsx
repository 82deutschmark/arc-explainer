/**
 * Author: Claude Opus 5.5 High; GPT-6.1 Sol / Codex; Codex
 * Date: 2026-11-01
 * PURPOSE: /home, the ARC-AGI-3 resource hub. Boss, 1-Nov-2026: the collection is the best
 *          anywhere and was being displayed badly; all ARC-3 resources go here together, the
 *          human walkthroughs lead and are finally advertised, games play in one click, and
 *          ARC-2 goes elsewhere (now /arc2). One filter box searches the whole page.
 *          Dense on purpose: ruled lists rather than a grid of cards with empty middles.
 * SRP/DRY check: Pass — directory data in shared/arc3ResourceHub; walkthrough rows in
 *          WalkthroughTable from the shared game registry; game tiles from SyntheticGames.
 */
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ARC3_HUB_SECTIONS, type HubResource, type HubSection } from '@shared/arc3ResourceHub';
import { BoardWall, INK, useApprovedGames } from '@/components/arc3/SyntheticGames';
import { WalkthroughTable } from '@/components/arc3/WalkthroughTable';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ARC, MONO, SANS } from '@/pages/arc3-community/landingTheme';

const HOT = '#E53AA3';
const TOTAL = ARC3_HUB_SECTIONS.reduce((sum, section) => sum + section.items.length, 0);

function matches(resource: HubResource, needle: string): boolean {
  return `${resource.title} ${resource.by} ${resource.desc}`.toLowerCase().includes(needle);
}

/** Pages on this site go through the router, unless they're static files the router can't serve. */
function ResourceLink({ resource }: { resource: HubResource }) {
  const style = { color: ARC.text };
  const className = 'font-semibold underline-offset-2 hover:underline';
  if (!resource.url.startsWith('/')) {
    return <a href={resource.url} target="_blank" rel="noreferrer" className={className} style={style}>{resource.title} <span aria-hidden="true" style={{ color: ARC.faint }}>↗</span></a>;
  }
  return /\.(html|md)$/.test(resource.url)
    ? <a href={resource.url} className={className} style={style}>{resource.title}</a>
    : <Link href={resource.url} className={className} style={style}>{resource.title}</Link>;
}

function ResourceRow({ resource }: { resource: HubResource }) {
  return (
    <li className="py-2 text-[13.5px] leading-[1.45]" style={{ borderBottom: `1px solid ${ARC.border}`, breakInside: 'avoid' }}>
      <ResourceLink resource={resource} />
      <span className="block text-[11px]" style={{ color: ARC.faint, fontFamily: MONO }}>
        {resource.by}{resource.date && ` · ${resource.date}`}
      </span>
      <span className="block" style={{ color: ARC.dim }}>{resource.desc}</span>
    </li>
  );
}

function SectionHead({ id, title, count, blurb }: { id: string; title: string; count?: number; blurb?: string }) {
  return (
    <header className="mb-1 pb-2" style={{ borderBottom: `2px solid ${ARC.text}` }}>
      <h2 id={id} className="text-[24px] sm:text-[28px] font-bold leading-[1.15] tracking-[-.3px] scroll-mt-24">
        {title}{count !== undefined && <span className="ml-2 text-[13px] font-normal tabular-nums" style={{ color: ARC.faint, fontFamily: MONO }}>{count}</span>}
      </h2>
      {blurb && <p className="mt-1 text-[14px]" style={{ color: ARC.dim }}>{blurb}</p>}
    </header>
  );
}

function Directory({ section, needle }: { section: HubSection; needle: string }) {
  const items = needle ? section.items.filter((r) => matches(r, needle)) : section.items;
  if (!items.length) return null;
  return (
    <section className="mb-12">
      <SectionHead id={section.id} title={section.title} count={items.length} blurb={section.blurb} />
      <ul className="lg:columns-2 lg:gap-x-10">
        {items.map((resource) => <ResourceRow key={resource.url} resource={resource} />)}
      </ul>
    </section>
  );
}

export default function LandingPage() {
  usePageMeta({
    title: 'ARC-AGI-3 Resource Hub — walkthroughs, games, harnesses, papers | ARC Explainer',
    description: 'Human walkthroughs of every public ARC-AGI-3 game, games to play with no login, and the harnesses, winning write-ups, papers, datasets and tools, all in one place.',
    canonicalPath: '/home',
  });
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const { games, isLoading } = useApprovedGames();
  const human = ARC3_HUB_SECTIONS.find((s) => s.id === 'human')!;
  const play = ARC3_HUB_SECTIONS.find((s) => s.id === 'play')!;
  const rest = ARC3_HUB_SECTIONS.filter((s) => s !== human && s !== play);
  const found = useMemo(
    () => (needle ? ARC3_HUB_SECTIONS.reduce((sum, s) => sum + s.items.filter((r) => matches(r, needle)).length, 0) : TOTAL),
    [needle],
  );

  return (
    <div style={{ background: ARC.ground, color: ARC.text, fontFamily: SANS, minHeight: '100vh' }}>
      <section style={{ background: INK, color: '#F4F2F0' }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-5 pt-10 sm:pt-12 pb-8">
          <p className="text-[11px] tracking-[3px] uppercase mb-4" style={{ color: HOT, fontFamily: MONO }}>The ARC-AGI-3 Resource Hub</p>
          <h1 className="text-[36px] sm:text-[56px] leading-[1.03] font-bold tracking-[-1.2px] mb-5 max-w-[20ch]">
            Everything on ARC-AGI-3, in one place.
          </h1>
          <p className="text-[16px] leading-[1.6] max-w-[62ch] mb-6" style={{ color: '#C9C6C3' }}>
            Human walkthroughs of every public game. Games you can play right here, with no login.
            And every harness, winning write-up, paper, dataset and tool we could find, each one opened and checked.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px] mb-7">
            <a href="#walkthroughs" className="inline-block px-6 h-[44px] leading-[44px] font-semibold" style={{ background: HOT, color: '#fff' }}>Human walkthroughs ↓</a>
            <Link href="/play" className="inline-block px-6 h-[44px] leading-[44px] font-semibold" style={{ background: '#F4F2F0', color: INK }}>Play a game →</Link>
          </div>
          <label className="block max-w-[560px]">
            <span className="sr-only">Search every resource on this page</span>
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
                   placeholder={`Search ${TOTAL} resources and every game`}
                   className="w-full h-[44px] px-3 text-[15px] text-white placeholder:text-[#8E8B88]"
                   style={{ background: '#1F1E1D', border: '1px solid #4A4846' }} />
          </label>
          {needle && <p className="mt-2 text-[12px]" role="status" style={{ color: '#A8A5A2', fontFamily: MONO }}>{found} of {TOTAL} resources match. Matching games are in the table below.</p>}
        </div>
        {!needle && (
          <nav aria-label="Sections of this page" className="max-w-[1180px] mx-auto px-4 sm:px-5 pb-5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
            <a href="#walkthroughs" className="underline underline-offset-2">Walkthroughs</a>
            {[human, play, ...rest].map((s) => <a key={s.id} href={`#${s.id}`} className="underline underline-offset-2">{s.title}</a>)}
          </nav>
        )}
      </section>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-5 pt-10 pb-12">
        <section className="mb-12">
          <SectionHead id="walkthroughs" title="Human walkthroughs of every public game"
            blurb="Level-by-level guides written from real human play, with pictures, notes and rules. Beside each one: a person winning it, AI runs, the original build where we have it, and the game itself. These are full spoilers, so play first if you want to work it out yourself." />
          <WalkthroughTable filter={filter} />
        </section>

        <Directory section={human} needle={needle} />

        {!needle && (
          <section className="mb-12 -mx-4 sm:mx-0 px-4 sm:px-5 py-6" style={{ background: INK, color: '#F4F2F0' }}>
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
              <h2 className="text-[24px] sm:text-[28px] font-bold tracking-[-.3px]">Our games: pick one and play</h2>
              <Link href="/arc3/why" className="text-[13px] underline">Why we made them</Link>
            </div>
            <BoardWall games={games} loading={isLoading} columns="grid-cols-5 sm:grid-cols-8 lg:grid-cols-12" />
          </section>
        )}

        <Directory section={play} needle={needle} />
        {rest.map((section) => <Directory key={section.id} section={section} needle={needle} />)}

        <footer className="pt-4 text-[13px] flex flex-wrap gap-x-5 gap-y-1" style={{ color: ARC.dim, borderTop: `1px solid ${ARC.border}` }}>
          <span>Looking for the grid puzzles? <Link href="/arc2" className="underline">ARC-1 and ARC-2 resources</Link></span>
          <span>An independent community project. Official rules and releases: <a href="https://arcprize.org/" className="underline">ARC Prize</a></span>
        </footer>
      </div>
    </div>
  );
}
