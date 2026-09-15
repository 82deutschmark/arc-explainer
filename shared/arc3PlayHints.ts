/*
Author: Codex (GPT-6)
Date: 2026-09-12
PURPOSE: Short, always-visible control and objective hints requested in human playtesting.
SRP/DRY check: Pass — presentation copy only; games own their mechanics and tutorial levels.
*/
export const ARC3_PLAY_HINTS: Readonly<Record<string, string>> = {
  g010: 'Explore with the arrow keys. The lantern starts with a wider view and shrinks as oil runs low. Collect all three pink seals, refill at cyan cans, and return to the gate.',
  g011: 'Arrow keys start a slide; wait for it to stop before moving again. Come to rest inside the cyan goal. Stones move one step when pushed, and purple switches change the gates. Later maps have finer passages.',
  g014: 'Click a red block to collapse it into its shadow, raising that ground by one layer. White pips show block height; blue inset tiles are depressions. Flatten the whole board. Space turns the sun; each collapse also turns it.',
  g035: 'Arrows move. Stand on a layer and press Space to wear it; you can only add layers outside what you already wear. Your outer color opens matching doors. Later, Space on the white shears removes the outer layer: match the remaining pattern exactly to a framed door.',
  g036: 'Arrows lay the cord. Reach the green anchor and press Space to pull tight. At marked crossings, lay both directions: the SECOND strand must match the mark—blue horizontal, yellow vertical. Cross straight through; ordinary path cells cannot be reused.',
  g047: 'Move the red character with the arrows. Touch a colored station to select its mirror; Space turns that mirror clockwise. The selection stays with you. Aim a beam at the exit, then walk onto it.',
  g044: 'This is an unfolded cube. Matching colored outer edges connect; crossing them wraps you onto another face. Collect all six orange keys, then enter the green exit. Blue arrows only admit entry in their direction.',
  g178: 'Mouse only: click the emitter to release a ball, or a junction to spend a manual flip. Each passing ball flips that junction again. Fill every receiver; its dots show how many balls it still needs.',
  g171: 'Click to place or remove a dam, then click the source to pour. Water runs automatically. In the mixing levels, move plugs at the marked valves and match both tank quantities before pouring.',
  g021: 'Use Up/Down or click to select a box, then Left/Right to place it on that pan. Space submits the LEFT pan to the target plate. Striped volatile boxes shrink after three turns on a pan.',
  g045: 'The top strip shows the portal connection schedule. A crossing happens when you step into a mouth; Space waits without crossing. Collect the orange cargo, then return to the ornate berth.',
  g020: 'Click a lamp to send a light wave. The emitter strip pairs each pulse color with the seal it dissolves. Use the four arrow directions to explore the revealed square tiles.',
  g512: 'Arrow keys move on the square tiles. Click a brass aperture to reveal it and its four neighbors. Collect keys, open doors, and plan your return before an ember bridge collapses behind you.',
};

export function arc3PlayHint(gameId: string | undefined, completedLevels: number): string | undefined {
  if (gameId === 'g018') return completedLevels < 8
    ? 'Explore the woven terrain with the arrows. Cyan damp marks turn yellow when touched; the next green arch raises the tide by the marks you collected. Visit every arch and reach the summit. Denser weaving means higher ground.'
    : 'Stand beside an orange cloth and click it to carry it. Space rotates it. Stand beside a cyan embroidered socket and click to fit the cloth: shape and weave must both match. Each fitted piece opens its linked gate. Click its original rack to put it back.';
  return gameId ? ARC3_PLAY_HINTS[gameId] : undefined;
}
