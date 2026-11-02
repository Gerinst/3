// These fixtures exercise the real MIME parser and main() entry point. No mailbox is contacted.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { load, eml, pdf, textAdvice } = require('./fixtures.cjs');
const ctx = load();
let count = 0;
function run({ from = 'kunde@kundenfirma.example', to = 'avis@nordwerk.example',
  deliveredTo = '', mailbox = 'avis@nordwerk.example', body = '', attachments,
  subject = 'Abrechnung Oktober' } = {}) {
  let raw = Buffer.from(eml({ body, subject, attachments: attachments || [
    { name: 'avis.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30')) },
  ] }), 'base64').toString('utf8');
  raw = raw.replace(/^From:.*$/m, `From: ${from}\r`).replace(/^To:.*$/m, `To: ${to}\r`);
  if (deliveredTo) raw = `Delivered-To: ${deliveredTo}\r\n` + raw;
  ctx.input = Buffer.from(raw).toString('base64');
  ctx.mailbox = mailbox;
  return vm.runInContext('main({}, input, undefined, undefined, mailbox)', ctx, { timeout: 2000 });
}
function test(name, options, kind) {
  const result = run(options);
  if (kind === 'safe') {
    assert.equal(result.verdict, 'advice', name);
    assert.equal(result.confidence, 'high', name);
    assert.equal(result.newSubject, '1.200,30 Abrechnung Oktober', name);
    assert.equal(result.category, 'Avis', name);
  } else {
    assert.equal(result.needsReview, kind === 'review', name + ': review status');
    if (kind === 'other') assert.equal(result.verdict, 'other', name);
    for (const key of ['patchSubject', 'patchCategory', 'category', 'newSubject', 'subjectPrefix'])
      assert.equal(result[key], '', name + ': no automatic write ' + key);
  }
  count++;
}
test('incoming customer advice', {}, 'safe');
test('configured mailbox accepts whitespace and case', { mailbox: ' AVIS@NORDWERK.EXAMPLE ' }, 'safe');
test('incoming BCC customer advice', { to: 'kunde@kundenfirma.example' }, 'safe');
test('configured mailbox overrides misleading Delivered-To on incoming advice',
  { deliveredTo: 'kunde@kundenfirma.example' }, 'safe');
test('own outgoing BCC must not be classified as incoming payment',
  { from: 'avis@nordwerk.example', to: 'supplier@lieferantenfirma.example' }, 'other');
test('own outgoing BCC with misleading envelope still stays untouched',
  { from: 'avis@nordwerk.example', to: 'supplier@lieferantenfirma.example',
    deliveredTo: 'supplier@lieferantenfirma.example' }, 'other');
test('own outgoing BCC from colleague',
  { from: 'kollege@nordwerk.example', to: 'supplier@lieferantenfirma.example' }, 'other');
test('legacy call can use genuine Delivered-To for outgoing BCC',
  { from: 'avis@nordwerk.example', to: 'supplier@lieferantenfirma.example',
    deliveredTo: 'avis@nordwerk.example', mailbox: '' }, 'other');
test('legacy incoming call remains compatible', { mailbox: '' }, 'safe');
for (const mailbox of ['kein-postfach', 'avis@nordwerk.example other@firma.example',
  'Display <avis@nordwerk.example>', 'avis@nordwerk.example\r\nBcc: other@firma.example',
  'avis@@nordwerk.example', '@nordwerk.example']) {
  test('invalid configured mailbox ' + JSON.stringify(mailbox), { mailbox }, 'review');
}
test('ordinary external email remains untouched with mailbox context',
  { attachments: [], body: 'Guten Tag, unser Termin ist am Montag. Viele Gruesse', subject: 'Termin' }, 'other');
console.log(`PASS: ${count} receiving-mailbox and BCC safety scenarios (real main/MIME).`);
