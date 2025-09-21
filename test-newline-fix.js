/**
 * Test script to verify the newline cleaning fix
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-20
 * PURPOSE: Test the OpenRouter response cleaning logic with problematic inputs
 * SRP and DRY check: Pass - Single purpose test script
 */

// Simulate the problematic response pattern
const problematicResponse1 = `\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n\n         \n{"id":"gen-1758261701-ssNGmJgP76WrsuQysdBk","provider":"xAI","model":"x-ai/grok-code-fast-1","object":"chat.completion","created":1758261701,"choices":[{"logprobs":null,"finish_reason":"stop","message":{"content":"{\\"solvingStrategy\\": \\"Test strategy\\", \\"confidence\\": 85}"}}]}`;

// Test with reasoning before JSON (potential issue)
const responseWithReasoning = `
Let me think about this puzzle step by step.

First, I need to analyze the pattern...
This is important reasoning that we might want to preserve.

{"solvingStrategy": "Pattern analysis", "confidence": 90}
`;

// Test with markdown code blocks
const responseWithMarkdown = `
Here's my analysis:

\`\`\`json
{"solvingStrategy": "Markdown wrapped", "confidence": 75}
\`\`\`
`;

// Simulate the cleaning function
function cleanResponseText(responseText) {
    if (!responseText) return responseText;

    // Find the first occurrence of '{' (start of JSON)
    const jsonStartIndex = responseText.indexOf('{');
    if (jsonStartIndex === -1) {
        // No JSON found, return trimmed original
        return responseText.trim();
    }

    // Extract everything from the first '{' onward
    const cleanedText = responseText.substring(jsonStartIndex);

    console.log(`Cleaned ${responseText.length - cleanedText.length} leading characters from response`);
    return cleanedText;
}

// Test the cleaning function
console.log('=== Testing Newline Cleaning Fix ===\n');

console.log('1. Problematic response with excessive newlines:');
console.log('Original length:', problematicResponse1.length);
console.log('First 100 chars:', JSON.stringify(problematicResponse1.substring(0, 100)));
const cleaned1 = cleanResponseText(problematicResponse1);
console.log('Cleaned length:', cleaned1.length);
console.log('First 100 chars after cleaning:', JSON.stringify(cleaned1.substring(0, 100)));

try {
    const parsed1 = JSON.parse(cleaned1);
    console.log('✅ JSON parsing successful');
    console.log('Message content:', parsed1.choices[0].message.content);
} catch (error) {
    console.log('❌ JSON parsing failed:', error.message);
}

console.log('\n2. Response with reasoning (potential data loss):');
console.log('Original:', JSON.stringify(responseWithReasoning.substring(0, 100)));
const cleaned2 = cleanResponseText(responseWithReasoning);
console.log('Cleaned:', JSON.stringify(cleaned2.substring(0, 50)));
console.log('⚠️  Lost reasoning text:', responseWithReasoning.substring(0, responseWithReasoning.indexOf('{')).trim());

console.log('\n3. Response with markdown:');
const cleaned3 = cleanResponseText(responseWithMarkdown);
console.log('Cleaned:', JSON.stringify(cleaned3));
console.log('⚠️  This will fail because it includes markdown formatting');

try {
    JSON.parse(cleaned3);
    console.log('✅ Parsed successfully');
} catch (error) {
    console.log('❌ Failed to parse markdown case:', error.message);
}

console.log('\n=== Edge Case Analysis ===');
console.log('Issues with current approach:');
console.log('1. Loses reasoning text that might be valuable');
console.log('2. Fails with markdown-wrapped JSON');
console.log('3. Very crude - just chops at first {');
console.log('4. Might break with multiple JSON objects or complex structures');