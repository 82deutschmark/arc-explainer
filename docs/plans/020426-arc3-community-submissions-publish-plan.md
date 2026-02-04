# 020426 ARC3 Community Submissions (Persist + Publish) Plan

Author: GPT-5.2
Date: 2026-02-04
PURPOSE: Define and implement a safe, end-to-end ARC3 community game submission pipeline where a user uploads a single Python ARCEngine game file, the server persists it as a non-playable pending submission, and an admin can review and publish it (making it playable) via a minimal admin workflow. This plan also resolves current inconsistencies (file-size limits, source privacy) that make the existing ARC3 Community upload experience misleading or broken.
SRP/DRY check: Pass - plan reuses existing repo patterns (repository + storage + validator + routes) and eliminates duplicate or dead-end flows.

## 1. Background (Current State)

### 1.1 What exists today
- Frontend routes:
  - `/arc3` landing, `/arc3/gallery` listing, `/arc3/play/:gameId` player, `/arc3/upload` submission page.
- Backend:
  - `/api/arc3-community/session/*` uses a Node <-> Python NDJSON bridge to run games.
  - Official ARCEngine games are auto-discovered from `external/ARCEngine/games/official/*.py`.
  - Community games are stored in Postgres table `community_games` plus `uploads/community-games/*.py`.

### 1.2 What is broken / misleading (root causes)
1. The upload UI posts to `POST /api/arc3-community/submissions`, but that endpoint only validates and returns success; it does not store the submission (no DB row, no file persisted).
2. There is a separate `POST /api/arc3-community/games` endpoint that does persist to DB + disk, but the UI does not use it.
3. Limits are inconsistent:
   - Client upload UI allows 500KB and 2000 lines.
   - Server file storage enforces 100KB.
4. Privacy mismatch: the UI claims submissions remain private until approved, but `GET /api/arc3-community/games/:gameId/source` currently returns DB-stored source without checking `status`, allowing retrieval of non-approved source if the ID is known.

## 2. Goals

1. Persist submissions: `POST /api/arc3-community/submissions` must write the `.py` file to disk and create a `community_games` DB row with `status='pending'` and `is_playable=false`.
2. Publish workflow: an admin must be able to list pending submissions and publish (approve) them, transitioning to `status='approved'` and `is_playable=true`.
3. Preserve safety stance: do not execute pending submissions. Submission-time checks are static (no Python import/exec of the submitted code).
4. Align limits and validation messaging so the UI and server enforce the same constraints.
5. Keep official game discovery intact and reserve official IDs so submissions cannot collide with built-ins.

## 3. Non-Goals (for this iteration)

- Hard OS-level sandboxing / container isolation for executing untrusted Python.
- Automated gameplay verification at publish time (admin will do manual review offline).
- Full accounts/auth system.
- Community moderation UI (comments, ratings, etc.).

## 4. Design Decisions

### 4.1 Data model additions
Add two fields to `community_games`:
- `creator_handle` (text, nullable): Discord handle or Twitter/X URL for moderation contact.
- `submission_notes` (text, nullable): optional notes for reviewers.

Rationale: these are first-class submission fields in the current UI and should not be forced into `author_email`.

### 4.2 Status and playability gates
- New submissions: `status='pending'`, `is_playable=false` (belt-and-suspenders).
- Published submissions: `status='approved'`, `is_playable=true`.
- Runtime already checks `status === 'approved'` before executing a DB-backed community game; we will keep and rely on that, but also enforce `is_playable`.

### 4.3 Admin protection
Publishing a Python game is security-sensitive. Even though the broader project favors public APIs, we will protect the publish/list endpoints using a single shared admin token:
- Server env var: `ARC3_COMMUNITY_ADMIN_TOKEN`
- Request header: `X-ARC3-Admin-Token: <token>`

This is intentionally minimal and avoids introducing accounts.

### 4.4 Source privacy
- `GET /api/arc3-community/games/:gameId/source` must only return DB-backed source for `approved` playable games.
- Admin review uses a separate admin endpoint to fetch pending source (token-gated), or direct server filesystem access if preferred.

### 4.5 Limits (single source of truth)
Adopt:
- Max file size: 500KB
- Max lines: 2000

Server must enforce both (client checks are advisory only).

## 5. API Contract

### 5.1 Public submission endpoint (persist + pending)
- `POST /api/arc3-community/submissions`
  - Body: `{ gameId, displayName, description, authorName?, creatorHandle, sourceCode, notes? }`
  - Behavior:
    - Validate ID availability (reject if official ID or already in DB)
    - Run static validation (forbidden imports, ARCBaseGame subclass, etc.)
    - Store `.py` file on disk
    - Create `community_games` row with `status='pending'`, `is_playable=false`, `creator_handle`, `submission_notes`
  - Response: `{ submissionId, status: 'pending', message, validationSummary }`

### 5.2 Admin submission list
- `GET /api/arc3-community/submissions?status=pending|approved|rejected|archived`
  - Header: `X-ARC3-Admin-Token`
  - Returns DB rows (no official games) with enough metadata for moderation.

### 5.3 Admin publish
- `POST /api/arc3-community/submissions/:submissionId/publish`
  - Header: `X-ARC3-Admin-Token`
  - Transitions:
    - `status='approved'`
    - `is_playable=true`
    - `validated_at` set if not already set (represents the last review time we recorded in-app)

### 5.4 Optional (recommended) admin reject
- `POST /api/arc3-community/submissions/:submissionId/reject`
  - Header: `X-ARC3-Admin-Token`
  - Transitions:
    - `status='rejected'`
    - `is_playable=false`
    - Store rejection reason into `validation_errors` (JSON) so it is visible in tooling.

## 6. UI Plan (Admin)

Add a small admin page:
- Route: `/admin/arc3-submissions`
- Features:
  - Paste/store admin token locally (localStorage) for API calls.
  - List pending submissions (gameId, displayName, authorName, creatorHandle, uploadedAt).
  - View source (token-gated endpoint) for review.
  - Publish and reject buttons.

## 7. Implementation Tasks (Concrete TODOs)

### 7.1 Server + DB
- [ ] Update `community_games` schema to include `creator_handle` and `submission_notes`.
- [ ] Add schema migration (ALTER TABLE IF NOT EXISTS) for existing installs.
- [ ] Update `CommunityGameRepository` types + mapping to include the new fields.
- [ ] Align size and line limits server-side (storage + validator + zod schemas).
- [ ] Implement `/submissions` persistence and publish/list endpoints with admin token checks.
- [ ] Fix source privacy: restrict DB game source retrieval to approved playable only; add admin-only source endpoint for pending review.

### 7.2 Client
- [ ] Add admin submissions page and link from AdminHub.
- [ ] Keep existing `/arc3/upload` UX but ensure server responses are meaningful (submissionId is real).

### 7.3 Docs + changelog
- [ ] Add top entry in `CHANGELOG.md` describing the new persisted submission + publish pipeline.
- [ ] Update relevant ARC3 docs/plans that currently claim the submission endpoint is wired but it is not.

## 8. Verification Checklist

1. Submit a `.py` file on `/arc3/upload` and confirm:
   - Response returns a real `submissionId`
   - DB row exists with `status='pending'` and `is_playable=false`
   - File exists under `uploads/community-games/<gameId>.py`
2. Confirm pending games:
   - Do not appear in `/arc3/gallery`
   - Cannot be started via `/api/arc3-community/session/start`
   - Cannot have their source fetched via the public `/games/:gameId/source`
3. Admin flow:
   - With token, list pending submissions
   - Publish one and confirm it becomes playable and visible in gallery
4. Regression:
   - Official games still list/play as before.

