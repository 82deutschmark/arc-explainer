# Wasted portrait sidebar advertisement

## Scope and implementation

- Add a clearly labeled VoynichLabs portrait advertisement beneath the ARC-AGI-2 front-page desk and in the existing article advertisement slot.
- Reuse `SponsorPlacement` and its rail format. Keep the wider catalogue banner.
- The whole portrait unit links to the published YouTube Short, including the artwork and visible Watch on YouTube action.
- Preserve the genuine landscape artwork without clipping it inside a tall newspaper advertisement. Limit the unit to 320 pixels wide and let it stack into the mobile page flow.

## Asset and destination evidence

- Artwork copied unchanged from `voynich-website/public/video/wasted-temperature/thumbnail.jpg` into `client/public/ads/wasted-temperature.jpg`.
- `voynich-website/src/data/music-videos.ts` identifies Wasted — Temperature 1.3, artist Larry, released October 8, 2026. `docs/music-videos/STATUS.md` identifies the public vertical Short as `th6e41x-g2g` and the separate widescreen cut as `kKI6Z2oVbBw`.
- Direct destination: https://www.youtube.com/shorts/th6e41x-g2g. YouTube throttled the independent fetch; the destination is corroborated by the owner's publication record. No invented views, reviews or endorsements.

## Verification

- Production Vite client build passed. Reviewed actual component renders at 1440-pixel desktop and 390-pixel phone widths; the artwork, disclosure and action are readable and fit their containers.
- Confirmed the copied asset is byte-identical to its source and the rendered outbound link is the recorded YouTube Short.
- Reviewed the exact staged code, asset, plan and changelog before committing and pushing main.
