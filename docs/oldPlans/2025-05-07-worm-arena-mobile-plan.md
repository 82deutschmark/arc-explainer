# Plan: Improve Worm Arena mobile board layout

## Goals
- Diagnose why the Worm Arena live board renders incorrectly on mobile devices.
- Implement a responsive, high-fidelity canvas layout that stays legible on small screens.
- Keep the playful emoji styling while ensuring sizing and clarity across viewport sizes.

## Steps
1. Inspect the current WormArenaGameBoard rendering logic to understand sizing and layout assumptions (padding, cell size calculation, canvas scaling).
2. Add responsive sizing based on the parent container and viewport height, enforcing sensible min/max cell sizes so the board stays legible on phones.
3. Update the canvas drawing effect to react to container resize events (ResizeObserver) and apply devicePixelRatio scaling for crisp emoji rendering.
4. Adjust styles to ensure the canvas scales fluidly (100% width, auto height) without overflowing the container on mobile.
5. Test locally by simulating narrow viewport conditions and verify the board scales correctly and remains centered.
