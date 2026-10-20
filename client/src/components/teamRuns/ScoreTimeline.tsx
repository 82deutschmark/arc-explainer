/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: The team's ARC-AGI-2 public scores over time, for the runs screen: one dot per
 *          scored submission, coloured by who submitted it, and a stepped line for the team best
 *          so far. Hover shows the run; click opens it. Failed submissions have no score to
 *          place, so they aren't drawn. Styled for the dark terminal screen (terminal.tsx).
 * SRP/DRY check: Pass - drawing only; data is the list's rows. Recharts, as the site's other
 *          charts use (rearc/EfficiencyPlot.tsx).
 */

import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { scoreText, type RunRow } from './teamRunsApi';
import { scored } from './runStats';
import { PERSON_PALETTE, T, personCode, stamp } from './terminal';

interface Point { t: number; score: number; run: RunRow }

const day = (t: number) => new Date(t).toISOString().slice(5, 10);

export function personColors(rows: RunRow[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.who, (counts.get(r.who) ?? 0) + 1);
  const people = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([who]) => who);
  return new Map(people.map((who, i) => [who, PERSON_PALETTE[i % PERSON_PALETTE.length]]));
}

export function ScoreTimeline({ rows, colors, height = 210 }: { rows: RunRow[]; colors: Map<string, string>; height?: number }) {
  const [, navigate] = useLocation();
  const { byPerson, bestLine } = useMemo(() => {
    const points: Point[] = rows.filter(scored).map((run) => ({ t: Date.parse(run.submittedAt), score: run.publicScore!, run }))
      .sort((a, b) => a.t - b.t);
    const by = new Map<string, Point[]>();
    for (const p of points) by.set(p.run.who, [...(by.get(p.run.who) ?? []), p]);
    let best = -Infinity;
    const line = points.map((p) => ({ t: p.t, best: (best = Math.max(best, p.score)) }));
    return { byPerson: by, bestLine: line };
  }, [rows]);

  if (!bestLine.length) return <div className="p-2" style={{ color: T.dim }}>No scored submissions in view.</div>;

  return (
    <div className="px-1 pt-1">
      <div className="flex flex-wrap gap-x-3 px-1 text-[11px]" style={{ color: T.dim }}>
        {[...byPerson.keys()].map((who) => (
          <span key={who}><span style={{ color: colors.get(who) }}>●</span> {personCode(who)}</span>
        ))}
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
                  <div><b>{scoreText(p.score)}</b> {personCode(p.run.who)} {stamp(p.run.submittedAt)}Z</div>
                  <div className="mt-0.5 line-clamp-3" style={{ color: T.dim }}>{p.run.description}</div>
                </div>
              );
            }}
          />
          <Line data={bestLine} dataKey="best" type="stepAfter" dot={false} isAnimationActive={false} stroke={T.amber} strokeWidth={1.25} />
          {[...byPerson.entries()].map(([who, pts]) => (
            <Scatter key={who} data={pts} dataKey="score" fill={colors.get(who)} isAnimationActive={false} cursor="pointer"
                     shape={(props: { cx?: number; cy?: number; fill?: string }) => <circle cx={props.cx} cy={props.cy} r={2.6} fill={props.fill} />}
                     onClick={(d: { payload?: Point }) => d.payload && navigate(`/team/arc2-runs/${d.payload.run.key}`)} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
