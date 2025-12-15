## Goal
Fix the Worm Arena Matches page so filters and pagination reliably update the match list and reflect applied criteria.

## Notes
- Backend `/api/snakebench/matches` already honors filters (manual curl confirmed).
- Current UI updates total but rows can appear stale; add explicit apply pipeline and stale-response guards.

## Tasks
- Wire an applied-filters state that is updated on Apply (and defaulted once a model is available) and drives fetches.
- Add request guards to ignore stale responses and keep loading/error state accurate.
- Reset pagination sensibly on filter changes, validate against live API, and document in changelog.
