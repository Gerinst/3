// Run each suite in a fresh process so globals, fake clocks and parser state cannot leak.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const mainOnly = process.argv.includes('--main-only') || process.env.AVIS_TEST_SCOPE === 'main';
const suites = [
  'multiple-advices.cjs', 'subject-conflict.cjs', 'review-routing.cjs', 'runtime-budget.cjs',
  'safety-semantics.cjs', 'safety-multiple.cjs', 'safety-formats.cjs',
  'safety-runtime.cjs', 'safety-envelope.cjs', 'safety-flow.cjs', 'safety-volume.cjs',
];
if (mainOnly) console.log('Scope: main flow and parser only; Plan B is excluded.');
let failed = 0;
for (const suite of suites) {
  console.log(`\n${suite}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, suite)], {
    stdio: 'inherit', timeout: 180000,
    env: { ...process.env, ...(mainOnly ? { AVIS_TEST_SCOPE: 'main' } : {}) },
  });
  if (result.error || result.status !== 0) {
    failed++;
    console.error(`FAILED: ${suite}`, result.error?.message || result.signal || result.status);
  }
}
console.log(`\n${suites.length - failed}/${suites.length} suites passed.`);
process.exitCode = failed ? 1 : 0;
