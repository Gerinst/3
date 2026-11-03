const assert = require('node:assert/strict');
const { load, eml, pdf, textAdvice } = require('./fixtures.cjs');
const { xlsx, zip } = require('./format-fixtures/builders.cjs');
const { evaluate, expectsOther, validateCurrentBusinessOracles, selectCurrentBusinessOracles } = require('./legacy-corpus.cjs');

// Independent business oracles: these texts describe requests, non-customer
// transactions or explicitly unexecuted proposals, never an issued customer payment.
// No archived input, company name, filename, hash or parser diagnostic is an oracle.
const ctx = load();
const writes = ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject'];
let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(name + ': ' + e.message); }
}
function noWrites(r) { for (const field of writes) assert.equal(r[field], '', field); }
function other(r) {
  assert.equal(r.verdict, 'other', r.verdictWhy);
  assert.equal(r.needsReview, false, r.verdictWhy);
  noWrites(r);
}
function review(r) {
  assert.notEqual(r.verdict, 'other', 'uncertain customer advice must not disappear');
  assert.equal(r.needsReview, true, r.verdictWhy);
  noWrites(r);
}
function safe(r, direct = false) {
  assert.equal(r.verdict, 'advice', r.verdictWhy);
  assert.equal(r.needsReview, false, r.error);
  assert.equal(r.confidence, 'high', r.error);
  assert.equal(r.category, direct ? '' : 'Avis');
  assert.equal(Math.round(r.amountNumber * 100), 123456);
  assert.equal(r.currency, 'EUR');
}
function parse(text, carrier, subject = 'Unterlagen') {
  if (carrier === 'direct-pdf') return ctx.main({}, Buffer.from(pdf(text)).toString('base64'));
  return ctx.main({}, eml({ subject, ...(carrier === 'body' ? { body: text } : {
    attachments: [{ name: 'document.pdf', type: 'application/pdf', text: pdf(text) }],
  }) }));
}

// Verify that every independent non-advice representation produces real failures
// for review or mutation. A historical acceptable-review list grants no exception.
const cleanOther = Object.fromEntries(writes.map(k => [k, '']));
Object.assign(cleanOther, { verdict: 'other', needsReview: false, confidence: 'low', text: '' });
const otherOracles = [
  { type: 'truth', value: { kind: 'other' } },
  { type: 'truth', value: { kind: 'non-avis' } },
  { type: 'truth', value: { kind: 'non-advice' } },
  { type: 'truth', value: { verdict: 'other' } },
  { type: 'truth', value: { kind: 'other', acceptable: ['', 'Avis prüfen'] } },
  { type: 'truth', value: { kind: 'other', category: 'Avis prüfen' } },
  { type: 'legacy-expected', value: { verdict: 'other', category: '' } },
  { type: 'legacy-expected', value: { category: '' } },
];
for (const [i, value] of otherOracles.entries()) {
  const oracle = { source: 'independent-test-oracle-' + i, ...value };
  check('strict oracle accepts untouched representation ' + i, () => assert.equal(evaluate(oracle, cleanOther).findings.length, 0));
  for (const [name, patch] of [
    ['review', { verdict: 'unclear', needsReview: true }],
    ['wrong verdict without review', { verdict: 'unclear' }],
    ['review flag alone', { needsReview: true }],
    ...writes.map(k => [k, { [k]: k.includes('patch') ? '{}' : 'unexpected write' }]),
  ]) check('strict oracle rejects ' + name + ' / ' + i, () => {
    assert.ok(evaluate(oracle, { ...cleanOther, ...patch }).findings.length > 0);
  });
}
for (const value of [{ amount: '' }, { check: true }, { verdict: 'unclear', category: '' }, { verdict: 'advice', category: '' }]) {
  check('legacy uncertainty is not redefined as non-advice ' + JSON.stringify(value), () => assert.equal(expectsOther({ type: 'legacy-expected', value }), false));
}

// Current user-confirmed business policy may supersede an old business oracle,
// but only for exactly the audited input. These artificial inputs/expectations
// test selection independently of the three real archive cases and parser output.
const policyHash = 'a'.repeat(64);
const policyRule = {
  file: 'test/independent/pure-question.eml', sha256: policyHash,
  truth: { kind: 'other' }, reason: 'Question is not a payment assertion',
  independentEvidence: 'The complete text asks whether payment arrived and states no payment.',
};
const oldPolicyOracles = [{ source: 'historical-independent-oracle.json', type: 'truth', value: { kind: 'advice', amountNumber: 42 } }];
const policyEntry = { file: policyRule.file, oracles: oldPolicyOracles };
const makePolicy = rule => ({ schemaVersion: 1, decision: { date: '2026-11-03', rule: 'Pure questions remain untouched.' }, cases: [rule] });
const selectPolicy = (entry = policyEntry, hash = policyHash, rules = [policyRule]) => selectCurrentBusinessOracles(entry, hash, rules);
check('current policy validates independent evidence and exact binding', () => assert.deepEqual(validateCurrentBusinessOracles(makePolicy(policyRule)), [policyRule]));
check('exact input activates current policy and retains original oracle object', () => {
  const before = JSON.stringify(policyEntry);
  const selected = selectPolicy();
  assert.equal(selected.currentBusinessOverride.applied, true);
  assert.equal(selected.effectiveOracles.length, 1);
  assert.equal(selected.effectiveOracles[0].value.kind, 'other');
  assert.equal(selected.effectiveOracles[0].fileSha256, policyHash);
  assert.equal(JSON.stringify(policyEntry), before);
});
check('old contradictory finding remains independently reproducible', () => {
  const selected = selectPolicy();
  assert.ok(evaluate(oldPolicyOracles[0], cleanOther).findings.some(x => x.startsWith('lost-advice')));
  assert.equal(evaluate(selected.effectiveOracles[0], cleanOther).findings.length, 0);
});
check('same path with altered bytes fails instead of overriding', () => {
  const selected = selectPolicy(policyEntry, 'b'.repeat(64));
  assert.equal(selected.currentBusinessOverride.applied, false);
  assert.deepEqual(selected.effectiveOracles, oldPolicyOracles);
  assert.match(selected.findings.join('; '), /file hash mismatch/);
});
check('missing input hash cannot bypass policy binding', () => assert.match(selectPolicy(policyEntry, '').findings.join('; '), /file hash mismatch/));
check('same hash under another path does not select policy', () => {
  const selected = selectPolicy({ ...policyEntry, file: 'test/different/pure-question.eml' });
  assert.equal(selected.currentBusinessOverride, undefined);
  assert.deepEqual(selected.effectiveOracles, oldPolicyOracles);
});
check('same basename and changed content cannot select policy', () => {
  const selected = selectPolicy({ ...policyEntry, file: 'test/elsewhere/pure-question.eml' }, 'b'.repeat(64));
  assert.equal(selected.currentBusinessOverride, undefined);
  assert.deepEqual(selected.effectiveOracles, oldPolicyOracles);
});
check('path matching is exact rather than case folded', () => assert.equal(selectPolicy({ ...policyEntry, file: policyRule.file.toUpperCase() }).currentBusinessOverride, undefined));
check('parser identity is never an override key', () => {
  const selected = selectPolicy({ ...policyEntry, parserSha256: 'b'.repeat(64) });
  assert.equal(selected.currentBusinessOverride.applied, true);
  assert.match(selectPolicy({ ...policyEntry, parserSha256: policyHash }, 'b'.repeat(64)).findings.join('; '), /file hash mismatch/);
});
check('no configured policy leaves historical oracles active', () => assert.deepEqual(selectPolicy(policyEntry, policyHash, []).effectiveOracles, oldPolicyOracles));
check('duplicate policy paths are rejected before execution', () => {
  const manifest = makePolicy(policyRule); manifest.cases.push({ ...policyRule, sha256: 'b'.repeat(64) });
  assert.throws(() => validateCurrentBusinessOracles(manifest), /Duplicate/);
});
check('ambiguous selection fails closed even without prior validation', () => {
  const selected = selectPolicy(policyEntry, policyHash, [policyRule, policyRule]);
  assert.ok(selected.findings.length > 0);
  assert.deepEqual(selected.effectiveOracles, oldPolicyOracles);
});
for (const [name, change] of [
  ['malformed hash', { sha256: 'a'.repeat(63) }],
  ['path traversal', { file: 'test/../pure-question.eml' }],
  ['non-other policy', { truth: { kind: 'advice' } }],
  ['missing independent evidence', { independentEvidence: '' }],
]) check('policy rejects ' + name, () => assert.throws(() => validateCurrentBusinessOracles(makePolicy({ ...policyRule, ...change })), /Invalid/));
check('current policy never waives an unexpected review', () => assert.ok(evaluate(selectPolicy().effectiveOracles[0], { ...cleanOther, verdict: 'unclear', needsReview: true }).findings.length));
check('current policy never waives a write operation', () => assert.ok(evaluate(selectPolicy().effectiveOracles[0], { ...cleanOther, patchSubject: '{"subject":"changed"}' }).findings.length));
check('hash mismatch remains an error even if old business evaluation passes', () => {
  const entry = { ...policyEntry, oracles: [{ source: 'old', type: 'truth', value: { kind: 'other' } }] };
  const selected = selectPolicy(entry, 'b'.repeat(64));
  assert.equal(evaluate(selected.effectiveOracles[0], cleanOther).findings.length, 0);
  assert.ok(selected.findings.length > 0);
});
check('repository policy manifest explicitly dates exactly three audited decisions', () => {
  const manifest = require('./current-business-oracles.json');
  assert.equal(manifest.decision.date, '2026-11-03');
  assert.equal(validateCurrentBusinessOracles(manifest).length, 3);
});

const negatives = [
  ['DE invoice question', 'Ist Rechnung RE-4711 schon bezahlt?', 'Bitte pruefen Sie, ob die Rechnung RE-4711 ueber 1.234,56 EUR bereits bezahlt wurde. Wir bestaetigen hiermit keine Zahlung.'],
  ['EN invoice question', 'Has invoice INV-4711 been paid?', 'Can you confirm whether invoice INV-4711 for EUR 1,234.56 has already been paid? This is a question, not a payment confirmation.'],
  ['DE withholding', 'Reklamation und Zahlungssperre', 'Die Ware ist mangelhaft. Wir halten die Zahlung von 1.234,56 EUR bis zur Klaerung zurueck. Es wurde nichts ueberwiesen.'],
  ['EN withholding', 'Invoice disputed - payment on hold', 'We dispute invoice INV-4711 and are withholding EUR 1,234.56 until the goods are replaced. No payment has been made.'],
  ['DE instalment request', 'Bitte um Ratenzahlung', 'Wir beantragen Ratenzahlung fuer die offene Rechnung ueber 1.234,56 EUR. Vorgeschlagen sind drei monatliche Raten. Bitte stimmen Sie dem Vorschlag zu; bisher wurde nichts bezahlt.'],
  ['EN future advice follows', 'Scheduled payment proposal', 'This payment proposal has not been approved. EUR 1,234.56 is scheduled for next month. A separate remittance advice will follow only after execution.'],
  ['DE delivery advice', 'Versandavis zur Bestellung', 'VERSANDAVIS\nIhre Ware wird morgen geliefert. Warenwert: 1.234,56 EUR. Ihre Vorauszahlung haben wir erhalten. Dies ist eine Versandbenachrichtigung, kein Zahlungsavis.'],
  ['DE empty sample', 'Zahlungsavis Muster', 'Zahlungsavis - leeres Formular\nNur Muster zur Schulung, keine echte Zahlung.\nRechnungsnummer: __________\nZahlbetrag: 0,00 EUR'],
  ['DE tax refund', 'Umsatzsteuer-Erstattung', 'Das Finanzamt erstattet die Umsatzsteuer. Erstattungsbetrag: 1.234,56 EUR. Die Erstattung wird auf Ihr Konto ueberwiesen. Bitte auf das Umsatzsteuerkonto buchen, keine Kundenzahlung.'],
  ['EN tax refund', 'VAT refund approved', 'The tax authority has approved your VAT refund of EUR 1,234.56, which will be paid to your account. This is a tax refund, not a customer invoice payment.'],
  ['DE own bank term deposit', 'Gutschriftsanzeige Termingeld', 'Gutschriftsanzeige\nIhr Termingeld ist faellig. Wir schreiben Ihnen die Rueckzahlung Ihres Festgelds samt Zinsen gut.\nGutschriftbetrag: 1.234,56 EUR'],
  ['EN supplier refund', 'Refund of duplicate payment', 'We are your supplier. You paid our invoice twice. We have today refunded the duplicate payment of EUR 1,234.56 to your bank account. This is a refund, not settlement of your customer invoices.'],
  ['DE payment terms example', 'Lieferanteninformation Zahlungsavise', 'Neue Zahlungsbedingungen ab Januar. Dieses Rechenbeispiel ist nur zur Erlaeuterung unseres kuenftigen Zahlungsavis-Formats bestimmt; keine Zahlung wurde ausgefuehrt.\nBeispiel Zahlbetrag: 1.234,56 EUR'],
  ['DE bank return', 'Rueckgabe Ihrer Ueberweisung', 'Die Bank hat Ihre Ueberweisung ueber 1.234,56 EUR wegen ungueltiger Empfaengerdaten zurueckgegeben. Der Betrag wurde zurueckgebucht; es erfolgte keine Zahlung an den Empfaenger.'],
];
for (const [name, subject, text] of negatives) for (const carrier of ['body', 'pdf', 'direct-pdf']) {
  check(name + ' / ' + carrier, () => other(parse(text, carrier, subject)));
}
const proposal = xlsx([{ name: 'Proposal', rows: [
  ['PAYMENT PROPOSAL - DRAFT - NOT APPROVED'], ['A remittance advice will follow after execution.'],
  ['Invoice', 'Scheduled Payment Amount', 'Currency'], ['INV-4711', 1234.56, 'EUR'],
  ['Total proposed payment', 1234.56, 'EUR'],
] }]);
check('scheduled XLSX proposal without an executed payment is untouched', () => other(ctx.main({}, eml({
  subject: 'Payment scheduled for next month', body: 'This is an unapproved payment proposal. No transfer has been executed. A separate remittance advice will follow after payment.',
  attachments: [{ name: 'proposal.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', text: proposal }],
}))));

// The negative classifier may not suppress genuine customer advice or ambiguous
// evidence simply because nearby text mentions tax, deliveries or a proposal.
for (const [name, text] of [
  ['DE issued advice', textAdvice('1.234,56')],
  ['EN issued advice', 'Remittance advice\nWe have paid your invoices today.\nTotal paid: EUR 1,234.56'],
  ['paid invoice includes VAT', textAdvice('1.234,56') + '\nDer Rechnungsbetrag enthaelt Umsatzsteuer.'],
  ['paid invoice refers to a delivery', textAdvice('1.234,56') + '\nIhre Lieferung aus der Bestellung PO-4711 wurde vollstaendig angenommen.'],
]) for (const carrier of ['body', 'pdf', 'direct-pdf']) check(name + ' remains a genuine advice / ' + carrier, () => {
  const r = parse(text, carrier);
  // Body-only evidence may conservatively require review. A readable PDF is
  // independently sufficient; raw direct-PDF calls have no mail to patch.
  if (carrier === 'body' && r.needsReview) review(r);
  else safe(r, carrier === 'direct-pdf');
});
// Transactions can legitimately mention reversals, discounts, a future balance
// or a bank: those words alone must never erase a real executed customer payment.
for (const [name, text] of [
  ['executed partial payment with a future balance', 'Zahlungsavis\nWir haben heute 1.234,56 EUR als Teilzahlung auf Ihre Rechnung ueberwiesen.\nTatsaechlich ueberwiesen: 1.234,56 EUR\nDer Restbetrag von 500,00 EUR wird erst naechsten Monat bezahlt.'],
  ['executed replacement after a rejected transfer', 'Zahlungsavis\nDie erste Ueberweisung wurde von der Bank zurueckgegeben. Heute haben wir die Ersatzueberweisung erfolgreich ausgefuehrt.\nTatsaechlich ueberwiesen: 1.234,56 EUR'],
  ['customer settlement includes a credit note', 'Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nRechnungsbetrag: 1.500,00 EUR\nAbzueglich Gutschrift: 265,44 EUR\nTatsaechlich ueberwiesen: 1.234,56 EUR'],
  ['bank confirmation of an executed customer payment', 'Bank transfer confirmation\nStatus: Executed\nOrdering customer: Customer Ltd\nBeneficiary: Firma GmbH\nBeneficiary email: avis@firma.de\nAmount transferred: EUR 1,234.56\nPayment reference: Invoice 4711'],
]) for (const carrier of ['body', 'pdf', 'direct-pdf']) check(name + ' is never lost / ' + carrier, () => {
  const r = parse(text, carrier);
  if (r.needsReview) review(r);
  else safe(r, carrier === 'direct-pdf');
});
const advice = { name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.234,56')) };
for (const [name, body, attachments] of [
  ['future proposal contradicts a readable issued advice', negatives[5][2], [advice]],
  ['actual smaller transfer contradicts a readable advice', 'Anbei unser Zahlungsavis. Tatsaechlich haben wir heute nur 800,17 EUR ueberwiesen.', [advice]],
  ['cancelled attached advice remains reviewable', 'Das beigefuegte Zahlungsavis wurde storniert. Es wurde keine Zahlung ausgefuehrt.', [advice]],
  ['unknown damaged PDF must not disappear behind future proposal', negatives[5][2], [{ name: 'document.pdf', type: 'application/pdf', text: '%PDF-1.4\n%%EOF' }]],
  ['damaged additional advice blocks automatic completion', 'Anbei zwei Zahlungsavise.', [advice, { name: 'second-avis.pdf', type: 'application/pdf', text: '%PDF-1.4\n%%EOF' }]],
  ['portal advice without amount needs review', 'Ein neues Zahlungsavis steht im Lieferantenportal zum Abruf bereit.', []],
]) check(name, () => review(ctx.main({}, eml({ subject: 'Unterlagen', body, attachments }))));
for (const carrier of ['body', 'pdf', 'direct-pdf']) check('issued advice missing amount needs review / ' + carrier, () => review(parse('Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nDer Zahlbetrag ist nicht lesbar.', carrier)));

// An explicit completed status is execution evidence even when a reference names
// self-billing or the earlier proposal. The document's current status governs it.
const executedStatusExamples = [
  ['executed self-billing reference', 'REMITTANCE ADVICE\nPayment status: Executed\nPayment date: 30/10/2026\nSelf-billing invoice: SB-4711\nBeneficiary: Firma GmbH\nAmount transferred: EUR 1,234.56'],
  ['executed former payment proposal', 'REMITTANCE ADVICE\nPayment status: Executed\nOriginal payment proposal: PR-4711\nScheduled payment date: 30/10/2026\nActual execution date: 30/10/2026\nBeneficiary: Firma GmbH\nAmount transferred: EUR 1,234.56'],
];
for (const [name, text] of executedStatusExamples) check(name + ' remains safe', () => safe(parse(text, 'pdf')));
check('pending status cannot become an automatic payment', () => {
  const r = parse(executedStatusExamples[0][1].replace('Payment status: Executed', 'Payment status: Pending'), 'pdf');
  noWrites(r);
  // A pending formal advice is not an independently confirmed payment. Its
  // conflicting transferred-amount label permits review, never automation.
  assert.ok(r.needsReview === true || (r.verdict === 'other' && r.needsReview === false));
});
check('independent body payment remains visible beside a form reference in the same sentence', () => review(ctx.main({}, eml({
  subject: 'Zahlungsavis und Stammdatenformular',
  body: 'Zahlungsavis\nWir haben Ihre Rechnung RE-4711 heute bezahlt und senden Ihnen anbei getrennt davon ein Formular fuer kuenftige Stammdatenpflege.\nTatsaechlich ueberwiesen: 1.234,56 EUR',
  attachments: [{ name: 'stammdaten.htm', type: 'text/html', text: '<html><body><form><input type="password" name="password"></form></body></html>' }],
}))));

// A trailing polite question does not revoke an independently stated payment.
for (const question of ['could you check whether invoice INV-4711 has been paid?', 'could you confirm receipt?']) {
  check('executed payment before comma and ' + question, () => review(ctx.main({}, eml({
    subject: 'Payment advice', body: 'We have paid invoice INV-4711 today, total EUR 1,234.56, ' + question,
  }))));
}
check('the identical payment question alone remains untouched', () => other(ctx.main({}, eml({
  subject: 'Payment advice', body: 'Could you check whether invoice INV-4711 has been paid?',
}))));

// A definite future payout of a marketplace balance is not independently a tax
// or supplier refund. Unclear provenance must stay reviewable, not disappear.
check('ambiguous marketplace balance payout remains reviewable', () => review(parse(
  'BEISPIELMARKT GmbH\nMarktplatz-Services · Köln\nInformation\nDatum 28.10.2026\nIhr Guthaben von 980,00 EUR wird am 05.11.2026 ausgezahlt.',
  'direct-pdf',
)));

// A normal transport wrap does not change an explicit attachment description.
// The parser cannot read Word files, so this exemption must stay limited to the
// one described letter and must never hide a separate executed payment.
const bankLetter = {
  name: 'information.docx',
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  text: zip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Supplier account information</w:t></w:r></w:p><w:p><w:r><w:t>Please update our bank details in your supplier records for future payments. This letter announces no payment.</w:t></w:r></w:p></w:body></w:document>' },
  ]),
};
const bankLetterDescription = 'Attached is a formal notification of a change of our bank details.';
const parseBankLetter = body => ctx.main({}, eml({
  subject: 'Account information', body, attachments: [bankLetter],
}));
for (const [name, body] of [
  ['unwrapped', bankLetterDescription],
  ['transport-wrapped', bankLetterDescription.replace('bank details', 'bank\ndetails')],
]) check('single explicitly described Word bank letter is untouched / ' + name, () => other(parseBankLetter(body)));
check('wrapped independent executed payment survives the Word-letter exemption', () => review(parseBankLetter(
  bankLetterDescription.replace('bank details', 'bank\ndetails')
    + '\n\nWe have\npaid your invoice INV-4711 today.\nTotal paid: EUR 1,234.56',
)));
check('separate paragraphs do not complete a Word attachment description', () => review(parseBankLetter(
  bankLetterDescription.replace('bank details', 'bank\n\ndetails'),
)));

if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
console.log(`PASS: ${passed} non-advice oracle and semantic scenarios; ${failures.length} failures.`);
