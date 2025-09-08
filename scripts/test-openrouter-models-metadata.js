/**
 * Test OpenRouter model metadata for problematic models
 * GET /api/v1/models to verify context_length, supported_parameters
 * 
 * @author Cascade
 */

import https from 'https';
import { config } from 'dotenv';

config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PROBLEMATIC_MODELS = [
  'x-ai/grok-code-fast-1',
  'qwen/qwen3-235b-a22b-thinking-2507', 
  'nousresearch/hermes-4-70b'
];

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found');
  process.exit(1);
}

async function checkModelMetadata() {
  console.log('🔍 Checking OpenRouter model metadata...\n');
  
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
          
          console.log(`📊 Total models available: ${models.length}\n`);
          
          PROBLEMATIC_MODELS.forEach(modelName => {
            const model = models.find(m => m.id === modelName);
            
            if (model) {
              console.log(`✅ ${modelName}:`);
              console.log(`   Context Length: ${model.context_length}`);
              console.log(`   Top Provider: ${model.top_provider?.name || 'N/A'}`);
              console.log(`   Pricing: $${model.pricing?.prompt || 'N/A'} / $${model.pricing?.completion || 'N/A'}`);
              console.log(`   Supports Tools: ${model.supported_parameters?.includes('tools') || false}`);
              console.log(`   Supports JSON: ${model.supported_parameters?.includes('response_format') || false}`);
              console.log(`   Supports Stream: ${model.supported_parameters?.includes('stream') || false}`);
              console.log(`   All Parameters: [${model.supported_parameters?.join(', ') || 'N/A'}]`);
            } else {
              console.log(`❌ ${modelName}: NOT FOUND`);
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
  .then(() => console.log('🎯 Model metadata check complete'))
  .catch(error => console.error('❌ Error:', error.message));
