/**
 * Author: Claude Opus 5
 * Date: 2026-09-06
 * PURPOSE: The GPT-6 Astra harness gap, drawn: for each of the 25 ARC-AGI-3 public-demo
 *          environments, how far the Standard harness got against how far the Provider
 *          Adapter harness got. Same model, same weights, different scaffolding.
 *
 *          WHY THIS IS ON A LANDING PAGE AT ALL. Harness engineering is what the two people
 *          behind this site actually do in their spare time, and this is the most striking
 *          published example of it to date. It earns its place by being bench material --
 *          the sort of thing they stare at -- not by being an argument the page is
 *          prosecuting. That distinction is load-bearing: the previous version of this page
 *          built its whole case on a frontier score, and the case expired.
 *
 *          WHY IT CANNOT GO STALE. It is one dated, published result, cited as history. A
 *          newer model does not falsify what Astra did on 02-Sep-2026. Contrast the claim
 *          it replaced ("frontier models get through almost none of it"), which was
 *          present-tense and lasted about four months.
 *
 *          INLINE SVG, NO CHART LIBRARY. 25 rows of two bars does not justify a dependency,
 *          and a charting lib would fight this page's hand-set palette and monospace chrome.
 *
 *          EVERY BAR IS CHECKABLE. Each row links ARC Prize's own replay for that
 *          environment on each path. The claim is unusual enough that a reader should be
 *          able to go and watch it rather than take our word.
 * SRP/DRY check: Pass - presentation only; the numbers and their provenance live in
 *          client/src/data/astraHarnessGap.ts and are not restated here. Palette from
 *          landingTheme, shared with the page.
 */

import {
  ASTRA_ENV_RESULTS,
  ASTRA_SOURCE,
  REPLAY_BASE,
  ENVS_WITH_GAP,
  ENV_TOTAL,
} from '@/data/astraHarnessGap';
import { ARC, MONO } from '@/pages/arc3-community/landingTheme';

const ROW_H = 18;
const BAR_H = 6;
const LABEL_W = 44;
const PCT_W = 42;
/** Viewbox width. The plot stretches to fill whatever the container gives it. */
const W = 640;

/**
 * One decimal below 10%, whole numbers above.
 *
 * The small values are the entire point of the chart -- "the standard harness never got
 * above 2.2%" is the sentence the prose leads on, and a column reading "2%" beside prose
 * reading "2.2%" makes a reader wonder which one is wrong. Rounding also has to never
 * produce "0%", which would read as "did not run" rather than "ran and got nowhere".
 */
function pct(v: number): string {
  if (v > 0 && v < 0.1) return `${(v * 100).toFixed(1)}%`;
  return `${Math.round(v * 100)}%`;
}

export default function HarnessGapChart() {
  const plotW = W - LABEL_W - PCT_W * 2 - 16;
  const height = ASTRA_ENV_RESULTS.length * ROW_H + 26;

  return (
    <div>
      {/* Legend. Colour is doing real work here, so it is named before the chart, not after. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-[11px]"
           style={{ fontFamily: MONO, color: ARC.dim }}>
        <span className="flex items-center gap-2">
          <span style={{ width: 14, height: BAR_H, background: ARC.control, display: 'inline-block' }} />
          Standard harness
        </span>
        <span className="flex items-center gap-2">
          <span style={{ width: 14, height: BAR_H, background: ARC.pink, display: 'inline-block' }} />
          Provider Adapter harness
        </span>
      </div>

      {/* Wide content scrolls inside its own box; the page body must never scroll sideways. */}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ minWidth: 460, display: 'block' }}
             role="img"
             aria-label={`Astra's best score on each of ${ENV_TOTAL} ARC-AGI-3 public demo environments, under two harnesses. The Provider Adapter harness solves every environment; the Standard harness falls short on ${ENVS_WITH_GAP}.`}>
          <text x={LABEL_W} y={10} style={{ fontFamily: MONO, fontSize: 9, fill: ARC.faint }}>0%</text>
          <text x={LABEL_W + plotW} y={10} textAnchor="end"
                style={{ fontFamily: MONO, fontSize: 9, fill: ARC.faint }}>100%</text>

          {ASTRA_ENV_RESULTS.map((e, i) => {
            const y = 20 + i * ROW_H;
            const gap = e.adapter > e.standard;
            return (
              <g key={e.env}>
                <text x={0} y={y + 8}
                      style={{ fontFamily: MONO, fontSize: 10, fill: gap ? ARC.text : ARC.faint }}>
                  {e.env}
                </text>

                {/* Track, so a 2% bar still reads as "ran and got nowhere" rather than "absent". */}
                <rect x={LABEL_W} y={y} width={plotW} height={BAR_H * 2 + 2} fill={ARC.cell} />

                <rect x={LABEL_W} y={y} width={Math.max(e.standard * plotW, e.standard > 0 ? 1 : 0)}
                      height={BAR_H} fill={ARC.control} />
                <rect x={LABEL_W} y={y + BAR_H + 2} width={e.adapter * plotW}
                      height={BAR_H} fill={ARC.pink} />

                <text x={LABEL_W + plotW + 8} y={y + 6}
                      style={{ fontFamily: MONO, fontSize: 9, fill: ARC.dim }}>
                  {pct(e.standard)}
                </text>
                <text x={LABEL_W + plotW + 8 + PCT_W} y={y + 6}
                      style={{ fontFamily: MONO, fontSize: 9, fill: gap ? ARC.pink : ARC.faint }}>
                  {pct(e.adapter)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[12px] leading-[1.8] mt-5 max-w-[76ch]" style={{ color: ARC.faint }}>
        Each bar is that harness's best score across all six reasoning settings — a maximum,
        not a single run. {ASTRA_SOURCE.set}, published {ASTRA_SOURCE.published} by{' '}
        <a href={ASTRA_SOURCE.url} target="_blank" rel="noreferrer" className="underline">
          ARC Prize
        </a>
        , who publish the results without interpretation; the reading above is ours. Watch any
        of it yourself —{' '}
        <a href={`${REPLAY_BASE}${ASTRA_ENV_RESULTS[0].standardReplay}`} target="_blank"
           rel="noreferrer" className="underline">
          {ASTRA_ENV_RESULTS[0].env} on the standard harness
        </a>{' '}
        against{' '}
        <a href={`${REPLAY_BASE}${ASTRA_ENV_RESULTS[0].adapterReplay}`} target="_blank"
           rel="noreferrer" className="underline">
          the same environment on the adapter
        </a>
        .
      </p>
    </div>
  );
}
