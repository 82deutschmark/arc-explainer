// Debug the exact character codes in the problematic response
const problematic = `\n         \n\n         \n\n         \n\n         \n`;

console.log('Character analysis:');
for (let i = 0; i < Math.min(50, problematic.length); i++) {
    const char = problematic[i];
    const code = char.charCodeAt(0);
    console.log(`Index ${i}: "${char}" (code: ${code}) ${code === 10 ? '[LF]' : code === 13 ? '[CR]' : code === 32 ? '[SPACE]' : ''}`);
}

console.log('\nTrim test:');
console.log('Original length:', problematic.length);
console.log('After trim:', problematic.trim().length);
console.log('First 20 chars after trim:', JSON.stringify(problematic.trim().substring(0, 20)));