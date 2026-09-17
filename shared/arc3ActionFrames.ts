/*
Author: Codex (GPT-6)
Date: 2026-09-16
PURPOSE: Presentation-only pixel animation for community games. Engine frames, action
counts and observations remain untouched. Native multi-frame sequences keep their order;
the 32 revised games use native intact-character frames. Legacy presentation for other
games remains scoped outside that set.
SRP/DRY check: Pass — pure frame-to-playback adapter shared with regression tests.
*/

import { canonicalGameId } from './arc3PublicIds';

const revisedGames = new Set('g009 g010 g011 g012 g013 g014 g015 g016 g017 g018 g019 g020 g021 g022 g024 g026 g027 g028 g034 g035 g036 g043 g044 g045 g046 g047 g050 g136 g155 g162 g171 g178'.split(' '));

export const usesNativeTranslation = (id: string | undefined): boolean => !!id && revisedGames.has(canonicalGameId(id));

export type PixelGrid = number[][];
export interface ActionPlayback { frames: PixelGrid[]; intervalMs: number }

const copy = (grid: PixelGrid): PixelGrid => grid.map(row => [...row]);

export function actionPlayback(
  before: PixelGrid | null,
  frames: PixelGrid[],
  animate: boolean,
  reducedMotion = false,
  nativeTranslation = false,
): ActionPlayback {
  const last = frames.at(-1);
  if (!last) return { frames: [], intervalMs: 0 };
  if (reducedMotion || !animate) return { frames: [last], intervalMs: 0 };
  if (frames.length > 1) {
    return { frames, intervalMs: Math.max(16, Math.min(nativeTranslation ? 40 : 65, 1200 / frames.length)) };
  }
  // Revised games supply real movement frames. Never scramble pixels, invent
  // trails or pulse the border for a blocked move, wait, or state-only action.
  if (nativeTranslation) return { frames: [last], intervalMs: 0 };
  if (!before || before.length !== last.length || before.some((r, y) => r.length !== last[y].length)) {
    return { frames: [last], intervalMs: 0 };
  }
  const height = last.length, width = last[0]?.length ?? 0;
  if (!width || !height) return { frames: [last], intervalMs: 0 };
  const changed: [number, number][] = [];
  const leaving = new Map<number, [number, number][]>();
  const arriving = new Map<number, [number, number][]>();
  const counts = new Map<number, number>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = before[y][x], b = last[y][x];
    counts.set(a, (counts.get(a) ?? 0) + 1);
    if (a === b) continue;
    changed.push([x, y]);
    if (!leaving.has(a)) leaving.set(a, []);
    if (!arriving.has(b)) arriving.set(b, []);
    leaving.get(a)!.push([x, y]);
    arriving.get(b)!.push([x, y]);
  }
  // Sparse colored pixels can travel. Large background changes use only the settle
  // transition; inferring object motion from a scrolling camera would be misleading.
  const trails: { from: [number, number]; to: [number, number]; colour: number }[] = [];
  if (changed.length <= width * height / 4) {
    for (const [colour, sources] of leaving) {
      if ((counts.get(colour) ?? 0) > width * height / 8 || sources.length > 96) continue;
      const targets = [...(arriving.get(colour) ?? [])];
      for (const from of sources) {
        if (trails.length >= 160 || !targets.length) break;
        let best = -1, distance = 257;
        for (let i = 0; i < targets.length; i++) {
          const d = (from[0] - targets[i][0]) ** 2 + (from[1] - targets[i][1]) ** 2;
          if (d < distance) { distance = d; best = i; }
        }
        if (best >= 0) trails.push({ from, to: targets.splice(best, 1)[0], colour });
      }
    }
  }
  const out: PixelGrid[] = [];
  for (let phase = 1; phase <= 4; phase++) {
    const grid = copy(before);
    const progress = phase / 5;
    for (const [x, y] of changed) {
      const threshold = ((x * 3 + y * 5) % 4 + 1) / 5;
      if (progress >= threshold) grid[y][x] = last[y][x];
    }
    for (const { from, to, colour } of trails) {
      const t = 1 - (1 - progress) ** 2;
      const x = Math.round(from[0] + (to[0] - from[0]) * t);
      const y = Math.round(from[1] + (to[1] - from[1]) * t);
      grid[y][x] = colour;
    }
    if (!changed.length && phase < 4) {
      // A small border pulse acknowledges waits/blocked moves without pretending the
      // underlying board changed. It disappears before input becomes available again.
      const inset = Math.min(phase, Math.floor((Math.min(width, height) - 1) / 2));
      const ink = last[0][0] === 0 ? 2 : 0;
      for (const [x, y] of [[inset, 0], [width - 1 - inset, 0], [inset, height - 1], [width - 1 - inset, height - 1]]) grid[y][x] = ink;
    }
    out.push(grid);
  }
  out.push(last); // Exact engine observation, never filtered or mutated.
  return { frames: out, intervalMs: 40 };
}
