# Masthead and rotating music-video ads

## Scope

- Fill the empty masthead space beside the "The ARC Daily" nameplate with a labeled VoynichLabs leaderboard banner.
- Feature three real VoynichLabs videos: Wasted (full widescreen cut), Tool Call and You Don't Even Gotta Jailbreak Me Tonight. Each unit links straight to its YouTube video.
- Feed the masthead, the sidebar rail and the lower banner from one catalogue so they show different videos on one page. The starting video is picked per page load.
- Replace the old text-only "Sponsored by" line and the generic lower banner copy.

## Evidence

- Titles, artists, hooks and YouTube ids come from `voynich-website/src/data/music-videos.ts`; artwork is the unchanged site thumbnails copied into `client/public/ads/`.
- Ads stay labeled "Advertisement / VoynichLabs"; no invented figures or endorsements.

## Verification

- TypeScript check shows no errors in the news files (remaining errors are older, unrelated files).
