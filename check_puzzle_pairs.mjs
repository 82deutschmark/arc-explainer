import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/evaluation2/1ae2feb7.json', 'utf8'));

console.log(`\nTask 1ae2feb7 has ${data.test?.length || 0} required test pairs\n`);

if (data.test) {
  data.test.forEach((t, i) => {
    const inShape = t.input ? `${t.input[0].length}x${t.input.length}` : 'N/A';
    const outShape = t.output ? `${t.output[0].length}x${t.output.length}` : 'N/A';
    console.log(`  Pair ${i}: input=${inShape}, output=${outShape}`);
  });
}
