/**
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-08
 * PURPOSE: Shared Arc3 color palette for both client and server rendering.
 *          Loads canonical palette data from arc3Palette.json so every runtime
 *          (TS/JS/Python) stays in sync when colors change.
 * SRP/DRY check: Pass — guarantees a single palette source used everywhere.
 */

import paletteJson from './arc3Palette.json';

type PaletteEntry = {
  value: number;
  hex: string;
  rgb: [number, number, number];
  name: string;
};

const ARC3_PALETTE: readonly PaletteEntry[] = paletteJson.colors;

export const ARC3_COLORS_TUPLES: Record<number, [number, number, number]> = Object.fromEntries(
  ARC3_PALETTE.map((entry) => [entry.value, entry.rgb])
) as Record<number, [number, number, number]>;

export const ARC3_COLORS_HEX: Record<number, string> = Object.fromEntries(
  ARC3_PALETTE.map((entry) => [entry.value, entry.hex])
) as Record<number, string>;

export const ARC3_COLOR_NAMES: Record<number, string> = Object.fromEntries(
  ARC3_PALETTE.map((entry) => [entry.value, entry.name])
) as Record<number, string>;

export function getArc3ColorTuple(value: number): [number, number, number] {
  const tuple = ARC3_COLORS_TUPLES[value];
  return tuple ?? [255, 255, 255];
}

export function getArc3ColorHex(value: number): string {
  return ARC3_COLORS_HEX[value] ?? '#888888';
}

export function getArc3ColorName(value: number): string {
  return ARC3_COLOR_NAMES[value] ?? 'Unknown';
}
