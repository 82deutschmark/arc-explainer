/**
 * Script to fix database queries to include reasoning log columns
 * This ensures the frontend can display reasoning logs from AI models
 * Author: Cascade
 */

import fs from 'fs';
import path from 'path';

const dbServicePath = path.join(process.cwd(), 'server', 'services', 'dbService.ts');

try {
  console.log('🔄 Reading dbService.ts...');
  let content = fs.readFileSync(dbServicePath, 'utf8');
  
  // Fix the getExplanationsForPuzzle query
  const oldQuery1 = `         e.model_name              AS "modelName",
         e.created_at              AS "createdAt",`;
  
  const newQuery1 = `         e.model_name              AS "modelName",
         e.reasoning_log           AS "reasoningLog",
         e.has_reasoning_log       AS "hasReasoningLog",
         e.created_at              AS "createdAt",`;
  
  if (content.includes(oldQuery1)) {
    content = content.replace(oldQuery1, newQuery1);
    console.log('✅ Fixed getExplanationsForPuzzle query');
  } else {
    console.log('ℹ️  getExplanationsForPuzzle query already updated or pattern not found');
  }
  
  // Also fix the getExplanationForPuzzle query (single explanation)
  const oldQuery2 = `          e.model_name              AS "modelName",
          e.created_at              AS "createdAt",`;
  
  const newQuery2 = `          e.model_name              AS "modelName",
          e.reasoning_log           AS "reasoningLog",
          e.has_reasoning_log       AS "hasReasoningLog",
          e.created_at              AS "createdAt",`;
  
  if (content.includes(oldQuery2)) {
    content = content.replace(oldQuery2, newQuery2);
    console.log('✅ Fixed getExplanationForPuzzle query');
  } else {
    console.log('ℹ️  getExplanationForPuzzle query already updated or pattern not found');
  }
  
  // Write the updated content back
  fs.writeFileSync(dbServicePath, content, 'utf8');
  console.log('✅ Database queries updated successfully!');
  console.log('🔄 Please restart your server to see reasoning logs in the UI');
  
} catch (error) {
  console.error('❌ Error updating database queries:', error.message);
  process.exit(1);
}
