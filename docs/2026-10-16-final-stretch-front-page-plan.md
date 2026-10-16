<!--
Author: Claude Opus 5.5 Medium
Date: 2026-10-16
PURPOSE: Plan for replacing the site front page with a final-stretch page for the last weeks of ARC Prize 2026.
SRP/DRY check: Pass - plan only; every piece reuses an existing component or data source.
-->
# Final-stretch front page

**Ask (Boss, 16-Oct-2026):** reimagine the landing page. It's not about the synthetic games any more; the competition is in its last month. Boss picked the "final stretch" direction: countdown, medal race, today's wire, our standing in a small box.

## What the page does
1. **Clock to the close.** Reads `closeAt` from `shared/kaggleCompetitions.ts` through new shared helpers (`closeMs`, `daysToClose`), which the newspaper masthead and board tiles now use too. Prints the close in UTC and Eastern. After the close it says the boards are closed and medals come from the private board, instead of sitting at zero.
2. **The ARC-AGI-3 medal race.** The live leaderboard components (`HeadlineFacts`, `MedalRaceChart`, `StoryGrid`) from the half-hourly board save.
3. **Today's wire.** `useNews` + `sortedWire` + `filedAt`, drawn in the landing palette (the newspaper stylesheet stays on newspaper routes). Today's stories, topped up with the newest older ones when few were filed.
4. **Our placing, small.** `OurStandingCard` with a new `compact` size, in the side column.
5. **Everything else moved.** The old landing (harness essay, Astra chart, practice games) stays at `/synthetic`, linked as "How we got here".

## TODO
- [x] Shared close helpers; masthead and tiles use them
- [x] `FinalStretchLanding.tsx`, routed at `/`
- [x] Root search/no-JS copy in `shared/routes.ts` matches the new hero
- [x] Type-check; related tests (two failures already present on main, unrelated)
- [x] Changelog, commit, push
