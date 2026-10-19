# 2026-10-19 — ARC-3 team job queue page (`/arc3/jobs`)

Author: Claude Opus 5.5 (for Son)

## Why

Son, 19-Oct-2026: "Add a page under markbarney repository for tracking (not my repository)", then
"password gate on internal stuffs".

The ARC-3 team now runs GPU jobs for collaborators through a small job API (sonpham-org/arc-3,
`gcp/arc3-jobs`): Keith sends LoRA weights for evaluation on the 32-equal game set (1-card RTX PRO 6000
boxes), Jack Cole sends his own experiments to 4x L4 boxes. The team's own status page
(arc3.sonpham.net/jobs.html) sits behind a Google sign-in, so the collaborators can't see it. This page
gives them (and anyone with the link) the queue, with the money and machinery behind a password.

## Scope

- One unlisted page, `/arc3/jobs` (noindex, not in the navigation; people get the link).
- Public part: boxes busy per type (of their caps), jobs waiting and running, and per job: who, their
  label, what it runs, status, and progress (minute of play and plays making moves for evaluations;
  output files for experiments; restarts after a Spot box was taken back). Active jobs, or the last 7 days.
- Behind the queue view password: each person's spend today against their daily cap, each job's cost and
  estimate, the boxes running (name, zone, uptime), the last line of a run's output, and the dispatcher log.

## How

- No server change here. The team's API (Cloud Run) serves two read-only documents that its dispatcher
  writes every 2 minutes, with CORS for arc.markbarney.net and localhost dev ports:
  - `GET /v1/public/queue` — the overview, nothing internal in it (filtered on the API side, so the
    hidden fields never reach the browser without the password).
  - `GET /v1/public/queue/full` — needs the `X-Queue-Password` header; wrong password = 401.
- The password is typed on the page, kept in this tab's `sessionStorage`, and sent only to that API.
  "Lock" forgets it. The team issues it (`gcp/arc3-jobs/admin.py view-password`); it is not in this repo.
- Files:
  - `client/src/components/arc3Jobs/queueData.ts` — types, the two requests (react-query, 1-minute
    refresh), plain-words formatting. `VITE_ARC3_JOBS_API` can point a dev server elsewhere.
  - `client/src/pages/Arc3JobQueue.tsx` — the page; shadcn Card/Table/Badge/Input/Button/ToggleGroup.
  - `client/src/App.tsx` — lazy route; `shared/routes.ts` — unlisted metadata entry (noindex).
  - `tests/arc3JobQueue.test.ts` — public view shows no money/boxes/log; password view shows them and
    hides the form; progress wording.

## TODO / done

- [x] Public and password-gated documents on the team API (arc-3 commit, deployed 19-Oct)
- [x] Page, route, unlisted metadata, tests (3 new; route-metadata and leaderboard tests still pass)
- [x] Checked in a local dev server against the production API: overview and 7-day list render
- [ ] Mark reviews and merges (this PR); nothing goes live before that
