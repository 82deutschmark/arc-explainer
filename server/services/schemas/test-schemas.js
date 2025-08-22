/**
 * Quick test script to validate our JSON schemas work correctly
 * Run with: node server/services/schemas/test-schemas.js
 */

import { SINGLE_SOLVER_SCHEMA, MULTI_SOLVER_SCHEMA, createSampleSolverResponse, validateSolverResponse } from './solver.js';
import { STANDARD_EXPLANATION_SCHEMA, ALIEN_EXPLANATION_SCHEMA, createSampleExplanationResponse, validateExplanationResponse } from './explanation.js';

console.log('🧪 Testing JSON Schemas...\n');

// Test solver schemas
console.log('📊 Solver Schema Tests:');
console.log('Single solver schema:', JSON.stringify(SINGLE_SOLVER_SCHEMA, null, 2));

const singleResponse = createSampleSolverResponse(1);
const singleValidation = validateSolverResponse(singleResponse, 1);
console.log('Single response validation:', singleValidation.isValid ? '✅' : '❌', singleValidation.errors);

const multiResponse = createSampleSolverResponse(2);
const multiValidation = validateSolverResponse(multiResponse, 2);
console.log('Multi response validation:', multiValidation.isValid ? '✅' : '❌', multiValidation.errors);

// Test explanation schemas
console.log('\n📝 Explanation Schema Tests:');
console.log('Standard explanation schema:', JSON.stringify(STANDARD_EXPLANATION_SCHEMA, null, 2));

const standardResponse = createSampleExplanationResponse(false);
const standardValidation = validateExplanationResponse(standardResponse, false);
console.log('Standard response validation:', standardValidation.isValid ? '✅' : '❌', standardValidation.errors);

const alienResponse = createSampleExplanationResponse(true);
const alienValidation = validateExplanationResponse(alienResponse, true);
console.log('Alien response validation:', alienValidation.isValid ? '✅' : '❌', alienValidation.errors);

console.log('\n✨ Schema validation complete!');