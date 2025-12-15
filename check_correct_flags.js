const data = require('./beetreeARC/logs/submissions/1ae2feb7.json');

console.log(`\n1ae2feb7.json has ${data.length} test pairs\n`);

data.forEach((pair, i) => {
  console.log(`Pair ${i}:`);
  console.log(`  attempt_1.correct = ${pair.attempt_1.correct}`);
  console.log(`  attempt_2.correct = ${pair.attempt_2.correct}`);
});
