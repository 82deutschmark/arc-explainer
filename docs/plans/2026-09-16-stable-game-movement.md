# Revised-game animation audit

Audited the **32 games revised from player feedback**, excluding unchanged BN06 and the separate 44 contributed games. **25 game sources updated; seven retain their existing native animation.**

## What was wrong

The shared browser animation independently matched same-colour pixels and staggered their replacement. A moving character could split, leave trails, or gain unrelated pixels. Several game renderers also flipped silhouettes by tile parity, attached terrain pixels to characters, or painted tile hints over them.

## What changed

- Actual game positions now produce intermediate movement frames; complete sprites translate intact. Presentation frames do not tick game rules or advance enemies a second time.
- Camera motion accompanies the character. Resets clear pending animation. Native puzzle effects, death, win, water and projectile sequences remain.
- EO13 uses its straight multi-cell ride. KC24 records its actual rule-generated path, including turns; it never interpolates a shortcut through walls. Portals and folded crossings retain their transitions.
- Charge, equipment, selected-character state and meaningful facing cues remain. UC44’s heading notch was restored after its existing regression test caught its removal in the earlier handoff patch. UQ15 and RT27 keep their directional marks while their triangle silhouettes no longer flip.
- Only these 32 games bypass the legacy pixel-scatter and border-pulse effect. Native short movement sequences play at 40 ms per frame. Other game groups keep their existing playback.

## Validation

- Python 3.13.15, ARCEngine 0.9.3.
- All 32 existing game verifiers pass, including solution replays across **237 levels**. All four feedback suites pass.
- **11,850 real engine action comparisons** across every level preserve checked domain state, score, level transitions, action counts and terminal state.
- **13,634 intermediate motion frames** checked for rigid sprite coordinates and unchanged sprite arrays in the comparison pass. CV20 additionally exercised **61 animated moves** from its solution replays; AK36 retained its five checked translation frames.
- 59,042 visible opaque player-pixel samples checked in rendered sprite movements; zero mismatches. This sample excludes canvas/interface-drawn players, which have separate native frame and browser checks.
- Focused animation tests pass; deliberately dropping intermediate frames or corrupting a body pixel both fail the verifier.
- Eight browser-playback unit tests pass. Production client build passes. TypeScript reports 12 errors in unchanged, unrelated files; no error names a modified file.
- Playable browser comparison checked AK36 and DY43, including intermediate frames and input locking. This is sampled visual review, not manual playthrough of all 237 levels.

## Per-game scope

| Game | Source | Result | Compared levels | Compared actions |
|---|---|---|---:|---:|
| XS09 | g009 | Travelling beams retained | 6 | 300 |
| VJ10 | g010 | Stable native movement and playback | 6 | 300 |
| NP11 | g011 | Existing one-pixel slide retained | 9 | 450 |
| ZK12 | g012 | Stable native movement and playback | 8 | 400 |
| EO13 | g013 | Stable native movement and playback | 6 | 300 |
| BH14 | g014 | Shadow-collapse animation retained | 6 | 300 |
| UQ15 | g015 | Stable native movement and playback | 7 | 350 |
| VN16 | g016 | Stable native movement and playback | 9 | 450 |
| YB17 | g017 | Stable native movement and playback | 7 | 350 |
| AU18 | g018 | Stable native movement and playback | 10 | 500 |
| HA19 | g019 | Stable native movement and playback | 5 | 250 |
| CV20 | g020 | Stable native movement and playback | 6 | 300 |
| WD21 | g021 | Scale/material state animation retained | 10 | 500 |
| LZ22 | g022 | Stable native movement and playback | 5 | 250 |
| KC24 | g024 | Stable native movement and playback | 8 | 400 |
| QX26 | g026 | Stable native movement and playback | 7 | 350 |
| RT27 | g027 | Stable native movement and playback | 6 | 300 |
| HF28 | g028 | Stable native movement and playback | 8 | 400 |
| PK34 | g034 | Painting/cure animation retained | 8 | 400 |
| ZS35 | g035 | Stable native movement and playback | 9 | 450 |
| MT36 | g036 | Stable native movement and playback | 10 | 500 |
| DY43 | g043 | Stable native movement and playback | 7 | 350 |
| UC44 | g044 | Stable native movement and playback | 7 | 350 |
| JM45 | g045 | Stable native movement and playback | 7 | 350 |
| TS46 | g046 | Stable native movement and playback | 7 | 350 |
| JR47 | g047 | Stable native movement and playback | 7 | 350 |
| FX50 | g050 | Stable native movement and playback | 9 | 450 |
| AK36 | g136 | Stable native movement and playback | 7 | 350 |
| OM55 | g155 | Stable native movement and playback | 8 | 400 |
| EZ62 | g162 | Stable native movement and playback | 6 | 300 |
| YU71 | g171 | Water-flow animation retained | 9 | 450 |
| NV78 | g178 | Ball-routing animation retained | 7 | 350 |

## Integration and delivery

- Authoring source: isolated branch `codex/stable-translation-20260916`, based on authoring commit `13f729d9f062c31e5625e2f0d155cc585c1484e0`. The authoring remote was subsequently fetched with its repository account and the patch rebased onto master at 1b295655. Before edits, stripping/inlining every one of the 32 authoring files produced an AST identical to its live-source snapshot.
- Website: isolated branch of the same name, based on fetched `origin/main` at `1de94543`. Each of the 32 website sources matched the handoff baseline byte-for-byte before integration.
- Canonical authoring files, shared helpers and packaged copies are updated together. Published website copies are generated by the existing packager.
- The user authorized production publication to arc.markbarney.net and arc3.sonpham.net. Both sites receive the reviewed 32-game scope, with native movement pacing. The older publishing checkout, training snapshot, and approved AK36 server on port 8766 remain unchanged.
- Playable comparison: http://127.0.0.1:8767 (requires the local preview process).
- The patch archive includes both repository patches, source hashes, validation reports and scripts.
