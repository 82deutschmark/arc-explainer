/**
 * Author: GPT-5.2 Codex CLI
 * Date: 2025-12-12
 * PURPOSE: Shared curated Worm Arena live matchups.
 *          Provides a small, maintainable gallery of statistically useful 1v1 pairings
 *          for WormArenaLive. Exported from shared so both client and server can
 *          reference the same ids/types if needed later.
 * SRP/DRY check: Pass - single responsibility config + helpers.
 */

export type CuratedMatchupCategory =
  | 'budget'
  | 'premium'
  | 'cross-tier'
  | 'rivalry'
  | 'placement';

export interface CuratedMatchup {
  id: string;
  category: CuratedMatchupCategory;
  modelA: string;
  modelB: string;
  displayName: string;
  description: string;
  icon: string;
  isDefault?: boolean;
}

export const CURATED_MATCHUPS: CuratedMatchup[] = [
  {
    id: 'gpt5-nano-vs-nano',
    category: 'budget',
    modelA: 'openai/gpt-5-nano',
    modelB: 'openai/gpt-5-nano',
    displayName: 'GPT-5 Nano vs GPT-5 Nano',
    description: 'Fastest, cheapest mirror match for quick live testing',
    icon: '🧪',
    isDefault: true,
  },
  {
    id: 'gpt52-vs-nano',
    category: 'cross-tier',
    modelA: 'openai/gpt-5.2',
    modelB: 'openai/gpt-5-nano',
    displayName: 'GPT-5.2 vs GPT-5 Nano',
    description: 'Latest GPT flagship vs budget ($14 vs $0.40 output)',
    icon: '⚡',
  },
  {
    id: 'deepseek-v32-vs-ministral3b',
    category: 'budget',
    modelA: 'deepseek/deepseek-v3.2',
    modelB: 'mistralai/ministral-3b-2512',
    displayName: 'DeepSeek v3.2 vs Ministral 3B',
    description: 'New reasoning vs micro model ($0.42 vs $0.10)',
    icon: '💰',
  },
  {
    id: 'free-devstral-vs-olmo3',
    category: 'budget',
    modelA: 'mistralai/devstral-2512:free',
    modelB: 'allenai/olmo-3-32b-think:free',
    displayName: 'Devstral Free vs OLMo-3 Think',
    description: 'Latest free coding vs thinking ($0 vs $0)',
    icon: '🎁',
  },
  {
    id: 'gpt52-vs-gemini3-preview',
    category: 'premium',
    modelA: 'openai/gpt-5.2',
    modelB: 'google/gemini-3-pro-preview',
    displayName: 'GPT-5.2 vs Gemini 3 Pro Preview',
    description: 'Latest OpenAI vs Google flagship ($14 vs $12–18)',
    icon: '👑',
  },
  {
    id: 'gpt51-vs-claude-sonnet45',
    category: 'rivalry',
    modelA: 'openai/gpt-5-mini',
    modelB: 'anthropic/claude-sonnet-4-5',
    displayName: 'GPT-5-Mini vs Claude Sonnet 4.5',
    description: 'OpenAI vs Anthropic reasoning duel',
    icon: '🔥',
  },
  {
    id: 'grok41-vs-gpt52',
    category: 'rivalry',
    modelA: 'x-ai/grok-4.1-fast',
    modelB: 'openai/gpt-5.2',
    displayName: 'Grok 4.1 Fast vs GPT-5.2',
    description: 'xAI 2M context vs OpenAI flagship',
    icon: '🚀',
  },
  {
    id: 'mistral-large-vs-gpt5-nano',
    category: 'cross-tier',
    modelA: 'mistralai/mistral-large-2512',
    modelB: 'openai/gpt-5-nano',
    displayName: 'Mistral Large vs GPT-5 Nano',
    description: 'Premium vs ultra-cheap reasoning',
    icon: '🎯',
  },
  {
    id: 'amazon-nova-vs-gemini-flash',
    category: 'placement',
    modelA: 'amazon/nova-2-lite-v1:free',
    modelB: 'google/gemini-2.5-flash-lite-preview-09-2025',
    displayName: 'Nova 2 Lite vs Gemini Flash-Lite',
    description: 'New AWS vs Google budget models',
    icon: '🆕',
  },
  {
    id: 'glm46v-vs-nemotron-vl',
    category: 'placement',
    modelA: 'z-ai/glm-4.6v',
    modelB: 'nvidia/nemotron-nano-12b-v2-vl:free',
    displayName: 'GLM 4.6V vs Nemotron VL',
    description: 'Vision-language model comparison',
    icon: '👁️',
  },
  {
    id: 'olmo3-vs-kat-coder',
    category: 'placement',
    modelA: 'allenai/olmo-3-7b-think',
    modelB: 'kwaipilot/kat-coder-pro:free',
    displayName: 'OLMo-3 Think vs Kat Coder Pro',
    description: 'New thinking models head-to-head',
    icon: '💭',
  },
];

export function getCuratedMatchups(category?: CuratedMatchupCategory): CuratedMatchup[] {
  if (!category) return CURATED_MATCHUPS;
  return CURATED_MATCHUPS.filter((m) => m.category === category);
}

export function getDefaultMatchup(): CuratedMatchup {
  return CURATED_MATCHUPS.find((m) => m.isDefault) ?? CURATED_MATCHUPS[0];
}

