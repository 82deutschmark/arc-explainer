/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: The team's ARC-AGI-2 public scores over time, for the runs screen: one dot per
 *          scored submission and a stepped line for the team best so far (new team bests in
 *          green). Not coloured by submitter: that's only whose Kaggle account carried it. Hover shows the run; click opens it. Failed submissions have no score to
 *          place, so they aren't drawn. Styled for the dark terminal screen (terminal.tsx).
 * SRP/DRY check: Pass - drawing only; data is the list's rows. Recharts, as the site's other
 *          charts use (rearc/EfficiencyPlot.tsx).
 */

import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { scoreText, type RunRow } from './teamRunsApi';
import { scored } from './runStats';
import { T, stamp } from './terminal';

interface Point { t: number; score: number; run: RunRow }

const day = (t: number) => new Date(t).toISOString().slice(5, 10);

export function ScoreTimeline({ rows, height = 210 }: { rows: RunRow[]; height?: number }) {
  const [, navigate] = useLocation();
  const { others, bests, bestLine } = useMemo(() => {
    const points: Point[] = rows.filter(scored).map((run) => ({ t: Date.parse(run.submittedAt), score: run.publicScore!, run }))
      .sort((a, b) => a.t - b.t);
    let best = -Infinity;
    const top: Point[] = [];
    const rest: Point[] = [];
    const line = points.map((p) => {
      (p.score > best ? top : rest).push(p);
      best = Math.max(best, p.score);
      return { t: p.t, best };
    });
    return { others: rest, bests: top, bestLine: line };
  }, [rows]);

  if (!bestLine.length) return <div className="p-2" style={{ color: T.dim }}>No scored submissions in view.</div>;

  return (
    <div className="px-1 pt-1">
      <div className="flex flex-wrap gap-x-3 px-1 text-[11px]" style={{ color: T.dim }}>
        <span><span style={{ color: T.link }}>●</span> SUBMISSION</span>
        <span><span style={{ color: T.up }}>●</span> NEW TEAM BEST</span>
        <span><span style={{ color: T.amber }}>━</span> TEAM BEST</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={T.rule} strokeDasharray="1 3" />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={day}
                 tick={{ fontSize: 10, fill: T.dim, fontFamily: T.mono }} stroke={T.rule} />
          <YAxis dataKey="score" type="number" domain={[0, 'auto']} width={42}
                 tick={{ fontSize: 10, fill: T.dim, fontFamily: T.mono }} stroke={T.rule} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
              if (!p?.run) return null;
              return (
                <div className="max-w-[340px] p-1.5 text-[11px]" style={{ background: T.bg, border: `1px solid ${T.amber}`, color: T.text, fontFamily: T.mono }}>
                  <div><b>{scoreText(p.score)}</b> {stamp(p.run.submittedAt)}Z</div>
                  <div className="mt-0.5 line-clamp-3" style={{ color: T.dim }}>{p.run.description}</div>
                </div>
              );
            }}
          />
          <Line data={bestLine} dataKey="best" type="stepAfter" dot={false} isAnimationActive={false} stroke={T.amber} strokeWidth={1.25} />
          {([[others, T.link, 2.4], [bests, T.up, 3.4]] as const).map(([pts, fill, r]) => (
            <Scatter key={fill} data={pts} dataKey="score" fill={fill} isAnimationActive={false} cursor="pointer"
                     shape={(props: { cx?: number; cy?: number }) => <circle cx={props.cx} cy={props.cy} r={r} fill={fill} />}
                     onClick={(d: { payload?: Point }) => d.payload && navigate(`/team/arc2-runs/${d.payload.run.key}`)} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
