/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: The visitor's starred teams for the leaderboard page. Kept in this browser's
 *          localStorage (a per-visitor convenience; nothing is shared or sent anywhere).
 *          Until a visitor stars anything, the list defaults to the top three, the team on
 *          each medal cutoff, and the pinned team, so the watchlist starts with the whole race.
 *          Shared by the watch chart (removing) and the table (starring), so it lives in
 *          the page and is passed down.
 * SRP/DRY check: Pass - the only place the watchlist is read or written.
 */

import { useCallback, useState } from 'react';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import type { BoardModel } from './boardData';

function storageKey(slug: string): string {
  return slug === KAGGLE_COMPETITIONS['arc-3'].slug ? 'kaggle-lb-watch' : `kaggle-lb-watch:${slug}`;
}

function readStored(key: string): string[] | null {
  try {
    const ids = JSON.parse(localStorage.getItem(key) ?? 'null');
    return Array.isArray(ids) ? ids.filter((v): v is string => typeof v === 'string') : null;
  } catch {
    return null; // private window or blocked storage
  }
}

function defaults(model: BoardModel): string[] {
  const rows = model.latest.rows;
  const medalEdges = Object.values(model.latest.medalRanks)
    .map((rank) => rows[rank - 1]?.[1])
    .filter((id): id is string => !!id);
  const pinned = model.pinnedRows.map((r) => r[1]);
  return [...new Set([...rows.slice(0, 3).map((r) => r[1]), ...medalEdges, ...pinned])];
}

export function useWatchlist(model: BoardModel | null, slug = KAGGLE_COMPETITIONS['arc-3'].slug) {
  const key = storageKey(slug);
  const [stored, setStored] = useState<string[] | null>(() => readStored(key));
  const pinned = model?.competition.pinnedTeamIds ?? [];
  const ids = [...new Set([...pinned, ...(stored ?? (model ? defaults(model) : []))])];

  const toggle = useCallback(
    (id: string) => {
      if (pinned.includes(id)) return;
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      setStored(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable: the change still holds for this visit */
      }
    },
    [ids, key, pinned],
  );

  return { ids, toggle };
}
