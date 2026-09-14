/*
Author: Codex (GPT-6)
Date: 2026-09-14
PURPOSE: Share contributed control bindings and scope unlimited browser retries to the
44 public aliases. Hash the practice mode with the source identity for honest telemetry.
SRP/DRY check: Pass — the shared predicates drive worker, keyboard, deck and Help.
*/
import { ARC3_PUBLIC_IDS, canonicalGameId } from './arc3PublicIds';
const AUTHORED_Z_GAMES = new Set(['g500', 'g502', 'g519', 'g542']);
export function usesAuthoredZKey(id: string | undefined): boolean {
  return id !== undefined && AUTHORED_Z_GAMES.has(canonicalGameId(id));
}

// Practice rules are versioned separately from each immutable engine source for telemetry.
export const CONTRIBUTED_PLAY_VERSION = 'retry1';
export function usesContributedRecovery(id: string | undefined): boolean {
  return id !== undefined && Object.hasOwn(ARC3_PUBLIC_IDS, canonicalGameId(id));
}

export async function contributedPlayVersion(sourceVersion: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`${sourceVersion}:${CONTRIBUTED_PLAY_VERSION}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
