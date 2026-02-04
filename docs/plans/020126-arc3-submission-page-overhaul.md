# 020126-arc3-submission-page-overhaul

## Update (Feb 04, 2026)
- The single-file submission flow is now wired end-to-end: `POST /api/arc3-community/submissions` persists to DB + disk as `pending` and non-playable, and admin review endpoints exist for publish/reject.
- Current implementation plan and verification checklist: `docs/plans/020426-arc3-community-submissions-publish-plan.md`

## Goal
Capture the redesign requirements for the ARC3 community submission flow so the UI matches the actual workflow (single Python file upload), applies the ARC3 palette in an intentional way, and clarifies validation/safety expectations.

## Context
- Current landing/submission UI (@client/src/pages/arc3-community/CommunityLanding.tsx#1-276, @client/src/pages/arc3-community/GameSubmissionPage.tsx#1-497) tries to explain the process inside colorful panels, which clutters the hero and buries real guidance.
- The user workflow is a single Python file upload (one ARCBaseGame subclass). The existing page still references multi-file repos and GitHub links, creating confusion and hiding risks around arbitrary Python payloads.
- Palette usage is noisy: each panel picks a vivid tone but layouts lack a framing device or evolving motif. We need a page shell that continuously references the ARC3 color grid (e.g., animated sprite rails, gradients) without dumping instructions into every tile.
- Backend validation already exists (@server/services/arc3Community/CommunityGameValidator.ts#1-170) to detect forbidden imports, ARCBaseGame subclass, etc., but the UI does not explain what is enforced or why upload size limits exist.

## Pain points to fix
1. **Instruction overload in hero copy** – Too much text jammed into PixelPanels. Need a concise elevator pitch up top and a separate "Submission Playbook" section for details.
2. **Palette misuse** – Panels pick random colors; no systemic framing or motion. Introduce a persistent mosaic background that cycles through @shared/config/arc3Colors.ts#1-102 to keep the ARC3 identity consistent.
3. **Wrong upload mental model** – UI still asks for GitHub repo URLs (multi-file). Must pivot to a single-file uploader (supports up to ~2,000 lines) with clear expectations about file size and structure.
4. **Validation transparency** – Communicate the checks (ARCBaseGame subclass, arcengine import, forbidden imports) so creators know failures before uploading.
5. **Safety messaging** – Python files are potentially dangerous. Need copy explaining sandboxing review pipeline, delays, and disallowing network/disk IO.
6. **Call-to-action clarity** – Primary CTA should be "Upload ARC3 Game (.py)" with secondary links for docs and sample templates.

### Submission page-specific gaps (current `/arc3/upload` UI @client/src/pages/arc3-community/GameSubmissionPage.tsx#1-497)
1. **Field bloat + wrong identifiers** – Form still collects author name + email + GitHub repo URL. Requirements should be: game metadata + one social contact (Discord handle or Twitter/X link). No emails.
2. **GitHub-only flow** – Backend schema (`gameSubmissionSchema` @server/routes/arc3Community.ts#397-452) enforces GitHub URLs, which contradicts the intended single-file upload validated server-side. Need to retire the repo submission endpoint entirely and align with `/api/arc3-community/games` upload flow.
3. **Missing uploader affordances** – Form lacks drag/drop, syntax pre-check, or large-file warnings. Need progress feedback and inline validator output referencing CommunityGameValidator rules.
4. **Palette + layout mismatch** – Form uses standard PixelPanel stack with little framing. Should mirror landing page improvements with the animated ARC3 frame plus clearer section dividers ("Game metadata", "Upload file", "Creator contact", "Review notes").
5. **Docs + samples** – Provide direct links to ARCEngine sample game (.py) and Discord community, so creators can model file structure.

### Social/contact requirements
- Replace `authorEmail` with one mandatory handle field that accepts either Discord username (`name#1234` style or new handle format) or Twitter/X URL.
- Store handle alongside authorName (optional) for display; emphasize that moderation will DM via social channel instead of email.
- Update copy to explain why Discord/Twitter is used (community moderation + faster chat) and that email is intentionally excluded.

## Requirements & decisions
- **Visual system**: build a border/frame component that uses ARC3 palette sprites that animate slowly (CSS keyframes). Content sits atop a neutral dark canvas so instructions are legible.
- **Hero**: single sentence describing ARC3 Studio + two CTAs (Play games, Submit your Python file). No bulleted instructions.
- **Submission Playbook section**: two-column layout splitting "Before you upload" vs "What happens after". Each uses short numbered steps, referencing validation rules and review timeline.
- **Uploader**: Drag-and-drop zone for `.py` file, show runtime validations (line count, file size, presence of class definition) before POSTing to `/api/arc3-community/submissions`. The payload should include `sourceCode` string; remove GitHub URL field entirely.
- **Validation copy**: list the enforced checks mirroring CommunityGameValidator (ARCBaseGame subclass, arcengine import, forbidden modules). Provide link to docs snippet enumerating safe imports.
- **Safety notice**: callout panel describing offline review environment, no execution until manual approval, uploads stay private until published.
- **Featured references**: keep sprite sheet + featured games but shrink them into side rail so submission guidance remains primary.
- **Contact method**: new `creatorHandle` field (Discord or Twitter). Validation: Discord `^[A-Za-z0-9_.-]{2,32}(#[0-9]{4})?$` or `https://(twitter|x).com/handle`. Remove `authorEmail` everywhere.
- **Backend contract**: Update `gameSubmissionSchema` to accept `{ contactHandle, sourceCode }`, drop GitHub repo logging, and pipe directly into validation/storage flow used by `/games` endpoint (same `CommunityGameStorage`). Need audit of queue/notifications once DB row is created.
- **Review guidance UI**: After upload success, show timeline referencing manual review + Discord ping, not email.

## Task list
- [ ] Update ARC3 palette shell & background animator component — `client/src/components/arc3-community/Arc3PixelUI.tsx` (line refs pending once component is located).
- [ ] Rework landing hero & CTA layout — `client/src/pages/arc3-community/CommunityLanding.tsx` lines ~55-270.
- [ ] Replace GameSubmission form with single-file uploader + validation messaging — `client/src/pages/arc3-community/GameSubmissionPage.tsx` lines ~1-497.
- [ ] Adjust server upload schema to accept file bytes/string without GitHub URL — `server/routes/arc3Community.ts` lines ~111-142 and related handlers.
- [ ] Ensure validator messaging matches backend rules — `server/services/arc3Community/CommunityGameValidator.ts` lines ~1-327 (may need new metadata to surface warnings).
- [ ] Document new flow in creator docs + changelog once implemented (future step).
