import fs from 'fs';

const submissionPath = './beetreeARC/logs/submissions/1ae2feb7.json';
const raw = fs.readFileSync(submissionPath, 'utf8');
const submission = JSON.parse(raw);

console.log(`\nSubmission file loaded`);
console.log(`Type: ${Array.isArray(submission) ? 'ARRAY' : 'OBJECT'}`);
console.log(`Length: ${submission.length || 'N/A'}`);

if (Array.isArray(submission)) {
  submission.forEach((pair, i) => {
    const has1 = pair.attempt_1 ? 'yes' : 'NO';
    const has2 = pair.attempt_2 ? 'yes' : 'NO';
    const idx = pair.attempt_1?.metadata?.pair_index ?? 'MISSING';
    console.log(`  [${i}] pair_index=${idx}, attempt_1=${has1}, attempt_2=${has2}`);
  });
}
