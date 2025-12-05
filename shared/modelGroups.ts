/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Model grouping configuration for organizing models by provider and family in the UI.
 *          Provides hierarchical structure for the PuzzleExaminer model selection interface.
 * SRP/DRY check: Pass - Encapsulates model grouping logic separate from model definitions.
 */

export interface ModelFamily {
  id: string;
  name: string;
  description?: string;
  modelKeys: string[];
}

export interface ProviderGroup {
  id: string;
  name: string;
  icon: string;
  defaultOpen: boolean;
  families: ModelFamily[];
}

export const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    defaultOpen: true,
    families: [
      {
        id: 'gpt5',
        name: 'GPT-5 Series',
        description: 'Latest GPT-5 models with advanced reasoning',
        modelKeys: [
          'gpt-5-2025-08-07',
          'gpt-5-chat-latest',
          'gpt-5-mini-2025-08-07',
          'gpt-5-nano-2025-08-07'
        ]
      },
      {
        id: 'o-series',
        name: 'o-Series Reasoning',
        description: 'Deep reasoning models optimized for complex tasks',
        modelKeys: [
          'o3-2025-04-16',
          'o3-mini-2025-01-31',
          'o4-mini-2025-04-16'
        ]
      },
      {
        id: 'gpt4',
        name: 'GPT-4.x Series',
        description: 'GPT-4 generation models',
        modelKeys: [
          'gpt-4.1-2025-04-14',
          'gpt-4.1-mini-2025-04-14',
          'gpt-4.1-nano-2025-04-14',
          'gpt-4o-mini-2024-07-18'
        ]
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    defaultOpen: true,
    families: [
      {
        id: 'claude4',
        name: 'Claude 4.x Series',
        description: 'Latest Claude 4 models with extended context',
        modelKeys: [
          'claude-sonnet-4-5-20250929',
          'claude-sonnet-4-20250514',
          'claude-haiku-4-5-20251015'
        ]
      },
      {
        id: 'claude3',
        name: 'Claude 3.x Series',
        description: 'Claude 3 generation models',
        modelKeys: [
          'claude-3-7-sonnet-20250219',
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-haiku-20240307'
        ]
      }
    ]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '💎',
    defaultOpen: true,
    families: [
      {
        id: 'gemini25',
        name: 'Gemini 2.5 Series',
        description: 'Latest Gemini models',
        modelKeys: [
          'gemini-2.5-pro',
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite'
        ]
      },
      {
        id: 'gemini20',
        name: 'Gemini 2.0 Series',
        description: 'Gemini 2.0 models',
        modelKeys: [
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite'
        ]
      }
    ]
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    icon: '⚡',
    defaultOpen: false,
    families: [
      {
        id: 'grok4',
        name: 'All Models',
        modelKeys: [
          'grok-4',
          'grok-4-fast-reasoning',
          'grok-4-fast-non-reasoning'
        ]
      }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔍',
    defaultOpen: false,
    families: [
      {
        id: 'deepseek-main',
        name: 'All Models',
        modelKeys: [
          'deepseek-chat',
          'deepseek-reasoner'
        ]
      }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter Multi-Provider',
    icon: '🌐',
    defaultOpen: false,
    families: [
      {
        id: 'or-grok',
        name: 'Grok',
        modelKeys: [
          'x-ai/grok-4.1-fast',
          'x-ai/grok-3',
          'x-ai/grok-3-mini',
          'x-ai/grok-3-mini-fast',
          'x-ai/grok-code-fast-1'
        ]
      },
      {
        id: 'or-deepseek',
        name: 'DeepSeek',
        modelKeys: [
          'deepseek/deepseek-chat-v3.1',
          'deepseek/deepseek-v3.1-terminus'
        ]
      },
      {
        id: 'or-qwen',
        name: 'Qwen',
        description: 'Alibaba Qwen models',
        modelKeys: [
          'qwen/qwen-plus-2025-07-28:thinking',
          'qwen/qwen3-coder'
        ]
      },
      {
        id: 'or-moonshot',
        name: 'Moonshot Kimi',
        description: 'Kimi reasoning models',
        modelKeys: [
          'moonshotai/kimi-k2-thinking',
          'moonshotai/kimi-dev-72b:free'
        ]
      },
      {
        id: 'or-mistral',
        name: 'Mistral',
        description: 'Mistral AI models',
        modelKeys: [
          'mistralai/mistral-large-2512',
          'mistralai/codestral-2508'
        ]
      },
      {
        id: 'or-nvidia',
        name: 'NVIDIA Nemotron',
        description: 'NVIDIA Nemotron models',
        modelKeys: [
          'nvidia/nemotron-nano-9b-v2',
          'nvidia/nemotron-nano-12b-v2-vl:free'
        ]
      },
      {
        id: 'or-openai',
        name: 'OpenAI',
        modelKeys: [
          'openai/gpt-5.1',
          'openai/gpt-oss-120b'
        ]
      },
      {
        id: 'or-gemini',
        name: 'Gemini',
        modelKeys: [
          'google/gemini-3-pro-preview',
          'google/gemini-2.5-flash-preview-09-2025'
        ]
      },
      {
        id: 'or-other',
        name: 'Other Models',
        description: 'Additional models available via OpenRouter',
        modelKeys: [
          'anthropic/claude-haiku-4.5',
          'meta-llama/llama-3.3-70b-instruct',
          'nousresearch/hermes-4-70b',
          'amazon/nova-premier-v1',
          'minimax/minimax-m2',
          'z-ai/glm-4.6'
        ]
      }
    ]
  }
];
