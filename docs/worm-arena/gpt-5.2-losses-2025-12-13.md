# GPT-5.2 Losses (valid runs)

Generated from local SnakeBench replays in `external/SnakeBench/backend/completed_games`.

Staging replay URL base:

`https://arc-explainer-staging.up.railway.app/worm-arena?matchId=`

## Copyable IDs

```text
b0834a46-18fa-4820-922c-bbe697082028
527a53aa-6904-44da-af01-353af8fe5daa
b3cb4c23-26cb-413d-887b-f992de079a39
4c07ef23-efd8-49e9-be9a-48ab1d92c2dd
4ca04a75-a715-4efd-a83f-432a607f539f
e223922d-049f-4d14-a636-d634bb630127
c09534bb-8d0f-4558-a709-8f7ef4007217
8f047ab7-7ac1-49a2-8dcc-5007b5bade21
3a234dfb-3ff7-4ee6-8926-22440725f368
1143f167-f307-4139-a5cb-3b1a34d96898
8f7da248-9c6d-4088-aadd-38e926dc8464
e9995c7a-41d2-4a7c-b09d-327602b61ec3
163bfe71-4b2d-4e1d-89f5-f10cd1f28209
e11802ce-cb04-4afc-90fa-cc5fbac0cf66
05d9541e-d98e-459e-945b-c73e3843c858
```

## Table

| startedAt | gameId | opponent | rounds | score (opp-gpt52) | gpt52 death | gpt52 cost | opp cost | replay |
|---|---|---|---:|---:|---|---:|---:|---|
| 2025-12-12T16:52:54.176954 | b0834a46-18fa-4820-922c-bbe697082028 | openai/gpt-5-nano | 73 | 16-20 (-4) | body_collision@72 | 1.342261 | 0.129738 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=b0834a46-18fa-4820-922c-bbe697082028) |
| 2025-12-13T03:41:24.888442 | 527a53aa-6904-44da-af01-353af8fe5daa | x-ai/grok-4.1-fast | 70 | 19-18 (+1) | body_collision@69 | 1.618866 | 0.155937 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=527a53aa-6904-44da-af01-353af8fe5daa) |
| 2025-12-13T03:42:03.289619 | b3cb4c23-26cb-413d-887b-f992de079a39 | openai/gpt-5.1-codex-mini | 51 | 17-14 (+3) | head_collision@50 | 1.113231 | 0.123384 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=b3cb4c23-26cb-413d-887b-f992de079a39) |
| 2025-12-13T04:04:48.866833 | 4c07ef23-efd8-49e9-be9a-48ab1d92c2dd | openai/gpt-5.1-codex-mini | 65 | 18-13 (+5) | body_collision@64 | 1.229813 | 0.177296 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=4c07ef23-efd8-49e9-be9a-48ab1d92c2dd) |
| 2025-12-13T04:42:11.076229 | 4ca04a75-a715-4efd-a83f-432a607f539f | x-ai/grok-4.1-fast | 48 | 16-11 (+5) | body_collision@47 | 0.830100 | 0.119410 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=4ca04a75-a715-4efd-a83f-432a607f539f) |
| 2025-12-13T04:53:10.459757 | e223922d-049f-4d14-a636-d634bb630127 | openai/gpt-5.1-codex-mini | 36 | 8-10 (-2) | body_collision@35 | 0.690898 | 0.072819 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=e223922d-049f-4d14-a636-d634bb630127) |
| 2025-12-13T05:10:22.816685 | c09534bb-8d0f-4558-a709-8f7ef4007217 | x-ai/grok-4.1-fast | 64 | 17-17 (0) | body_collision@63 | 1.166361 | 0.137679 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=c09534bb-8d0f-4558-a709-8f7ef4007217) |
| 2025-12-13T05:20:10.134405 | 8f047ab7-7ac1-49a2-8dcc-5007b5bade21 | openai/gpt-5.1-codex-mini | 44 | 15-8 (+7) | body_collision@43 | 0.661610 | 0.095193 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=8f047ab7-7ac1-49a2-8dcc-5007b5bade21) |
| 2025-12-13T05:32:11.696911 | 3a234dfb-3ff7-4ee6-8926-22440725f368 | openai/gpt-5.1-codex-mini | 80 | 26-19 (+7) | body_collision@79 | 1.496891 | 0.195996 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=3a234dfb-3ff7-4ee6-8926-22440725f368) |
| 2025-12-13T05:32:17.985323 | 1143f167-f307-4139-a5cb-3b1a34d96898 | openai/gpt-5.1-codex-mini | 67 | 17-18 (-1) | body_collision@66 | 1.352190 | 0.189865 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=1143f167-f307-4139-a5cb-3b1a34d96898) |
| 2025-12-13T06:21:10.530051 | 8f7da248-9c6d-4088-aadd-38e926dc8464 | openai/gpt-5.1-codex-mini | 101 | 29-26 (+3) | body_collision@100 | 1.871828 | 0.279496 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=8f7da248-9c6d-4088-aadd-38e926dc8464) |
| 2025-12-13T06:41:52.656961 | e9995c7a-41d2-4a7c-b09d-327602b61ec3 | openai/gpt-5.1-codex-mini | 74 | 22-15 (+7) | body_collision@73 | 1.385570 | 0.218709 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=e9995c7a-41d2-4a7c-b09d-327602b61ec3) |
| 2025-12-13T06:57:01.157779 | 163bfe71-4b2d-4e1d-89f5-f10cd1f28209 | openai/gpt-5-nano | 80 | 16-22 (-6) | body_collision@79 | 1.274445 | 0.154846 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=163bfe71-4b2d-4e1d-89f5-f10cd1f28209) |
| 2025-12-13T07:39:42.928838 | e11802ce-cb04-4afc-90fa-cc5fbac0cf66 | x-ai/grok-4.1-fast | 29 | 9-6 (+3) | body_collision@28 | 0.403382 | 0.050876 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=e11802ce-cb04-4afc-90fa-cc5fbac0cf66) |
| 2025-12-13T07:50:31.118419 | 05d9541e-d98e-459e-945b-c73e3843c858 | openai/gpt-5-nano | 15 | 0-0 (0) | wall@14 | 0.047217 | 0.010889 | [replay](https://arc-explainer-staging.up.railway.app/worm-arena?matchId=05d9541e-d98e-459e-945b-c73e3843c858) |
