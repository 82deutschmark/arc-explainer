/*
Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Stable public names for 33 reviewed originals and all 44 contributed games. The player and
catalog links use ARC-style IDs; storage, telemetry, control maps and old URLs keep
their existing identity. Both browser routing and the source API resolve this table.
SRP/DRY check: Pass — one mapping and inverse, shared by client and server.
*/

import evolutionIds from './arc3EvolutionIds.json';

export const ARC3_PUBLIC_IDS: Readonly<Record<string, string>> = Object.freeze({
  ...evolutionIds.published_public_ids,
  g010: 'vj10', g011: 'np11', g014: 'bh14', g018: 'au18', g024: 'kc24', g035: 'zs35', g036: 'mt36',
  g006: 'bn06', g009: 'xs09', g012: 'zk12', g015: 'uq15', g016: 'vn16',
  g020: 'cv20', g021: 'wd21', g022: 'lz22', g026: 'qx26', g027: 'rt27',
  g028: 'hf28', g034: 'pk34', g043: 'dy43', g045: 'jm45',
  g013: 'eo13', g017: 'yb17', g019: 'ha19', g044: 'uc44', g046: 'ts46', g047: 'jr47',
  g050: 'fx50', g136: 'ak36', g155: 'om55', g162: 'ez62', g171: 'yu71', g178: 'nv78',
});

const canonicalIds = new Map(Object.entries(ARC3_PUBLIC_IDS).map(([id, publicId]) => [publicId, id]));

export function canonicalGameId(id: string): string {
  const lower = id.toLowerCase();
  return canonicalIds.get(lower) ?? (ARC3_PUBLIC_IDS[lower] ? lower : id);
}

export function publicGameId(id: string): string {
  const canonical = canonicalGameId(id);
  return ARC3_PUBLIC_IDS[canonical] ?? canonical;
}
