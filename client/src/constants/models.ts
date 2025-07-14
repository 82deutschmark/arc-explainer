/**
 * Models configuration constants for the ARC Explainer
 * Contains all available AI models and their properties
 * Author: Cascade
 */

import { ModelConfig } from '../types/puzzle';

/**
 * Colors for grid cells representing different values
 */
export const CELL_COLORS = [
  '#000000', '#0074D9', '#FF4136', '#2ECC40', '#FFDC00',
  '#AAAAAA', '#F012BE', '#FF851B', '#7FDBFF', '#870C25'
] as const;

/**
 * Available AI models for puzzle analysis
 */
export const MODELS: ModelConfig[] = [
  // OpenAI Models
  { 
    key: 'gpt-4.1-nano-2025-04-14', 
    name: 'GPT-4.1 Nano', 
    color: 'bg-blue-500', 
    premium: false,
    cost: { input: '$0.10', output: '$0.40' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'fast', estimate: '<30 sec' }
  },
  { 
    key: 'gpt-4.1-mini-2025-04-14', 
    name: 'GPT-4.1 Mini', 
    color: 'bg-purple-500', 
    premium: false,
    cost: { input: '$0.40', output: '$1.60' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' }
  },
  { 
    key: 'gpt-4o-mini-2024-07-18', 
    name: 'GPT-4o Mini', 
    color: 'bg-orange-500', 
    premium: false,
    cost: { input: '$0.15', output: '$0.60' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' }
  },
  { 
    key: 'o3-mini-2025-01-31', 
    name: 'o3-mini', 
    color: 'bg-red-500', 
    premium: true,
    cost: { input: '$1.10', output: '$4.40' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' }
  },
  { 
    key: 'o4-mini-2025-04-16', 
    name: 'o4-mini', 
    color: 'bg-pink-500', 
    premium: true,
    cost: { input: '$1.10', output: '$4.40' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-3 min' }
  },
  { 
    key: 'o3-2025-04-16', 
    name: 'o3-2025-04-16', 
    color: 'bg-green-500', 
    premium: true,
    cost: { input: '$2', output: '$8' },
    supportsTemperature: false,
    provider: 'OpenAI',
    responseTime: { speed: 'slow', estimate: '3-5+ min' }
  },
  { 
    key: 'gpt-4.1-2025-04-14', 
    name: 'GPT-4.1', 
    color: 'bg-yellow-500', 
    premium: true,
    cost: { input: '$2.00', output: '$8.00' },
    supportsTemperature: true,
    provider: 'OpenAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' }
  },
  
  // Anthropic Models
  { 
    key: 'claude-sonnet-4-20250514', 
    name: 'Claude Sonnet 4', 
    color: 'bg-indigo-500', 
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '1-3 min' }
  },
  { 
    key: 'claude-3-7-sonnet-20250219', 
    name: 'Claude 3.7 Sonnet', 
    color: 'bg-indigo-400', 
    premium: false,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '1-2 min' }
  },
  { 
    key: 'claude-3-5-sonnet-20241022', 
    name: 'Claude 3.5 Sonnet', 
    color: 'bg-violet-500', 
    premium: false,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '1-2 min' }
  },
  { 
    key: 'claude-3-5-haiku-20241022', 
    name: 'Claude 3.5 Haiku', 
    color: 'bg-violet-400', 
    premium: false,
    cost: { input: '$0.80', output: '$4.00' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'moderate', estimate: '30-60 sec' }
  },
  { 
    key: 'claude-3-haiku-20240307', 
    name: 'Claude 3 Haiku', 
    color: 'bg-purple-400', 
    premium: false,
    cost: { input: '$0.25', output: '$1.25' },
    supportsTemperature: true,
    provider: 'Anthropic',
    responseTime: { speed: 'fast', estimate: '<60 sec' }
  },
  // xAI Grok Models
  {
    key: 'grok-4-0709',
    name: 'Grok 4 (July 2025)',
    color: 'bg-gray-900',
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: false,
    provider: 'xAI',
    responseTime: { speed: 'slow', estimate: '3-5+ min' }
  },
  {
    key: 'grok-3',
    name: 'Grok 3',
    color: 'bg-gray-600',
    premium: true,
    cost: { input: '$3.00', output: '$15.00' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'slow', estimate: '3-5+ min' }
  },
  {
    key: 'grok-3-mini',
    name: 'Grok 3 Mini',
    color: 'bg-gray-500',
    premium: false,
    cost: { input: '$0.30', output: '$0.50' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'moderate', estimate: '1-2 min' }
  },
  {
    key: 'grok-3-mini-fast',
    name: 'Grok 3 Mini Fast',
    color: 'bg-gray-600',
    premium: false,
    cost: { input: '$0.60', output: '$4.00' },
    supportsTemperature: true,
    provider: 'xAI',
    responseTime: { speed: 'fast', estimate: '30-60 sec' }
  }
];

/**
 * Helper function to format confidence scores
 * @param confidence - Confidence value as number or string
 * @returns Formatted confidence string as percentage
 */
export function formatConfidence(confidence: number | string): string {
  if (typeof confidence === 'string') {
    return confidence;
  }
  return confidence > 1 
    ? `${Math.round(confidence)}%`
    : `${Math.round(confidence * 100)}%`;
}
