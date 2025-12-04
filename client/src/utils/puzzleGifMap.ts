/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-04
 * PURPOSE: Deterministic mapping from ARC puzzle IDs to curated animated GIF assets.
 * SRP/DRY check: Pass — central lookup so cards/pages can reuse GIF paths without duplicating strings.
 */

const GIF_BASE_PATH = '/images/decoration';

const RAW_PUZZLE_GIF_MAP: Record<string, string> = {
  // ARC1 evaluation GIFs
  '7d419a02': 'arc_puzzle_7d419a02.gif',
  '50f325b5': 'arc_puzzle_50f325b5.gif',
  'b9630600': 'arc_puzzle_b9630600.gif',
  '4ff4c9da': 'arc_puzzle_4ff4c9da.gif',
  '14754a24': 'arc_puzzle_14754a24.gif',
  '8b28cd80': 'arc_puzzle_8b28cd80.gif',
  'c6e1b8da': 'arc_puzzle_c6e1b8da.gif',
  'f3b10344': 'arc_puzzle_f3b10344.gif',
  '212895b5': 'arc_puzzle_212895b5.gif',
  '16b78196': 'arc_puzzle_16b78196.gif',
  '0934a4d8': 'arc_puzzle_0934a4d8.gif',
  // ARC2 evaluation GIFs
  '13e47133': 'arc_puzzle_13e47133.gif',
  '142ca369': 'arc_puzzle_142ca369.gif',
  '195c6913': 'arc_puzzle_195c6913.gif',
  '20270e3b': 'arc_puzzle_20270e3b.gif',
  '21897d95': 'arc_puzzle_21897d95.gif',
  '221dfab4': 'arc_puzzle_221dfab4.gif',
  '269e22fb': 'arc_puzzle_269e22fb.gif',
  '271d71e2': 'arc_puzzle_271d71e2.gif',
  '28a6681f': 'arc_puzzle_28a6681f.gif',
  '2b83f449': 'arc_puzzle_2b83f449.gif',
  '2d0172a1': 'arc_puzzle_2d0172a1.gif',
  '35ab12c3': 'arc_puzzle_35ab12c3.gif',
  '3a25b0d8': 'arc_puzzle_3a25b0d8.gif',
  '446ef5d2': 'arc_puzzle_446ef5d2.gif',
  '4c416de3': 'arc_puzzle_4c416de3.gif',
  '4c7dc4dd': 'arc_puzzle_4c7dc4dd.gif',
  '4e34c42c': 'arc_puzzle_4e34c42c.gif',
  '5545f144': 'arc_puzzle_5545f144.gif',
  '5dbc8537': 'arc_puzzle_5dbc8537.gif',
  '62593bfd': 'arc_puzzle_62593bfd.gif',
  '6e4f6532': 'arc_puzzle_6e4f6532.gif',
  '6ffbe589': 'arc_puzzle_6ffbe589.gif',
  '7491f3cf': 'arc_puzzle_7491f3cf.gif',
  '78332cb0': 'arc_puzzle_78332cb0.gif',
  '7b0280bc': 'arc_puzzle_7b0280bc.gif',
  '7b80bb43': 'arc_puzzle_7b80bb43.gif',
  '800d221b': 'arc_puzzle_800d221b.gif',
  '88bcf3b4': 'arc_puzzle_88bcf3b4.gif',
  '88e364bc': 'arc_puzzle_88e364bc.gif',
  '8b7bacbf': 'arc_puzzle_8b7bacbf.gif',
  '9385bd28': 'arc_puzzle_9385bd28.gif',
  '97d7923e': 'arc_puzzle_97d7923e.gif',
  '9bbf930d': 'arc_puzzle_9bbf930d.gif',
  'a32d8b75': 'arc_puzzle_a32d8b75.gif',
  'b6f77b65': 'arc_puzzle_b6f77b65.gif',
  'b9e38dc0': 'arc_puzzle_b9e38dc0.gif',
  'cbebaa4b': 'arc_puzzle_cbebaa4b.gif',
  'd35bdbdc': 'arc_puzzle_d35bdbdc.gif',
  'de809cff': 'arc_puzzle_de809cff.gif',
  'e12f9a14': 'arc_puzzle_e12f9a14.gif',
  'e87109e9': 'arc_puzzle_e87109e9.gif',
  'eee78d87': 'arc_puzzle_eee78d87.gif',
  'f560132c': 'arc_puzzle_f560132c.gif',
  'faa9f03d': 'arc_puzzle_faa9f03d.gif'
};

export const PUZZLE_GIF_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_PUZZLE_GIF_MAP).map(([puzzleId, file]) => [
    puzzleId,
    `${GIF_BASE_PATH}/${file}`,
  ])
);

export function getPuzzleGif(puzzleId: string | undefined | null): string | undefined {
  if (!puzzleId) return undefined;
  return PUZZLE_GIF_MAP[puzzleId];
}
