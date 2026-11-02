// Local sync-to-async compatibility checks using the archived Office Scripts emulator.
// This is a model check, not execution in Microsoft's Office Script runtime.
// Usage: npm ci && npm run test:office
// An optional first argument or OSEMU_TS can point to another installation of TypeScript 5.9.3.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { load, eml, pdf, textAdvice, fixtures } = require('./fixtures.cjs');
const { xlsx, ods, msg, cmsSigned } = require('./format-fixtures/builders.cjs');

const tsPath = process.argv[2] ? path.resolve(process.argv[2]) : process.env.OSEMU_TS || require.resolve('typescript');
const ts = require(tsPath);
assert.equal(ts.version, '5.9.3', 'The archived emulator is checked with pinned TypeScript 5.9.3.');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-office-compat-'));
const fixtureDir = path.join(work, 'fixtures');
fs.mkdirSync(fixtureDir);
const source = path.resolve(__dirname, '../dist/AvisV2.ts');
const emulator = path.join(__dirname, 'office/osemu.cjs');

const samples = {
  'single.pdf': pdf(textAdvice('1.200,30')),
  'single.eml': Buffer.from(eml({ attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30')) }] }), 'base64'),
  'multiple.eml': Buffer.from(eml(fixtures.pdf), 'base64'),
  'body.eml': Buffer.from(eml({ body: textAdvice('1.200,30') }), 'base64'),
  'ordinary.eml': Buffer.from(eml({ subject: 'Termin', body: 'Unser Termin ist morgen um 10 Uhr.' }), 'base64'),
  'missing.eml': Buffer.from(eml({ subject: 'Zahlungsavis', body: 'Das Avis finden Sie in unserem Kundenportal.' }), 'base64'),
  'damaged.pdf': '%PDF-1.4\n%%EOF',
  'advice.xlsx': xlsx(),
  'advice.ods': ods(),
  'advice.xml': '<RemittanceAdvice><PaymentAmount Ccy="EUR">1200.30</PaymentAmount></RemittanceAdvice>',
  'advice.json': JSON.stringify({ RemittanceAdvice: { PaymentAmount: 1200.3, Currency: 'EUR' } }),
  'advice.rtf': '{\\rtf1\\ansi Zahlungsavis\\par Wir haben Ihre Rechnungen heute bezahlt.\\par Zahlbetrag: 1.200,30 EUR}',
  'advice.html': '<html><body><h1>Zahlungsavis</h1><p>Wir haben Ihre Rechnungen heute bezahlt.</p><p>Zahlbetrag: 1.200,30 EUR</p></body></html>',
  'advice.msg': msg('Zahlungsavis', textAdvice('1.200,30')),
  'advice.p7m': cmsSigned(Buffer.from(eml({ body: textAdvice('1.200,30') }), 'base64')),
};
const sync = load();
const expected = {}, baseline = {};
for (const [name, input] of Object.entries(samples)) {
  const bytes = Buffer.from(input);
  fs.writeFileSync(path.join(fixtureDir, name), bytes);
  sync.officeInput = bytes.toString('base64');
  const result = vm.runInContext("main({}, officeInput, '', 'Office Test')", sync, { timeout: 10000 });
  baseline[name] = JSON.parse(JSON.stringify(result));
  expected[name] = { mailSubject: 'Office Test', verdict: result.verdict, category: result.category,
    confidence: result.confidence, subjectPrefix: result.subjectPrefix, newSubject: result.newSubject };
}
fs.writeFileSync(path.join(fixtureDir, 'expected.json'), JSON.stringify(expected));

function emulate(file, model, emit, run, label) {
  const report = path.join(work, label + '.json');
  const args = [emulator, file, '--model', model, '--emit', emit,
    '--json', report, '--quiet', ...(run ? ['--run', '--fixtures', fixtureDir] : [])];
  const child = spawnSync(process.execPath, args, {
    env: { ...process.env, OSEMU_TS: tsPath }, cwd: work, encoding: 'utf8',
    timeout: 180000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(child.status, 0, label + ': ' + (child.error?.message || child.stderr || child.stdout));
  return JSON.parse(fs.readFileSync(report, 'utf8'));
}

// Harness calibration: it must detect the constructor call that caused the regression.
const broken = path.join(work, 'constructor-regression.ts');
const text = fs.readFileSync(source, 'utf8');
assert(text.includes('constructor(s: string, pos: number) {'));
fs.writeFileSync(broken, text.replace('constructor(s: string, pos: number) {',
  'constructor(s: string, pos: number) { checkRunDeadline();'));
const regression = emulate(broken, 'M2', 'paren', false, 'calibration');
assert(regression.static.errors.some(error => error.owner === 'Lexer.constructor'), 'Constructor regression was not detected.');
assert(regression.emits.paren.first, 'Broken constructor unexpectedly parsed.');

let comparisons = 0;
for (const [model, emit] of [['M2', 'paren'], ['M2', 'es5'], ['M5', 'paren'], ['M1', 'await']]) {
  const label = model + '-' + emit;
  const report = emulate(source, model, emit, true, label);
  assert.equal(report.static.errors.length, 0, label + ': invalid async transformation');
  assert.equal(report.static.warnings.length, 0, label + ': async callback warning');
  assert.equal(report.emits[emit].first, null, label + ': converted JS did not parse');
  assert.equal(report.run?.fail, 0, label + ': transformed result changed');
  assert.equal(report.run?.rows.length, Object.keys(samples).length, label + ': fixture count changed');
  for (const row of report.run.rows) {
    assert.equal(row.unhandled, 0, label + '/' + row.name + ': unhandled rejection');
    assert.deepEqual(row.fullResult, baseline[row.name], label + '/' + row.name + ': sync/async result mismatch');
    comparisons++;
  }
  console.log('PASS: ' + label + ', ' + report.run.pass + ' complete results match sync baseline.');
}
console.log(`PASS: constructor regression detected; ${comparisons} sync/async comparisons across four emulator modes with TypeScript ${ts.version}.`);
console.log('Local reports: ' + work);
