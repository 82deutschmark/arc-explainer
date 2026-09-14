/*
Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Stable public names for all 44 published contributed games. The player and
catalog links use ARC-style IDs; storage, telemetry, control maps and old URLs keep
their existing identity. Both browser routing and the source API resolve this table.
SRP/DRY check: Pass — one mapping and inverse, shared by client and server.
*/

import evolutionIds from './arc3EvolutionIds.json';

export const ARC3_PUBLIC_IDS: Readonly<Record<string, string>> = Object.freeze({
  ...evolutionIds.published_public_ids,
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
