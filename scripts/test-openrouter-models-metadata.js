/**
 * Test OpenRouter model metadata for all configured models
 * GET /api/v1/models to verify context_length, supported_parameters
 * 
 * @author Cascade using code-supernove
 * @date 2025-09-24
 * PURPOSE: Test metadata for all OpenRouter models configured in the project
 * SRP and DRY check: Pass - This script is focused solely on testing OpenRouter model metadata
 */

import https from 'https';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import model definitions to get all OpenRouter models
const modelsPath = join(__dirname, '..', 'server', 'config', 'models.ts');
const modelsModule = await import(modelsPath);
const ALL_MODELS = modelsModule.MODELS;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY not found');
  process.exit(1);
}

// Get all OpenRouter models from configuration
const OPENROUTER_MODELS = ALL_MODELS
  .filter(model => model.provider === 'OpenRouter')
  .map(model => model.apiModelName || model.key);

console.log(`Found ${OPENROUTER_MODELS.length} OpenRouter models in configuration:`);
OPENROUTER_MODELS.forEach(model => console.log(`   - ${model}`));
console.log('');

async function checkModelMetadata() {
  console.log('Checking OpenRouter model metadata...\n');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const models = response.data || [];
          
          console.log(`Total models available in OpenRouter API: ${models.length}\n`);
          
          OPENROUTER_MODELS.forEach(modelName => {
            const model = models.find(m => m.id === modelName);
            
            if (model) {
              console.log(`${modelName}:`);
              console.log(`   Context Length: ${model.context_length}`);
              console.log(`   Top Provider: ${model.top_provider?.name || 'N/A'}`);
              console.log(`   Pricing: $${model.pricing?.prompt || 'N/A'} / $${model.pricing?.completion || 'N/A'}`);
              console.log(`   Supports Tools: ${model.supported_parameters?.includes('tools') || false}`);
              console.log(`   Supports JSON: ${model.supported_parameters?.includes('response_format') || false}`);
              console.log(`   Supports Stream: ${model.supported_parameters?.includes('stream') || false}`);
              console.log(`   All Parameters: [${model.supported_parameters?.join(', ') || 'N/A'}]`);
            } else {
              console.log(`${modelName}: NOT FOUND in OpenRouter API`);
            }
            console.log('');
          });
          
          resolve(models);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

checkModelMetadata()
  .then(() => console.log('Model metadata check complete'))
  .catch(error => console.error('Error:', error.message));
