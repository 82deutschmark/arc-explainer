/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: A readable medal race: cutoff summaries, a gold-boundary focus by default,
 *          wider rank views, and exact scores without a clipped ceiling. Responsive SVG
 *          coordinates keep labels at normal text size on phones. Pointer, touch and
 *          keyboard inspection share a detail panel outside the plot.
 * SRP/DRY check: Pass — reads BoardModel; reuses medal colors, team links, chart math and
 *          shadcn controls. Shared ChartFrame remains unchanged for other charts.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { niceTicks, polyPoints } from './ChartFrame';
import { MEDAL_COLOR, US_COLOR, fmt, type BoardModel, type Medal } from './boardData';
import { TeamName } from './TeamName';
import { medalBoundary, medalRaceWindow, nearestRankIndex, rankTickValues, type MedalRaceView } from './medalRaceData';

const HEIGHT = 280;
const PAD = { left: 44, right: 14, top: 14, bottom: 34 };
const MEDALS: Medal[] = ['gold', 'silver', 'bronze'];
const VIEWS: Array<[MedalRaceView, string]> = [['gold', 'Gold race'], ['medals', 'Medal field'], ['all', 'Full board']];

export function MedalRaceChart({ model }: { model: BoardModel }) {
  const [view, setView] = useState<MedalRaceView>('gold');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [width, setWidth] = useState(760);
  const plotRef = useRef<HTMLDivElement>(null);
  const instructionsId = useId();
  const { latest } = model;
  const window = useMemo(() => medalRaceWindow(latest, view), [latest, view]);

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(1, Math.round(element.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [!!window]);

  if (!window) return <p className="text-sm text-muted-foreground">No ranked scores are available in this snapshot.</p>;

  const { rows, shown, rankMin, rankMax, scoreMin, scoreMax } = window;
  const gold = medalBoundary(rows, latest.medalRanks.gold);
  const selectedIndex = shown.findIndex((row) => row[1] === selectedId);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : nearestRankIndex(shown, latest.medalRanks.gold);
  const active = shown[activeIndex];
  const pinnedIds = new Set(model.pinnedRows.map((row) => row[1]));
  const plotRight = width - PAD.right;
  const plotBottom = HEIGHT - PAD.bottom;
  const plotWidth = Math.max(1, plotRight - PAD.left);
  const x = (rank: number) => PAD.left + (rank - rankMin) / (rankMax - rankMin) * plotWidth;
  const y = (score: number) => PAD.top + (scoreMax - score) / (scoreMax - scoreMin) * (plotBottom - PAD.top);
  const clampX = (rank: number) => Math.max(PAD.left, Math.min(plotRight, x(rank)));
  const scoreTicks = niceTicks(scoreMin, scoreMax, 5);
  const rankTicks = rankTickValues(shown[0][0], shown[shown.length - 1][0], width < 500 ? 4 : 7);
  const stair: Array<[number, number]> = shown.flatMap((row) => [[x(row[0] - 0.5), y(row[4])], [x(row[0] + 0.5), y(row[4])]]);
  const area = [...stair, [x(rankMax), plotBottom], [x(rankMin), plotBottom]] as Array<[number, number]>;
  const medal = model.medalOf(active[0]);
  const activeColor = pinnedIds.has(active[1]) ? US_COLOR : 'var(--foreground)';

  const selectIndex = (index: number) => setSelectedId(shown[Math.max(0, Math.min(shown.length - 1, index))][1]);
  const inspectPointer = (event: PointerEvent<SVGRectElement>) => {
    if (!plotRef.current) return;
    const box = plotRef.current.getBoundingClientRect();
    const gx = (event.clientX - box.left) * width / box.width;
    selectIndex(nearestRankIndex(shown, rankMin + (gx - PAD.left) / plotWidth * (rankMax - rankMin)));
  };
  const inspectKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? shown.length - 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? activeIndex - 1
        : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? activeIndex + 1 : null;
    if (index !== null) { event.preventDefault(); selectIndex(index); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 border-b pb-3">
        {MEDALS.map((name) => {
          const row = medalBoundary(rows, latest.medalRanks[name]).cutoff;
          return (
            <div key={name} className="min-w-0 border-l-[3px] pl-2.5" style={{ borderColor: MEDAL_COLOR[name] }}>
              <div className="min-h-8 text-xs font-medium capitalize sm:min-h-0">{name} cutoff</div>
              <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums sm:text-2xl">{row ? fmt(row[4]) : '—'}</div>
              <div className="text-xs text-muted-foreground">rank #{latest.medalRanks[name].toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(value) => {
          if (value) { setView(value as MedalRaceView); setSelectedId(null); }
        }} aria-label="Medal race rank range" className="grid w-full grid-cols-3 gap-0 sm:flex sm:w-auto">
          {VIEWS.map(([value, label]) => <ToggleGroupItem key={value} value={value} className="h-11 min-w-0 rounded-none px-2 text-xs first:rounded-l-md last:rounded-r-md sm:px-3 sm:text-sm">{label}</ToggleGroupItem>)}
        </ToggleGroup>
        <span className="text-xs text-muted-foreground">{shown.length.toLocaleString()} teams in view</span>
      </div>

      <p className="text-sm leading-relaxed">
        {gold.gap != null && gold.outside && gold.cutoff ? (
          gold.gap > 0 ? <><strong className="font-mono tabular-nums">{fmt(gold.gap)} points</strong> separate #{gold.cutoff[0]} and #{gold.outside[0]} at the gold cutoff.</>
            : gold.gap === 0 ? <>The teams at #{gold.cutoff[0]} and #{gold.outside[0]} are <strong>tied on score</strong> at the gold cutoff. Their ranks determine the displayed zone.</>
              : <>The gold-boundary scores are out of rank order in this snapshot.</>
        ) : <>The gold cutoff is rank #{latest.medalRanks.gold}; both boundary scores are not available in this snapshot.</>}
      </p>

      <div>
        <div className="mb-1 flex justify-between gap-3 text-xs text-muted-foreground">
          <span>Score · points</span>
          <span>Ranks {shown[0][0].toLocaleString()}–{shown[shown.length - 1][0].toLocaleString()}</span>
        </div>
        <div ref={plotRef} role="slider" tabIndex={0} aria-label="Inspect teams by rank"
          aria-orientation="horizontal" aria-valuemin={shown[0][0]} aria-valuemax={shown[shown.length - 1][0]}
          aria-valuenow={active[0]} aria-valuetext={`Rank ${active[0]}, ${active[2]}, ${fmt(active[4])} points${medal ? `, ${medal} zone` : ''}`}
          aria-describedby={instructionsId} onKeyDown={inspectKeyboard}
          className="min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" height={HEIGHT} aria-hidden="true" className="block overflow-hidden">
            {MEDALS.map((name, index) => {
              const start = index === 0 ? 0.5 : latest.medalRanks[MEDALS[index - 1]] + 0.5;
              const end = latest.medalRanks[name] + 0.5;
              const boundary = medalBoundary(rows, latest.medalRanks[name]).cutoff;
              return <g key={name}>
                <rect x={clampX(start)} y={PAD.top} width={Math.max(0, clampX(end) - clampX(start))} height={plotBottom - PAD.top} fill={MEDAL_COLOR[name]} opacity={0.09} />
                {end > rankMin && end < rankMax && <line x1={x(end)} x2={x(end)} y1={PAD.top} y2={plotBottom} stroke={MEDAL_COLOR[name]} strokeWidth={1.5} />}
                {boundary && boundary[4] >= scoreMin && boundary[4] <= scoreMax && <line x1={PAD.left} x2={plotRight} y1={y(boundary[4])} y2={y(boundary[4])} stroke={MEDAL_COLOR[name]} strokeDasharray="4 4" strokeOpacity={0.65} />}
              </g>;
            })}
            {scoreTicks.map((value) => <g key={value}>
              <line x1={PAD.left} x2={plotRight} y1={y(value)} y2={y(value)} stroke="var(--border)" strokeOpacity={0.7} />
              <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" fontSize={12} fill="var(--muted-foreground)">{Number(value.toFixed(3))}</text>
            </g>)}
            <polygon points={polyPoints(area)} fill="var(--foreground)" opacity={0.035} />
            <polyline points={polyPoints(stair)} fill="none" stroke="var(--foreground)" strokeOpacity={0.8} strokeWidth={1.8} strokeLinejoin="round" />
            {shown.length <= 60 && shown.map((row) => <circle key={row[1]} cx={x(row[0])} cy={y(row[4])} r={2.5} fill="var(--foreground)" />)}
            {shown.filter((row) => pinnedIds.has(row[1])).map((row) => <circle key={row[1]} cx={x(row[0])} cy={y(row[4])} r={4.5} fill="var(--card)" stroke={US_COLOR} strokeWidth={2} />)}
            <line x1={x(active[0])} x2={x(active[0])} y1={PAD.top} y2={plotBottom} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeOpacity={0.6} />
            <circle cx={x(active[0])} cy={y(active[4])} r={5} fill={activeColor} stroke="var(--card)" strokeWidth={2} />
            {rankTicks.map((rank, index) => <text key={rank} x={x(rank)} y={HEIGHT - 10}
              textAnchor={index === 0 ? 'start' : index === rankTicks.length - 1 ? 'end' : 'middle'}
              fontSize={12} fill="var(--muted-foreground)">#{rank.toLocaleString()}</text>)}
            <rect x={PAD.left} y={PAD.top} width={plotWidth} height={plotBottom - PAD.top} fill="transparent"
              style={{ touchAction: 'pan-y' }} onPointerDown={inspectPointer}
              onPointerMove={(event) => { if (event.pointerType === 'mouse' || event.buttons > 0) inspectPointer(event); }} />
          </svg>
        </div>
      </div>

      <div className="flex min-h-[76px] items-center gap-3 rounded-md border bg-muted/25 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs text-muted-foreground">#{active[0].toLocaleString()} · {medal ? `${medal} zone` : 'outside medal zones'}{pinnedIds.has(active[1]) && ' · pinned'}</div>
          <TeamName row={active} className="break-words text-sm font-semibold" />
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg font-semibold tabular-nums">{fmt(active[4])}</div>
          <div className="text-xs text-muted-foreground">{active[5].toLocaleString()} submissions</div>
        </div>
        <div className="hidden gap-1 sm:flex">
          <Button type="button" variant="outline" size="icon" disabled={activeIndex === 0} onClick={() => selectIndex(activeIndex - 1)} aria-label="Inspect previous team"><ChevronLeft /></Button>
          <Button type="button" variant="outline" size="icon" disabled={activeIndex === shown.length - 1} onClick={() => selectIndex(activeIndex + 1)} aria-label="Inspect next team"><ChevronRight /></Button>
        </div>
      </div>

      <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <p id={instructionsId}>Hover or tap the chart to inspect a team. With the chart focused, use the arrow keys; Home and End jump to the edges.</p>
        <p>
          {shown[0][0] > rows[0][0] && <>Ranks {rows[0][0]}–{shown[0][0] - 1} are above this view. Leader: <TeamName row={rows[0]} /> ({fmt(rows[0][4])} points). </>}
          {shown[shown.length - 1][0] < rows[rows.length - 1][0] && <>Ranks {(shown[shown.length - 1][0] + 1).toLocaleString()}–{rows[rows.length - 1][0].toLocaleString()} are below this view. </>}
          {shown.length < rows.length ? <>Choose Full board to see all {rows.length.toLocaleString()} recorded teams. </> : <>All {rows.length.toLocaleString()} recorded teams are shown. </>}
          The score axis adjusts to each view.
        </p>
        {model.pinnedRows.length > 0 && <p><span className="mr-1 inline-block h-2 w-2 rounded-full border-2 align-middle" style={{ borderColor: US_COLOR }} />Pinned: {model.pinnedRows.map((row, i) => <span key={row[1]}>{i > 0 && '; '}<TeamName row={row} /> #{row[0]} · {fmt(row[4])}{!shown.some((shownRow) => shownRow[1] === row[1]) && ' (outside this view)'}</span>)}.</p>}
      </div>
    </div>
  );
}
