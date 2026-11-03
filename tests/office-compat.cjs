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

// These business expectations are independent of the sync baseline: two equally
// wrong implementations must not pass the sync/async comparison together.
// Use an explicit payment total: the default table fixture needs a computed sum
// and is deliberately uncertain, so it cannot exercise the safe-advice guard.
const subjectXlsx = xlsx([{ name: 'Avis', rows: [
  ['Zahlungsavis'], ['Zahlbetrag', 1200.3, 'EUR'],
] }]);
const subjectCases = {
  'subject-pdf-matching.eml': {
    subject: '1.200,30 Zahlungsavis', review: false,
    attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30')) }],
  },
  'subject-pdf-conflict.eml': {
    subject: '9.999,00 EUR - Zahlungsavis', review: true,
    attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30')) }],
  },
  'subject-xlsx-matching.eml': {
    subject: 'AW: 1.200,30 EUR - Zahlungsavis', review: false,
    attachments: [{ name: 'avis.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', text: subjectXlsx }],
  },
  'subject-xlsx-conflict.eml': {
    subject: 'AW: 9.999,00 EUR - Zahlungsavis', review: true,
    attachments: [{ name: 'avis.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', text: subjectXlsx }],
  },
  'subject-multiple-prefixed-matching.eml': {
    subject: '1.200,30 + 5.632,21 Zahlungsavise', review: false,
    attachments: fixtures.pdf.attachments,
  },
  'subject-multiple-prefixed-conflict.eml': {
    subject: '1.200,30 + 9.999,00 Zahlungsavise', review: true,
    attachments: fixtures.pdf.attachments,
  },
};
for (const [name, sample] of Object.entries(subjectCases)) {
  samples[name] = Buffer.from(eml({
    subject: sample.subject, body: 'Anbei unser Zahlungsavis.', attachments: sample.attachments,
  }), 'base64');
}

// Exercise the new non-advice decisions and their safety boundary in every
// async model. These expectations are independent of the synchronous result.
const nonAdviceCases = {
  'non-advice-planned-payment.eml': {
    outcome: 'other', subject: 'Scheduled payment proposal',
    body: 'This payment proposal has not been approved. EUR 1,200.30 is scheduled for next month. A separate remittance advice will follow only after execution.',
  },
  'non-advice-negated-payment.eml': {
    outcome: 'other', subject: 'Reklamation und Zahlungssperre',
    body: 'Die Ware ist mangelhaft. Wir halten die Zahlung von 1.200,30 EUR bis zur Klaerung zurueck. Es wurde nichts ueberwiesen.',
  },
  'non-advice-information.eml': {
    outcome: 'other', subject: 'Zahlungsavis Muster',
    attachments: [{ name: 'template.pdf', type: 'application/pdf', text: pdf('Zahlungsavis - leeres Formular\nNur Muster zur Schulung, keine echte Zahlung.\nRechnungsnummer: __________\nZahlbetrag: 0,00 EUR') }],
  },
  'non-advice-positive-tax-context.eml': {
    outcome: 'safe', subject: 'Unterlagen zur Kundenzahlung',
    attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30') + '\nDer Rechnungsbetrag enthaelt Umsatzsteuer.') }],
  },
  'non-advice-contradicted-issued-advice.eml': {
    outcome: 'review', subject: 'Unterlagen',
    body: 'This payment proposal has not been approved. EUR 1,200.30 is scheduled for next month. A separate remittance advice will follow only after execution.',
    attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30')) }],
  },
  'non-advice-positive-investment-reference.eml': {
    outcome: 'safe', subject: 'Zahlungsavis',
    attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30') + '\nVerwendungszweck: Ihre Rechnung fuer Beratung zu Termingeld und Zinsen.') }],
  },
  'non-advice-positive-separate-tax-refund.eml': {
    outcome: 'retained', subject: 'Zahlungsavis',
    attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: pdf('Zahlungsavis\nWir haben heute 1.200,30 EUR auf Ihr Konto ueberwiesen.\nZahlbetrag: 1.200,30 EUR\nSeparater Hinweis fuer unsere Buchhaltung: Das Finanzamt erstattet uns die Umsatzsteuer aus dem Vorjahr.') }],
  },
  'non-advice-independent-payment-with-login.eml': {
    outcome: 'review', subject: 'Zahlungsavis und Stammdatenformular',
    body: 'Zahlungsavis\nWir haben Ihre Rechnung RE-4711 heute bezahlt.\nTatsaechlich ueberwiesen: 1.200,30 EUR\nUnabhaengig davon finden Sie anbei ein Formular fuer kuenftige Stammdatenpflege.',
    attachments: [{ name: 'stammdaten.htm', type: 'text/html', text: '<html><body><form><input type="password" name="password"></form></body></html>' }],
  },
  'non-advice-executed-self-billing.eml': {
    outcome: 'safe', subject: 'Zahlungsavis',
    attachments: [{ name: 'payment.pdf', type: 'application/pdf', text: pdf('REMITTANCE ADVICE\nPayment status: Executed\nPayment date: 30/10/2026\nSelf-billing invoice: SB-4711\nBeneficiary: Firma GmbH\nAmount transferred: EUR 1,200.30') }],
  },
  'non-advice-executed-former-proposal.eml': {
    outcome: 'safe', subject: 'Zahlungsavis',
    attachments: [{ name: 'payment.pdf', type: 'application/pdf', text: pdf('REMITTANCE ADVICE\nPayment status: Executed\nOriginal payment proposal: PR-4711\nScheduled payment date: 30/10/2026\nActual execution date: 30/10/2026\nBeneficiary: Firma GmbH\nAmount transferred: EUR 1,200.30') }],
  },
  'non-advice-pending-self-billing.eml': {
    outcome: 'nonautomatic', subject: 'Zahlungsavis',
    attachments: [{ name: 'payment.pdf', type: 'application/pdf', text: pdf('REMITTANCE ADVICE\nPayment status: Pending\nPayment date: 30/10/2026\nSelf-billing invoice: SB-4711\nBeneficiary: Firma GmbH\nAmount transferred: EUR 1,200.30') }],
  },
  'non-advice-independent-payment-login-same-sentence.eml': {
    outcome: 'review', subject: 'Zahlungsavis und Stammdatenformular',
    body: 'Zahlungsavis\nWir haben Ihre Rechnung RE-4711 heute bezahlt und senden Ihnen anbei getrennt davon ein Formular fuer kuenftige Stammdatenpflege.\nTatsaechlich ueberwiesen: 1.200,30 EUR',
    attachments: [{ name: 'stammdaten.htm', type: 'text/html', text: '<html><body><form><input type="password" name="password"></form></body></html>' }],
  },
  'non-advice-payment-before-check-question.eml': {
    outcome: 'review', subject: 'Payment advice',
    body: 'We have paid invoice INV-4711 today, total EUR 1,200.30, could you check whether invoice INV-4711 has been paid?',
  },
  'non-advice-payment-before-receipt-question.eml': {
    outcome: 'review', subject: 'Payment advice',
    body: 'We have paid invoice INV-4711 today, total EUR 1,200.30, could you confirm receipt?',
  },
  'non-advice-payment-question-only.eml': {
    outcome: 'other', subject: 'Payment advice',
    body: 'Could you check whether invoice INV-4711 has been paid?',
  },
  'non-advice-ambiguous-marketplace-payout.pdf': {
    outcome: 'review',
    directPdf: 'BEISPIELMARKT GmbH\nMarktplatz-Services · Köln\nInformation\nDatum 28.10.2026\nIhr Guthaben von 980,00 EUR wird am 05.11.2026 ausgezahlt.',
  },
  'non-advice-unknown-damaged-attachment.eml': {
    outcome: 'review', subject: 'Unterlagen',
    body: 'This payment proposal has not been approved. A separate remittance advice will follow only after execution.',
    attachments: [{ name: 'document.pdf', type: 'application/pdf', text: '%PDF-1.4\n%%EOF' }],
  },
};
for (const [name, sample] of Object.entries(nonAdviceCases)) {
  samples[name] = sample.directPdf ? Buffer.from(pdf(sample.directPdf)) : Buffer.from(eml(sample), 'base64');
}
function checkNonAdviceOutcome(name, result) {
  const sample = nonAdviceCases[name];
  if (!sample) return;
  if (sample.outcome === 'safe' || (sample.outcome === 'retained' && !result.needsReview)) {
    assert.equal(result.verdict, 'advice', name + ': genuine payment lost');
    assert.equal(result.confidence, 'high', name + ': readable payment must remain safe');
    assert.equal(result.needsReview, false, name + ': readable payment unnecessarily reviewed');
    assert.equal(result.category, 'Avis', name + ': genuine advice category');
    assert.equal(Math.round(result.amountNumber * 100), 120030, name + ': wrong customer payment');
    assert.equal(result.currency, 'EUR', name + ': wrong currency');
  } else {
    if (sample.outcome === 'nonautomatic') {
      assert.ok(result.needsReview === true || (result.verdict === 'other' && result.needsReview === false), name + ': pending status must not authorize automation');
    } else {
      if (sample.outcome === 'other') assert.equal(result.verdict, 'other', name + ': non-advice misclassified');
      else assert.notEqual(result.verdict, 'other', name + ': uncertain advice lost');
      assert.equal(result.needsReview, sample.outcome === 'review' || sample.outcome === 'retained', name + ': wrong review decision');
    }
    for (const key of ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject']) {
      assert.equal(result[key], '', name + ': must not authorize ' + key);
    }
  }
}

function checkSubjectOutcome(name, result) {
  const sample = subjectCases[name];
  if (!sample) return;
  assert.equal(result.needsReview, sample.review, name + ': wrong review decision');
  if (sample.review) {
    assert.equal(result.confidence, 'low', name + ': conflicting subject must not be safe');
    assert.match(result.error, /subject amount conflict/, name + ': missing conflict reason');
    for (const key of ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject']) {
      assert.equal(result[key], '', name + ': conflict must not authorize ' + key);
    }
  } else {
    assert.equal(result.confidence, 'high', name + ': matching amount must remain safe');
    assert.equal(result.category, 'Avis', name + ': matching advice category');
    assert.equal(result.newSubject, '', name + ': existing matching prefix must remain unchanged');
    assert.equal(result.patchSubject, '', name + ': existing matching prefix must not be patched');
  }
}

const sync = load();
const expected = {}, baseline = {};
for (const [name, input] of Object.entries(samples)) {
  const bytes = Buffer.from(input);
  fs.writeFileSync(path.join(fixtureDir, name), bytes);
  sync.officeInput = bytes.toString('base64');
  sync.officeSubject = subjectCases[name]?.subject || nonAdviceCases[name]?.subject || 'Office Test';
  const result = vm.runInContext("main({}, officeInput, '', officeSubject)", sync, { timeout: 10000 });
  checkSubjectOutcome(name, result);
  checkNonAdviceOutcome(name, result);
  baseline[name] = JSON.parse(JSON.stringify(result));
  expected[name] = { mailSubject: sync.officeSubject, verdict: result.verdict, category: result.category,
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
    checkSubjectOutcome(row.name, row.fullResult);
    checkNonAdviceOutcome(row.name, row.fullResult);
    assert.deepEqual(row.fullResult, baseline[row.name], label + '/' + row.name + ': sync/async result mismatch');
    comparisons++;
  }
  console.log('PASS: ' + label + ', ' + report.run.pass + ' complete results match sync baseline.');
}
console.log(`PASS: constructor regression detected; ${comparisons} sync/async comparisons across four emulator modes with TypeScript ${ts.version}.`);
console.log('Local reports: ' + work);
