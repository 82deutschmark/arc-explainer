/**
 * Author: Claude Opus 5
 * Date: 2026-09-06
 * PURPOSE: GPT-6 Astra's per-environment ARC-AGI-3 public-demo results, as published by
 *          ARC Prize on 02-Sep-2026, for the harness-gap chart on the arc3 landing page.
 *
 *          A FROZEN, DATED EXTRACT -- NOT A LIVE FEED, AND IT MUST NOT BECOME ONE. The
 *          landing page's whole problem was present-tense claims about frontier
 *          performance that expired within weeks. This is the opposite: one published
 *          result, on one date, cited as history. History does not go stale. If a newer
 *          model is evaluated, ADD a second dated extract beside this one -- do not edit
 *          these numbers, because that would silently rewrite what the page claimed to
 *          have observed.
 *
 *          PROVENANCE. Transcribed from ARC Prize's published per-environment table via
 *          the extract at ~/bubba-workspace/docs/astra-analysis/astra_v3_gaps.json (25
 *          environments x 12 harness configurations, with 300 replay URLs), re-verified
 *          numerically on 06-Sep-2026.
 *
 *          WHAT THE NUMBERS ARE. Each environment was run under 12 configurations: two
 *          harnesses x six reasoning tiers. `standard` and `adapter` are each the BEST
 *          score that harness achieved across all six of its tiers -- a maximum, not a
 *          single run and not an average.
 *
 *          THE ONE CLAIM THIS SUPPORTS, and its limits. On the worst environments the
 *          standard harness never gets near a solve at ANY reasoning setting, while the
 *          adapter path solves them. Because both figures are maxima over the tiers, that
 *          comparison is order-independent and safe. What is NOT established here is
 *          anything about individual tiers -- an earlier draft claimed the adapter solves
 *          BP35 "even with reasoning off", which the source data does not support. Do not
 *          make per-tier claims from this file.
 *
 *          ARC Prize publishes these results WITHOUT interpretation. Any reading of why
 *          the harness matters is ours and must be voiced on the page as ours.
 * SRP/DRY check: Pass - data only, no rendering. Nothing else in the repo holds Astra
 *          results; docs/2026-09-06-arc3-landing-durable-prose-plan.md records the
 *          derivation. HarnessGapChart.tsx owns presentation.
 */

/** Where these results were published. Rendered as the citation, never hard-coded in copy. */
export const ASTRA_SOURCE = {
  url: 'https://arcprize.org/results/openai-gpt-6-astra',
  label: 'ARC Prize — GPT-6 Astra results',
  published: '2 September 2026',
  set: 'ARC-AGI-3 public demo',
} as const;

/** A replay id resolves to ARC Prize's own player, so every bar on the chart is checkable. */
export const REPLAY_BASE = 'https://arcprize.org/replay/';

export interface AstraEnvResult {
  /** ARC-AGI-3 environment id, e.g. 'BP35'. */
  env: string;
  /** Best score across all six reasoning tiers on the Standard harness. 0..1 */
  standard: number;
  /** Best score across all six reasoning tiers on the Provider Adapter harness. 0..1 */
  adapter: number;
  /** One representative replay from each path, for spot-checking the pair. */
  standardReplay: string;
  adapterReplay: string;
}

/** All 25 public-demo environments, widest harness gap first. */
export const ASTRA_ENV_RESULTS: readonly AstraEnvResult[] = [
  { env: 'BP35',   standard: 0.0222, adapter: 1,   standardReplay: '084397eb-e736-4cfa-bd64-0f73cc198e50', adapterReplay: 'b02b9920-372b-43c9-8eef-58b76704664f' },
  { env: 'G50T',   standard: 0.0303, adapter: 1,   standardReplay: '86b31ba0-245b-44c1-8587-bf7782bc27f2', adapterReplay: 'b93ce848-16a9-4930-994b-871dd64ed93d' },
  { env: 'TU93',   standard: 0.0667, adapter: 1,   standardReplay: '4cdfd8b4-111e-4f56-a0fd-7ad8be6b9bf2', adapterReplay: '7c54faff-3875-43f3-8a06-ca25720b32c8' },
  { env: 'LF52',   standard: 0.1091, adapter: 1,   standardReplay: '0beb41f9-31a2-499f-9d5a-64f187ae1edd', adapterReplay: '248b7fbd-5f82-40bd-af6d-ff811283526a' },
  { env: 'SK48',   standard: 0.2111, adapter: 1,   standardReplay: '549f92a6-c1d5-4990-a3c4-91323c1fc8e8', adapterReplay: 'ec8d80f4-250f-47c4-948f-6e5d51379cb5' },
  { env: 'SU15',   standard: 0.4161, adapter: 1,   standardReplay: '68e24873-d70f-4115-8617-711e48454c15', adapterReplay: '2e3994e1-8760-4e47-89f3-7ec096fce420' },
  { env: 'SC25',   standard: 0.4762, adapter: 1,   standardReplay: '14734864-b319-4b44-832f-64b997351be0', adapterReplay: '2e83cea2-946f-4f51-9ce5-d7ca5c8576f3' },
  { env: 'TN36',   standard: 0.5357, adapter: 1,   standardReplay: 'f8c61b63-9b3c-4ad0-80ef-a5f9fcb5c330', adapterReplay: '6f5dd73e-fdf4-4b30-a87a-22e4557d8189' },
  { env: 'M0R0',   standard: 0.7143, adapter: 1,   standardReplay: 'd453ad9d-77ac-4228-a0a7-2cad831dd93c', adapterReplay: '37443746-b7f8-4d5c-9140-b623f00cabe7' },
  { env: 'VC33',   standard: 0.7329, adapter: 1,   standardReplay: '43f00290-8c55-4f09-9016-7c8f6709e9b7', adapterReplay: '150eaeb5-32e2-4c96-88ea-40b38638b375' },
  { env: 'KA59',   standard: 0.75,  adapter: 1,   standardReplay: '36989e6c-72fc-4b22-a48b-1e7988df6477', adapterReplay: 'a20bebda-f97c-4a72-940f-de03dae1833b' },
  { env: 'RE86',   standard: 0.7778, adapter: 1,   standardReplay: 'fcc4f8b7-01e5-4009-923d-1c7d1fcae9fe', adapterReplay: 'd7c629e9-5f79-4225-8344-53131c1c5dbc' },
  { env: 'WA30',   standard: 0.8,   adapter: 1,   standardReplay: 'be78fcef-1244-4cf8-b680-0a5e4e8f9afe', adapterReplay: '49ac7afb-b83a-46f4-bb1e-3ecc902ca291' },
  { env: 'LS20',   standard: 0.8345, adapter: 1,   standardReplay: 'f00f5439-8a69-4b13-8248-c864b82fb025', adapterReplay: 'c836fd19-5a16-4ca0-8d3f-afd48c73073e' },
  { env: 'AR25',   standard: 1,     adapter: 1,   standardReplay: 'c28b4a3f-69b3-416e-8137-3890497bc089', adapterReplay: 'ed09362c-eb47-41b8-bf46-2d275090be02' },
  { env: 'CD82',   standard: 1,     adapter: 1,   standardReplay: 'dc5800f9-f4be-4e93-8b54-111d19fba5d2', adapterReplay: 'f4cac4df-b688-49e1-8cef-02935d9ef885' },
  { env: 'CN04',   standard: 1,     adapter: 1,   standardReplay: '3cd20b12-b1c0-47e2-a3a1-406b6e4f75a7', adapterReplay: 'f6296e32-d4b0-4068-9bb0-3be64b8afef5' },
  { env: 'DC22',   standard: 1,     adapter: 1,   standardReplay: 'a3b944b0-1863-4e98-bfb3-6802d327311b', adapterReplay: 'eb980b49-c92d-4fdd-b5a0-ff2aa8254cb9' },
  { env: 'FT09',   standard: 1,     adapter: 1,   standardReplay: '237e4950-d4a3-4a82-a08a-2564b0250623', adapterReplay: '31df82b6-0491-45fc-abbd-c8ed5310d8c9' },
  { env: 'LP85',   standard: 1,     adapter: 1,   standardReplay: 'cff96635-40c2-4b26-bf5c-5b798f23a995', adapterReplay: 'ced68d8b-8d12-486a-adaf-cb49c1e646e7' },
  { env: 'R11L',   standard: 1,     adapter: 1,   standardReplay: 'e026fd52-5b68-477f-8388-72fdfd8c56cf', adapterReplay: '932837ac-8800-414f-9d7c-46537ebea3a3' },
  { env: 'S5I5',   standard: 1,     adapter: 1,   standardReplay: '39d9f100-328a-4121-ad81-ce298e1f9626', adapterReplay: '7609fe46-64be-4d12-b100-81733da7c768' },
  { env: 'SB26',   standard: 1,     adapter: 1,   standardReplay: '6066c7d2-601e-4d5c-9abc-9ba3b7ff57dd', adapterReplay: '7eebd5e4-fac6-47c7-b829-4ca32cc491e2' },
  { env: 'SP80',   standard: 1,     adapter: 1,   standardReplay: '9bb57638-7935-43de-b936-e66526d260f1', adapterReplay: '553aa4ea-9177-4bf2-b9bc-fb59d237cf89' },
  { env: 'TR87',   standard: 1,     adapter: 1,   standardReplay: '28185f71-d397-4228-819d-523b195190da', adapterReplay: '5c144b64-fd15-4913-bdc4-28feac5046ee' },
];

/** Environments where the Standard harness fell short of a full solve. */
export const ENVS_WITH_GAP = ASTRA_ENV_RESULTS.filter((e) => e.standard < 1).length;

/** Environments the Provider Adapter path solved outright. */
export const ENVS_ADAPTER_SOLVED = ASTRA_ENV_RESULTS.filter((e) => e.adapter >= 1).length;

export const ENV_TOTAL = ASTRA_ENV_RESULTS.length;

/** The widest gap in the set -- the example the prose leads on. */
export const WORST_ENV = ASTRA_ENV_RESULTS[0];
