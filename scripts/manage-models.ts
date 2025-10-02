/*
 * Author: Cascade using Deep Research Model
 * Date: 2025-09-30T16:30:00Z
 * PURPOSE: Automated model configuration management script to add/remove/update models in models.ts
 *          Reduces manual surgical edits by providing a standardized interface for model CRUD operations
 * SRP/DRY check: Pass - Handles only model configuration management
 * shadcn/ui: N/A - CLI script
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface ModelInput {
  key: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Gemini' | 'DeepSeek' | 'OpenRouter';
  color: string;
  premium: boolean;
  inputPrice: string;
  outputPrice: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsTemperature: boolean;
  isReasoning: boolean;
  responseSpeed: 'fast' | 'moderate' | 'slow';
  responseEstimate: string;
  releaseDate?: string;
  apiModelName?: string;
  supportsStructuredOutput?: boolean;
  requiresPromptFormat?: boolean;
}

const MODELS_FILE_PATH = resolve(__dirname, '../server/config/models.ts');

/**
 * Add a new model to models.ts
 */
function addModel(model: ModelInput): void {
  const fileContent = readFileSync(MODELS_FILE_PATH, 'utf-8');
  
  const modelConfig = generateModelConfig(model);
  
  // Find the closing bracket of the MODELS array
  const arrayEndIndex = fileContent.lastIndexOf('];');
  
  if (arrayEndIndex === -1) {
    throw new Error('Could not find MODELS array closing bracket');
  }
  
  // Insert the new model before the closing bracket
  const updatedContent = 
    fileContent.slice(0, arrayEndIndex) +
    '\n' + modelConfig + '\n' +
    fileContent.slice(arrayEndIndex);
  
  writeFileSync(MODELS_FILE_PATH, updatedContent, 'utf-8');
  console.log(`✅ Added model: ${model.name} (${model.key})`);
}

/**
 * Remove a model from models.ts by key
 */
function removeModel(key: string): void {
  const fileContent = readFileSync(MODELS_FILE_PATH, 'utf-8');
  
  // Find the model entry
  const modelRegex = new RegExp(
    `\\s*\\{[^}]*key:\\s*['"]${key}['"][^}]*\\},?\\s*`,
    'gs'
  );
  
  const match = fileContent.match(modelRegex);
  
  if (!match) {
    throw new Error(`Model with key "${key}" not found`);
  }
  
  const updatedContent = fileContent.replace(modelRegex, '\n');
  
  writeFileSync(MODELS_FILE_PATH, updatedContent, 'utf-8');
  console.log(`✅ Removed model: ${key}`);
}

/**
 * Generate TypeScript model configuration object
 */
function generateModelConfig(model: ModelInput): string {
  const config: string[] = [
    '  {',
    `    key: '${model.key}',`,
    `    name: '${model.name}',`,
    `    color: '${model.color}',`,
    `    premium: ${model.premium},`,
    `    cost: { input: '${model.inputPrice}', output: '${model.outputPrice}' },`,
    `    supportsTemperature: ${model.supportsTemperature},`,
    `    provider: '${model.provider}',`,
    `    responseTime: { speed: '${model.responseSpeed}', estimate: '${model.responseEstimate}' },`,
    `    isReasoning: ${model.isReasoning},`,
    `    apiModelName: '${model.apiModelName || model.key}',`,
    `    modelType: '${getModelType(model.provider)}',`,
  ];
  
  if (model.contextWindow) {
    config.push(`    contextWindow: ${model.contextWindow},`);
  }
  
  if (model.maxOutputTokens) {
    config.push(`    maxOutputTokens: ${model.maxOutputTokens},`);
  }
  
  if (model.releaseDate) {
    config.push(`    releaseDate: "${model.releaseDate}",`);
  }
  
  if (model.supportsStructuredOutput !== undefined) {
    config.push(`    supportsStructuredOutput: ${model.supportsStructuredOutput},`);
  }
  
  if (model.requiresPromptFormat !== undefined) {
    config.push(`    requiresPromptFormat: ${model.requiresPromptFormat},`);
  }
  
  config.push('  },');
  
  return config.join('\n');
}

/**
 * Get modelType based on provider
 */
function getModelType(provider: string): string {
  const typeMap: Record<string, string> = {
    'OpenAI': 'gpt5_chat',
    'Anthropic': 'claude',
    'Gemini': 'gemini',
    'DeepSeek': 'deepseek',
    'OpenRouter': 'openrouter'
  };
  
  return typeMap[provider] || 'openrouter';
}

/**
 * List all models in models.ts
 */
function listModels(): void {
  const fileContent = readFileSync(MODELS_FILE_PATH, 'utf-8');
  
  const keyRegex = /key:\s*['"]([^'"]+)['"]/g;
  const matches = [...fileContent.matchAll(keyRegex)];
  
  console.log('\n📋 Current Models:');
  console.log('==================');
  matches.forEach((match, index) => {
    console.log(`${index + 1}. ${match[1]}`);
  });
  console.log(`\nTotal: ${matches.length} models\n`);
}

// CLI Interface
const command = process.argv[2];

switch (command) {
  case 'add':
    // Example: npm run manage-models add
    console.log('⚠️  Use this script programmatically. See examples in the file.');
    break;
    
  case 'remove':
    const keyToRemove = process.argv[3];
    if (!keyToRemove) {
      console.error('❌ Please provide a model key to remove');
      process.exit(1);
    }
    removeModel(keyToRemove);
    break;
    
  case 'list':
    listModels();
    break;
    
  default:
    console.log(`
🛠️  Model Configuration Manager

Usage:
  npm run manage-models list              - List all models
  npm run manage-models remove <key>      - Remove a model by key

Programmatic Usage (import this file):
  import { addModel } from './scripts/manage-models';
  
  addModel({
    key: 'provider/model-name',
    name: 'Display Name',
    provider: 'OpenRouter',
    color: 'bg-blue-500',
    premium: false,
    inputPrice: '$0.50',
    outputPrice: '$2.00',
    contextWindow: 200000,
    maxOutputTokens: 128000,
    supportsTemperature: true,
    isReasoning: true,
    responseSpeed: 'moderate',
    responseEstimate: '1-2 min',
    releaseDate: '2025-09'
  });
    `);
}

// Export functions for programmatic use
export { addModel, removeModel, listModels };
