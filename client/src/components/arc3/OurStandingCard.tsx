/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: Our live placing on the ARC-AGI-3 Kaggle public leaderboard, for the hero of the
 *          arc3 landing page: rank out of the field, score, the change over the past week,
 *          how far to the next medal line, and our best placing ever, with when each was read.
 *          Replaces KaggleStanding (2026-09-06), which read a once-a-day single-team push;
 *          this reads the full board the leaderboard page uses, saved every half hour.
 *
 *          THE RULES KaggleStanding was written to enforce still hold, because the bug they
 *          fix is this page's oldest one ("we are currently fifth", three weeks stale):
 *          1. No rank without its date. The read time sits directly under the numbers.
 *          2. Stop talking when the data stops. Past STALE_HOURS the current rank is hidden
 *             and only the best-ever placing (history, which cannot go stale) remains.
 *          3. "Public leaderboard", always. Medals are settled on the private board.
 *          Renders nothing if the board never loaded; the hero prose stands without it.
 * SRP/DRY check: Pass - display only. Data from useKaggleBoard (passed in) and
 *          computeOurs in storyData.ts; palette from landingTheme like the rest of the page.
 */

import { ARC, MONO, formatCaptureDate } from '@/pages/arc3-community/landingTheme';
import { KAGGLE_URL, ago, fmt, type BoardModel, type Medal } from '@/components/kaggleLeaderboard/boardData';
import { computeOurs } from '@/components/kaggleLeaderboard/storyData';

/** Two missed half-hourly saves is a hiccup; two days is something broken. */
const STALE_HOURS = 48;

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-[34px] font-bold leading-none" style={{ color: ARC.text }}>{value}</div>
      <div className="mt-1.5 text-[11px] tracking-[.4px]" style={{ color: ARC.faint, fontFamily: MONO }}>{label}</div>
    </div>
  );
}

export default function OurStandingCard({ model, loading }: { model: BoardModel | null; loading: boolean }) {
  if (loading) {
    return <div className="h-[220px] animate-pulse" style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }} />;
  }
  if (!model) return null;
  const ours = computeOurs(model);
  if (!ours) return null;

  const { row, weekAgo, best } = ours;
  const fresh = Date.now() - Date.parse(model.latest.fetched) < STALE_HOURS * 3600e3;
  const mr = model.latest.medalRanks;
  const next = (['bronze', 'silver', 'gold'] as Medal[]).find((m) => row[0] > mr[m]);
  const nextLine = next ? model.latest.rows[mr[next] - 1][4] : null;
  const medal = model.medalOf(row[0]);
  const moved = weekAgo ? weekAgo[2] - row[0] : null;

  return (
    <div className="p-6" style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
      <div className="mb-4 text-[11px] uppercase tracking-[2px]" style={{ color: ARC.pink, fontFamily: MONO }}>
        Where we stand
      </div>
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        {fresh && <Figure value={ordinal(row[0])} label={`of ${model.latest.teams.toLocaleString()} teams`} />}
        {fresh && <Figure value={fmt(row[4])} label="our score" />}
        {best && best[2] < row[0] && <Figure value={ordinal(best[2])} label="our best so far" />}
      </div>
      {fresh && (
        <div className="mt-5 space-y-1 text-[14px] leading-[1.6]" style={{ color: ARC.dim }}>
          {moved != null && moved !== 0 && (
            <p>
              <strong style={{ color: ARC.text }}>{moved > 0 ? `Up ${moved}` : `Down ${-moved}`} places</strong> in the past week.
            </p>
          )}
          {medal ? (
            <p>Inside the {medal} zone on the public board right now.</p>
          ) : (
            next && nextLine != null && (
              <p>
                <strong style={{ color: ARC.text }}>{fmt(nextLine - row[4])} points</strong> short of the {next} line, with{' '}
                {(row[0] - mr[next]).toLocaleString()} teams to pass.
              </p>
            )
          )}
        </div>
      )}
      <p className="mt-4 text-[12px] leading-[1.7]" style={{ color: ARC.faint }}>
        {fresh ? (
          <>Public leaderboard, read {ago(model.latest.fetched)}. </>
        ) : (
          <>We haven't been able to read the leaderboard recently, so our current place isn't shown. </>
        )}
        {best && <>Best placing {formatCaptureDate(best[0])}. </>}
        Medals are decided on the private board at the close.{' '}
        <a href={KAGGLE_URL} target="_blank" rel="noreferrer" className="underline">Check it on Kaggle</a>.
      </p>
    </div>
  );
}
