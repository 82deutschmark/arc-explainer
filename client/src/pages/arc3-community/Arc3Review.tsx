/*
Author: Claude Opus 5
Date: 2026-08-31
PURPOSE: /arc3/review — the front door for working through the generated set. Picks the
         highest-ranked task nobody has played and sends you straight into it.

         WHY A ROUTE AND NOT A BUTTON ON THE GALLERY. The gallery is 877 tiles behind
         category chips and pagination, which is the right shape for browsing and the
         wrong one for a sitting where the job is "go through them". Reviewing needs one
         URL that resumes where the set left off, so it can be bookmarked, shared with
         somebody else who agreed to help, and reopened tomorrow without re-deciding
         where to start.

         It resolves and redirects rather than rendering a list on purpose: a list is one
         more decision between a reviewer and a task, and the ordering already encodes
         the decision.
SRP/DRY check: Pass — resolution and redirect only. The ordering lives server-side in
         Arc3Triage, and playing lives in CommunityGamePlay; this owns neither.
*/

import { useEffect, useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';

const ARC = {
  ground: '#0a0a0c', text: '#e8e6e3', dim: '#8b8a87', faint: '#5a5957', pink: '#e0218a',
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

interface ReviewEntry { gameId: string; status: string; rank?: number }
interface ReviewTotals { probed: number; queued: number; duplicate: number; weak: number }

export default function Arc3Review() {
  const [, setLocation] = useLocation();

  const { data: review, isLoading, isError } = useQuery<{
    data: { games: ReviewEntry[]; totals: ReviewTotals; method: string };
  }>({ queryKey: ['/api/arc3-mirror/review-queue'], staleTime: 60 * 60 * 1000 });

  /** Played by anyone, not just this browser: coverage of the set is what matters here,
   *  and a second reviewer should be handed something the first has not already seen. */
  const { data: stats, isLoading: statsLoading } = useQuery<{
    data: { games: { game_id: string }[] };
  }>({ queryKey: ['/api/arc3-play/human-stats'], staleTime: 60 * 1000 });

  const target = useMemo(() => {
    const queue = review?.data?.games ?? [];
    if (queue.length === 0) return null;
    const played = new Set((stats?.data?.games ?? []).map((g) => g.game_id));
    return (queue.find((g) => !played.has(g.gameId)) ?? queue[0]).gameId;
  }, [review, stats]);

  useEffect(() => {
    if (target) setLocation(`/arc3/play/${target}`, { replace: true });
  }, [target, setLocation]);

  const totals = review?.data?.totals;
  const waiting = isLoading || statsLoading;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 px-6"
         style={{ background: ARC.ground, color: ARC.text, fontFamily: MONO }}>
      {waiting && <p className="text-[13px]" style={{ color: ARC.dim }}>Finding the next task…</p>}

      {isError && (
        <>
          <p className="text-[13px]" style={{ color: ARC.text }}>The review queue is unavailable.</p>
          <Link href="/arc3/gallery">
            <a className="text-[12px] underline" style={{ color: ARC.pink }}>Browse all tasks instead</a>
          </Link>
        </>
      )}

      {!waiting && !isError && !target && (
        <>
          <p className="text-[13px]">Nothing left in the queue.</p>
          <Link href="/arc3/gallery">
            <a className="text-[12px] underline" style={{ color: ARC.pink }}>Browse all tasks</a>
          </Link>
        </>
      )}

      {totals && (
        <p className="text-[11px] text-center max-w-[420px]" style={{ color: ARC.faint }}>
          {totals.queued} of {totals.probed} generated tasks are worth playing.
          {' '}{totals.duplicate} are near-copies of another and {totals.weak} fall over to
          random input, so neither is in the queue.
        </p>
      )}
    </div>
  );
}
