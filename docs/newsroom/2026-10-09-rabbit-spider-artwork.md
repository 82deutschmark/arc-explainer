# Approved rabbit and GPU-spider artwork

Generated with the built-in imagegen tool, using the user-supplied Tufa battle
scene as a composition reference. The user approved the base image, then explicitly
requested programmatic branding and score overlays without regeneration.

## Final generation prompt

Use case: illustration-story. Asset type: wide editorial cartoon illustration for The ARC Daily competition news page, landscape 16:9 composition. Create a witty, exciting original editorial cartoon that is an obvious visual callback to the supplied reference image's snowy ruined city boulevard, low viewpoint, drifting fog, distant buildings and Tufa flags, but reimagines its characters warmly as mascots. The reference is for setting and composition only, NOT a scene to reproduce with violent characters. In the left foreground a huge fluffy brown-and-white rabbit with dark ears, white chest and soft round face has grown enormous, looking calmly toward the other contender; a smaller gray-brown fluffy rabbit peeks beside it, matching Yi-Chia Chen's two-rabbit avatar. On the right in the midground is a small BLACK CARTOON SPIDER, a rounded black blob body with eight simple curved stick legs, big friendly white googly eyes and an expressive determined face, recognizably a playful mascot, not a mechanical creature. It has a comically large backpack of many recognizable graphics cards, GPU boards, heatsinks, twin and triple cooling fans, bundled cables, and straps piled onto its back, and is using two of its legs to strap one MORE graphics card on. The rabbit gets bigger; the spider adds GPUs. A small black flag beside the spider reads exactly 'Tufa Labs'. Make the spider clearly visible rather than lost behind the gear. Ink contours, painterly fur and snow, polished contemporary editorial cartoon, cool gray-blue snow with warm cream rabbit fur and modest green circuit-board accents. Funny sporting tension, equally engaging contenders, neither humiliated nor villainous. No people, no weapons, no scary robot, no gore, no broken rabbit, no winning trophy, no actual numeric scores or leaderboard box, no speech bubbles, no large title. Avoid claims about actual hardware brand, count or model; the pile is a visual metaphor for their public compute rhetoric. Keep both characters readable at page thumbnail size and within center 80% of frame. The large rabbit replaces the warrior in the original composition, the small cartoon spider carrying GPUs replaces the threatening machines.

## Deterministic title cards

`scripts/newsroom_artwork.py` adds ARC Explainer's established six-color mark,
blue ARC-3 label, the genuine `arc3-levels/ls20/lvl1.png` inset and the two team's
verified ranks and scores from an ARC-3 newsroom brief. It prints the observation
time in Eastern, labels standings provisional and identifies the GPU pile as
an editorial metaphor. The original image is preserved.

Base: `/Users/macmini/.codex/generated_images/01a11d8a-c27e-7c83-9539-d62cb844c400/exec-64869530-1761-43a9-afaa-b63c55c3b7fe.png`.

Web: `client/public/news-images/2026-10-09-rabbit-and-spider.webp`.

Shareable PNG: `/Users/macmini/bubba-workspace/reports/arc3-leaderboard/2026-10-09-rabbit-spider-arc3.png`.

The manual brief and supporting roster/score evidence are preserved in the same
reports directory as `2026-10-09-social-preview-evidence.json`. Fresh evening
scores must be checked independently; this image's caption identifies its own
October 9, 1:23 pm Eastern snapshot.
