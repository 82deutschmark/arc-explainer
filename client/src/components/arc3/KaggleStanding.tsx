/**
 * Author: Claude Opus 5
 * Date: 2026-09-06
 * PURPOSE: Our live standing on the public ARC Prize 2026 Kaggle leaderboard, for the arc3
 *          landing page.
 *
 *          THE BUG THIS COMPONENT IS. The page previously said "On the ARC Prize 2026
 *          competition leaderboard we are currently fifth" as literal text in JSX. True
 *          when written on 16-Aug-2026; by 06-Sep-2026 we were ninth, and the sentence
 *          beside it naming the team one place ahead had also gone wrong. Any reader could
 *          check both in ten seconds. Every rule below exists to stop that recurring.
 *
 *          RULE 1 -- NO RANK WITHOUT ITS DATE. There is no branch here that renders a
 *          placing without rendering when it was measured. The type makes this hard to get
 *          wrong (capturedAt is non-optional on every observation) and this component
 *          finishes the job.
 *
 *          RULE 2 -- STOP TALKING WHEN THE DATA STOPS. Past the server's staleness window
 *          the present-tense claim disappears entirely and only the peak is shown, which is
 *          history and cannot rot. A page that says "currently ninth" from a reading three
 *          weeks old is exactly the original failure wearing a timestamp.
 *
 *          RULE 3 -- "PUBLIC LEADERBOARD", ALWAYS. Kaggle medals are decided on the PRIVATE
 *          board when the competition closes. A public position is a standing, not a
 *          result, and saying otherwise is the same species of overclaim as the summit
 *          poster line that was cut from this page.
 *
 *          RULE 4 -- NO POLLING. The upstream job runs once a day. A ticking refetch would
 *          imply a liveness we do not have; staleTime matches the page's other queries.
 *
 *          RENDERS NOTHING when there is no data and nothing has ever been recorded. The
 *          surrounding prose is written to stand on its own, so an unpopulated database or
 *          a failed request costs the page a fact, never a hole or an error box.
 * SRP/DRY check: Pass - display only. The standing, its peak and the staleness decision are
 *          all computed server-side in KaggleStandingRepository, so the client cannot reach
 *          a different verdict than the API. Palette from landingTheme, shared with the page.
 */

import { useQuery } from '@tanstack/react-query';
import type { KaggleStanding as KaggleStandingData } from '@shared/types';
import { ARC, MONO, formatCaptureDate } from '@/pages/arc3-community/landingTheme';

/** The ARC-AGI-3 competition on Kaggle. */
export const ARC3_COMPETITION = 'arc-prize-2026-arc-agi-3';

const LEADERBOARD_URL =
  'https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/leaderboard';

interface StandingResponse {
  success: boolean;
  data: KaggleStandingData;
}

/** "9th", "1st", "22nd". */
function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-[28px] leading-none font-bold" style={{ color: ARC.text }}>{value}</div>
      <div className="text-[11px] mt-1.5 tracking-[.4px]" style={{ color: ARC.faint, fontFamily: MONO }}>
        {label}
      </div>
    </div>
  );
}

export default function KaggleStanding() {
  const { data, isLoading } = useQuery<StandingResponse>({
    queryKey: [`/api/kaggle/${ARC3_COMPETITION}/standing`],
    staleTime: 5 * 60 * 1000,
  });

  const standing = data?.data;
  const current = standing?.current ?? null;
  const peak = standing?.peak ?? null;

  // A skeleton that reserves the real height, so the paragraph below it does not jump when
  // the standing lands. Same reasoning as the tile grid's fixed aspect ratio.
  if (isLoading) {
    return (
      <div className="h-[86px] animate-pulse"
           style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }} />
    );
  }

  // Nothing recorded, or the request failed. Say nothing rather than showing an empty box:
  // the prose around this component never depends on it having rendered.
  if (!current && !peak) return null;

  // Past the staleness window the current rank is no longer assertable. Peak survives,
  // because "the best we have placed" is a fact about the past.
  const showCurrent = current !== null && !standing?.isStale;

  return (
    <div className="p-5" style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        {showCurrent && current && (
          <Figure
            value={ordinal(current.rank)}
            label={current.teamCount ? `of ${current.teamCount.toLocaleString()} teams` : 'current'}
          />
        )}
        {peak && (
          <Figure value={ordinal(peak.rank)} label="our best so far" />
        )}
      </div>

      {/* The dates. Not a footnote -- this is the part that keeps the numbers above honest,
          so it sits directly under them and is never collapsed into a tooltip. */}
      <p className="text-[12px] leading-[1.7] mt-4" style={{ color: ARC.faint }}>
        {showCurrent && current ? (
          <>Public leaderboard, read {formatCaptureDate(current.capturedAt)}. </>
        ) : (
          <>
            We have not been able to read the public leaderboard recently, so the current
            position is not shown.{' '}
          </>
        )}
        {peak && <>Best placing {formatCaptureDate(peak.capturedAt)}. </>}
        <a href={LEADERBOARD_URL} target="_blank" rel="noreferrer" className="underline">
          Check it yourself
        </a>
        .
      </p>
    </div>
  );
}
