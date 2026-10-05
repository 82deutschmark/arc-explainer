/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: The visitor's starred teams for the leaderboard page. Kept in this browser's
 *          localStorage (a per-visitor convenience; nothing is shared or sent anywhere).
 *          Until a visitor stars anything, the list defaults to the top three, the team on
 *          the gold line, and the teams either side of ours, so the "Teams we are watching" chart is never empty.
 *          Shared by the watch chart (removing) and the table (starring), so it lives in
 *          the page and is passed down.
 * SRP/DRY check: Pass - the only place the watchlist is read or written.
 */

import { useCallback, useState } from 'react';
import type { BoardModel } from './boardData';

const STORAGE_KEY = 'kaggle-lb-watch';

function readStored(): string[] | null {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(ids) ? ids.filter((v): v is string => typeof v === 'string') : null;
  } catch {
    return null; // private window or blocked storage
  }
}

function defaults(model: BoardModel): string[] {
  const rows = model.latest.rows;
  const i = rows.findIndex((r) => r[1] === model.latest.ourTeamId);
  const near = i < 0 ? [] : [rows[i - 1], rows[i], rows[i + 1]].filter(Boolean).map((r) => r[1]);
  // The top three, whoever holds the last gold place, and the teams either side of us.
  const goldEdge = rows[model.latest.medalRanks.gold - 1]?.[1];
  return [...new Set([...rows.slice(0, 3).map((r) => r[1]), ...(goldEdge ? [goldEdge] : []), ...near])];
}

export function useWatchlist(model: BoardModel | null) {
  const [stored, setStored] = useState<string[] | null>(readStored);
  const ids = stored ?? (model ? defaults(model) : []);

  const toggle = useCallback(
    (id: string) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      setStored(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: the change still holds for this visit */
      }
    },
    [ids],
  );

  return { ids, toggle };
}
