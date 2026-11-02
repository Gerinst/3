const assert = require('node:assert/strict');
const vm = require('node:vm');
const { load, eml, pdf, textAdvice } = require('./fixtures.cjs');

// Hand-written semantic oracles, independent of scores, regexes and current parser output.
// A conservative review is allowed for a valid payment; any automatic result must be exact.
// Explicit non-payments may never acquire payment amounts in their subject or a category.
const ctx = load();
const cases = [];
const patchFields = ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject'];
function unchanged(r) {
  for (const key of patchFields) assert.equal(r[key], '', key + ' must remain empty');
}
function review(r) {
  unchanged(r);
  assert.equal(r.needsReview, true, 'uncertain advice must be routed for review');
}
function noAutomatic(r) {
  unchanged(r);
  if (r.verdict !== 'other') assert.equal(r.needsReview, true);
}
function correctPayment(cents, currency = 'EUR') {
  return r => {
    if (r.category === '' && r.needsReview) return review(r);
    assert.equal(r.verdict, 'advice');
    assert.equal(r.confidence, 'high');
    assert.equal(r.category, 'Avis');
    assert.equal(r.needsReview, false);
    assert.equal(Math.round(r.amountNumber * 100), cents, 'automatic amount in cents');
    assert.equal(r.currency, currency);
    const amount = (cents / 100).toLocaleString('de-DE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    assert.equal(r.newSubject, amount + ' Unterlagen', 'subject must contain the same correct amount');
    assert.equal(JSON.parse(r.patchSubject).subject, amount + ' Unterlagen');
    assert.deepEqual(JSON.parse(r.patchCategory).categories, ['Avis']);
  };
}
function other(r) {
  unchanged(r);
  assert.equal(r.verdict, 'other', 'a clearly unrelated message is not a payment advice');
  assert.equal(r.needsReview, false);
}
function add(name, input, oracle) { cases.push({ name, input, oracle }); }
function message(text, carrier, subject = 'Unterlagen', extra = {}) {
  if (carrier === 'body') return eml({ subject, body: text, ...extra });
  const attachment = carrier === 'pdf'
    ? { name: 'document.pdf', type: 'application/pdf', text: pdf(text) }
    : { name: 'document.txt', type: 'text/plain; charset=utf-8', text };
  return eml({ subject, attachments: [attachment], ...extra });
}
function matrix(name, text, oracle, carriers = ['body', 'text', 'pdf'], subject) {
  for (const carrier of carriers) add(name + ' / ' + carrier, message(text, carrier, subject), oracle);
}

// Unambiguous payment evidence and amount arithmetic. Decimals are intentionally asymmetric.
matrix('DE completed payment',
  'Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 1.287,43 EUR\nMit freundlichen Gruessen',
  correctPayment(128743));
matrix('EN completed payment',
  'Remittance advice\nWe have paid your invoices today.\nTotal paid: EUR 1,287.43\nKind regards',
  correctPayment(128743));
matrix('DE discount is not paid amount',
  'Zahlungsavis\nWir haben Ihre Rechnung heute bezahlt.\nRechnungsbetrag: 1.000,00 EUR\nSkonto 2 %: 20,00 EUR\nUeberwiesener Zahlbetrag: 980,00 EUR',
  correctPayment(98000));
matrix('EN discount is not paid amount',
  'Remittance advice\nWe have paid your invoice today.\nInvoice amount: EUR 1,000.00\nDiscount 2%: EUR 20.00\nTotal paid: EUR 980.00',
  correctPayment(98000));
matrix('DE partial payment is not invoice balance',
  'Zahlungsavis\nWir haben heute nur 300,17 EUR als Teilzahlung auf Ihre Rechnung ueberwiesen.\nRechnungsbetrag: 1.000,00 EUR\nRestbetrag offen: 699,83 EUR\nTatsaechlich ueberwiesen: 300,17 EUR',
  correctPayment(30017));
matrix('EN partial payment is not invoice balance',
  'Remittance advice\nWe have transferred only EUR 300.17 today as a partial payment.\nInvoice amount: EUR 1,000.00\nRemaining balance: EUR 699.83\nAmount actually paid: EUR 300.17',
  correctPayment(30017));

// Locales and signed/ambiguous amounts: a permissive reader must not silently repair invalid money.
matrix('DE ungrouped decimal amount',
  'Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 1287,43 EUR', correctPayment(128743), ['text', 'pdf']);
matrix('EN ungrouped decimal amount',
  'Remittance advice\nWe have paid your invoices today.\nTotal paid: EUR 1287.43', correctPayment(128743), ['text', 'pdf']);
matrix('malformed mixed grouping',
  'Remittance advice\nWe have paid your invoices today.\nTotal paid: EUR 5,632,21', noAutomatic, ['text', 'pdf']);
matrix('negative payment is not a positive transfer',
  'Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: -1.287,43 EUR', noAutomatic, ['text', 'pdf']);
matrix('zero payment is not an executed transfer',
  'Zahlungsavis\nZahlbetrag: 0,00 EUR\nDie Rechnungen wurden vollstaendig verrechnet.', noAutomatic, ['text', 'pdf']);
matrix('contradictory currency labels',
  'Remittance advice\nWe have paid your invoices today.\nTotal paid: EUR 1,287.43\nPayment currency: USD', noAutomatic, ['text', 'pdf']);
// EUR is the documented fallback when a document has no currency; require the right numeric amount if automated.
matrix('currency absent uses documented EUR default',
  'Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 1.287,43', correctPayment(128743), ['text', 'pdf']);

// All these are explicit claims that the transfer has NOT happened.
const notPaid = [
  ['DE tomorrow', 'Zahlungsavis\nWir werden morgen 1.287,43 EUR ueberweisen.\nGeplanter Zahlbetrag: 1.287,43 EUR'],
  ['EN tomorrow', 'Remittance advice\nWe will transfer EUR 1,287.43 tomorrow.\nScheduled payment: EUR 1,287.43'],
  ['DE pending approval', 'Zahlungsavis ENTWURF\nDie Zahlung ist noch nicht freigegeben.\nErst nach Genehmigung werden wir 1.287,43 EUR ueberweisen.\nZahlbetrag: 1.287,43 EUR'],
  ['EN pending approval', 'DRAFT remittance advice\nPayment has not been approved.\nWe will transfer EUR 1,287.43 only after approval.\nPayment amount: EUR 1,287.43'],
  ['DE explicitly unpaid', 'Zahlungsavis\nWir haben die Rechnung noch nicht bezahlt.\nEs wurde keine Ueberweisung ausgefuehrt.\nZahlbetrag: 1.287,43 EUR'],
  ['EN explicitly unpaid', 'Remittance advice\nWe have not paid this invoice.\nNo transfer has been executed.\nPayment amount: EUR 1,287.43'],
  ['DE failed transfer', 'Zahlungsavis\nDie Ueberweisung ist fehlgeschlagen und wurde nicht ausgefuehrt.\nDer Betrag wurde nicht bezahlt.\nZahlbetrag: 1.287,43 EUR'],
  ['EN failed transfer', 'Remittance advice\nThe bank transfer failed and was not executed.\nNo payment was made.\nPayment amount: EUR 1,287.43'],
  ['DE cancellation', 'Zahlungsavis STORNIERT\nDiese Zahlungsanweisung wurde vor der Ausfuehrung storniert.\nEs wurde kein Geld ueberwiesen.\nZahlbetrag: 1.287,43 EUR'],
  ['EN cancellation', 'CANCELLED remittance advice\nThis payment instruction was cancelled before execution.\nNo funds were transferred.\nPayment amount: EUR 1,287.43'],
  ['EN pending status field', 'Remittance advice\nPayment status: Pending\nPayment amount: EUR 1,287.43'],
  ['DE pending status field', 'Zahlungsavis\nAusfuehrungsstatus: Ausstehend\nZahlbetrag: 1.287,43 EUR'],
];
for (const [name, text] of notPaid) matrix(name, text, noAutomatic);

// Clearly unrelated transaction documents must not even enter the advice workflow.
const negatives = [
  ['DE invoice', 'Rechnung Nr. 4711\nFuer unsere Lieferung berechnen wir Ihnen 1.287,43 EUR.\nRechnungsbetrag: 1.287,43 EUR\nBitte ueberweisen Sie bis zum 15.11.2026.'],
  ['EN invoice', 'Invoice No. 4711\nWe charge you EUR 1,287.43 for our goods.\nInvoice total: EUR 1,287.43\nPlease pay by 15 November 2026.'],
  ['DE overdue reminder', 'Mahnung\nIhre Rechnung 4711 ist noch offen.\nOffener Betrag: 1.287,43 EUR\nBitte zahlen Sie unverzueglich.'],
  ['EN overdue reminder', 'Overdue payment reminder\nYour invoice 4711 is still unpaid.\nOutstanding balance: EUR 1,287.43\nPlease pay immediately.'],
  ['DE order', 'Bestellung 4711\nHiermit bestellen wir 17 Bauteile.\nAuftragswert: 1.287,43 EUR\nBitte bestaetigen Sie den Liefertermin.'],
  ['EN order', 'Purchase order 4711\nWe would like to order 17 components.\nOrder total: EUR 1,287.43\nPlease confirm the delivery date.'],
  ['DE delivery advice', 'Lieferavis\nIhre Ware wird morgen zugestellt.\nWarenwert: 1.287,43 EUR\nDies ist eine Versandbenachrichtigung.'],
  ['EN delivery advice', 'Shipping notice\nYour goods will be delivered tomorrow.\nGoods value: EUR 1,287.43\nThis is a delivery notification.'],
  ['DE credit note is not payment', 'Gutschrift Nr. 4711\nWir schreiben Ihnen fuer die Ruecksendung 1.287,43 EUR gut.\nGutschriftsbetrag: 1.287,43 EUR\nBitte verrechnen Sie die Gutschrift mit der naechsten Rechnung.'],
  ['DE statement debit and credit', 'Kontoauszug Oktober 2026\nAlter Saldo: 2.000,00 EUR\nSoll: 1.287,43 EUR\nHaben: 500,12 EUR\nNeuer Saldo: 1.212,69 EUR'],
];
for (const [name, text] of negatives) matrix(name, text, other);

// Conflicting evidence must prevent both subject and category changes.
const attachment = { name: 'remittance.pdf', type: 'application/pdf', text: pdf(textAdvice('1.287,43')) };
for (const [name, body] of [
  ['DE amount contradiction', 'Anbei das Zahlungsavis. Tatsaechlich haben wir heute nur 800,17 EUR ueberwiesen.'],
  ['EN amount contradiction', 'Attached is the remittance advice. The payment actually sent today is EUR 800.17.'],
  ['EN contradiction plus unrelated addition', 'Attached is the remittance advice. The payment actually sent today is EUR 800.17. In addition, please confirm receipt.'],
  ['EN contradiction plus separate documents', 'Attached is the remittance advice. The payment actually sent today is EUR 800.17. We will send the remaining documents separately.'],
  ['DE withdrawn attached advice', 'Das beigefuegte Zahlungsavis wurde storniert. Es wurde keine Zahlung ausgefuehrt.'],
  ['EN withdrawn attached advice', 'The attached remittance advice has been cancelled. No payment was executed.'],
  ['EN cancellation without replacement', 'The attached remittance advice has been cancelled. No new advice is attached.'],
  ['DE unpaid body overrides readable advice', 'Zahlungsavis\nWir haben die Rechnung noch nicht bezahlt.\nEs wurde keine Ueberweisung ausgefuehrt.\nZahlbetrag: 1.287,43 EUR'],
  ['EN unpaid body overrides readable advice', 'Remittance advice\nWe have not paid this invoice.\nNo transfer has been executed.\nPayment amount: EUR 1,287.43'],
  ['pending body overrides readable advice', 'Payment status: Pending\nPayment amount: EUR 1,287.43'],
]) add(name, eml({ subject: 'Zahlungsavis', body, attachments: [attachment] }), review);

for (const [name, body] of [
  ['completed retry body supports readable advice', 'Remittance advice\nThe transfer failed yesterday.\nWe have re-sent the payment today.\nTotal paid: EUR 1,287.43'],
  ['quoted historical failure does not override current payment', 'We have paid your invoices today. Total paid: EUR 1,287.43.\n\nOn 20 October 2026, Accounts wrote:\n> Payment status: Pending\n> Payment amount: EUR 1,287.43'],
]) add(name, eml({ subject: 'Unterlagen', body, attachments: [attachment] }), r => {
  // Both inputs affirm today's completed payment; old/quoted failures cannot cancel the independent attachment.
  assert.equal(r.needsReview, false);
  correctPayment(128743)(r);
});

// Negative status wording can itself be negated or superseded by an explicit completed retry.
matrix('EN no longer pending after payment',
  'Remittance advice\nThe payment is no longer pending approval.\nWe have paid your invoices today.\nTotal paid: EUR 1,287.43', correctPayment(128743), ['text', 'pdf']);
matrix('EN completed retry after old failure',
  'Remittance advice\nThe transfer failed yesterday.\nWe have re-sent the payment today.\nTotal paid: EUR 1,287.43', correctPayment(128743), ['text', 'pdf']);

// Copies of our own outgoing payments are not customer payments to our mailbox.
for (const [name, text] of [
  ['DE own outgoing copy', textAdvice('1.287,43')],
  ['EN own outgoing copy', 'Remittance advice\nWe have paid your invoices today.\nTotal paid: EUR 1,287.43'],
]) {
  const raw = Buffer.from(message(text, 'pdf', 'Payment copy'), 'base64').toString('utf8')
    .replace('From: Kunde <kunde@example.org>', 'From: Finance <finance@firma.de>')
    .replace('To: avis@firma.de', 'To: supplier@outside.example\r\nDelivered-To: avis@firma.de');
  add(name, Buffer.from(raw).toString('base64'), other);
}

// An explicit recipient other than the mailbox owner does not authorize automatic processing.
matrix('EN transfer to a different named recipient',
  'Bank transfer confirmation\nStatus: Executed\nOrdering customer: Customer Ltd\nBeneficiary: Unrelated Supplier Ltd\nBeneficiary email: accounts@unrelated.example\nAmount transferred: EUR 1,287.43\nPayment reference: Invoice 4711',
  noAutomatic, ['body', 'text', 'pdf'], 'Transfer to Unrelated Supplier Ltd');

// Exercise actual exported mail and PDF bytes with bounded execution, not mocked parser results.
let passed = 0;
const failures = [];
for (const test of cases) {
  let result;
  try {
    ctx.semanticTestInput = test.input;
    result = vm.runInContext('main({}, semanticTestInput)', ctx, { timeout: 5000 });
    test.oracle(result);
    passed++;
  } catch (error) {
    failures.push(test.name + ': ' + error.message + (result ? '\n  ' + JSON.stringify({
      verdict: result.verdict, confidence: result.confidence, needsReview: result.needsReview,
      amount: result.amount, currency: result.currency, newSubject: result.newSubject,
      why: result.verdictWhy, documents: result.documents,
    }) : ''));
  }
}
delete ctx.semanticTestInput;
if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`FAIL: ${failures.length}/${cases.length} semantic safety cases; ${passed} passed.`);
  process.exitCode = 1;
} else console.log(`PASS: ${passed} semantic safety cases.`);
