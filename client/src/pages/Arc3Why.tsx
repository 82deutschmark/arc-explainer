/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: /arc3/why. The Boss's write-up on why the synthetic games exist, with the games right
         under it so a reader can go straight from the words to playing. Text in
         shared/Arc3WhyContent; games from components/arc3/SyntheticGames.
Updated: 2026-11-02, Claude Opus 5.5 High - the picks as the dense card grid, click for rules.
SRP/DRY check: Pass - composition only.
*/
import { Link } from 'wouter';
import Arc3WhyContent from '@shared/Arc3WhyContent';
import { BoardWall, INK, PickGrid, REPO_URL, WRITEUP_URL, useApprovedGames, usePicks } from '@/components/arc3/SyntheticGames';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Arc3Why() {
  usePageMeta({
    title: "Slop, constraints, and a person in the loop | ARC Explainer",
    description: 'After Budd and Scarfe: why most of our synthetic ARC-AGI-3 games were slop, and why the forty-six we kept were played and reworked by people.',
    canonicalPath: '/arc3/why',
  });
  const { games, isLoading } = useApprovedGames();
  const picks = usePicks(games);
  return (
    <div style={{ background: '#FFFFFF', color: '#111111' }}>
      <div className="max-w-[720px] mx-auto px-4 sm:px-5 pt-10 sm:pt-14 pb-12">
        <Arc3WhyContent />
      </div>
      <section style={{ background: INK, color: '#F4F2F0' }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-5 py-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6">
            <h2 className="text-[28px] font-bold tracking-[-.3px]">Play them</h2>
            <Link href="/play" className="px-5 py-2.5 text-[13px] font-semibold text-white" style={{ background: '#E53AA3' }}>Give me a game →</Link>
          </div>
          {picks.length > 0 && <div className="mb-8"><PickGrid picks={picks} /></div>}
          <h3 className="text-[11px] tracking-[2.5px] uppercase mb-3">Every approved game</h3>
          <BoardWall games={games} loading={isLoading} columns="grid-cols-5 sm:grid-cols-8 lg:grid-cols-12" />
          <p className="mt-8 text-[13px]" style={{ color: '#A8A5A2' }}>
            <Link href="/home" className="underline">ARC-3 resource hub</Link>
            <span className="mx-2 opacity-50">·</span>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline">Python source, MIT</a>
            <span className="mx-2 opacity-50">·</span>
            <a href={WRITEUP_URL} target="_blank" rel="noreferrer" className="underline">The same games on GitHub Pages</a>
          </p>
        </div>
      </section>
    </div>
  );
}
