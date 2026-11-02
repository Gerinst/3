// Synthetic local load checks, not Office Script or Microsoft 365 benchmarks.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { load, eml, pdf, textAdvice } = require('./fixtures.cjs');
const ctx = load();
let checks = 0;
function multiPage(pages) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const text of pages) {
    const pageId = objects.length + 1;
    const stream = pdf(text).match(/stream\n([\s\S]*?)\nendstream/)[1];
    kids.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;
  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
  return out + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}
function run(name, input, verify) {
  ctx.volumeInput = eml(input);
  const start = performance.now();
  const result = vm.runInContext("main({}, volumeInput, '', undefined, 'avis@firma.de')", ctx, { timeout: 10000 });
  verify(result);
  checks++;
  console.log(`${name}: ${Math.round(performance.now() - start)} ms locally, ${Buffer.byteLength(ctx.volumeInput, 'base64')} bytes, ${result.verdict}/${result.confidence}`);
}
function review(r) {
  assert.equal(r.needsReview, true);
  assert.equal(r.patchSubject, ''); assert.equal(r.patchCategory, '');
}
function correctOrReview(amount) {
  return r => {
    assert.notEqual(r.verdict, 'other', 'a visible advice must not disappear');
    if (r.category) {
      assert.equal(r.confidence, 'high'); assert.equal(r.amountNumber, amount);
      assert.equal(r.category, 'Avis');
    } else review(r);
  };
}
const invoices = Array.from({ length: 20 }, (_, i) => ({ name: `invoice-${i}.pdf`, type: 'application/pdf',
  text: pdf(`Rechnung\nRechnungsnummer: RE${1000 + i}\nRechnungsbetrag: 100,00 EUR\nBitte bezahlen Sie innerhalb von 14 Tagen.`) }));
run('20 invoices', { attachments: invoices }, r => {
  assert.equal(r.verdict, 'other'); assert.equal(r.patchSubject, ''); assert.equal(r.patchCategory, '');
});
const advice = { name: 'document.pdf', type: 'application/pdf', text: pdf(textAdvice('1.200,30')) };
run('advice as neutral-named twentieth attachment', { attachments: [...invoices.slice(0, 19), advice] }, correctOrReview(1200.30));
run('31 attachments, unread advice beyond processing limit', {
  attachments: [...invoices, ...invoices.slice(0, 10).map((x, i) => ({ ...x, name: `more-${i}.pdf`, text: x.text.replace('RE10', 'RE20') })), advice],
}, review);
const pages = Array.from({ length: 72 }, (_, p) => [
  'Zahlungsavis', `Seite ${p + 1} von 72`, 'Rechnungsnummer   Betrag',
  ...Array.from({ length: 10 }, (_, i) => `RE${10000 + p * 10 + i}   10,00 EUR`),
  ...(p === 71 ? ['Wir haben Ihre Rechnungen heute bezahlt.', 'Gesamtzahlbetrag: 7.200,00 EUR'] : []),
].join('\n'));
const large = multiPage(pages);
run('72-page advice, final total on last page', { attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: large }] }, correctOrReview(7200));
run('72-page advice with truncated ending', { attachments: [{ name: 'avis.pdf', type: 'application/pdf', text: large.slice(0, -150) }] }, review);
console.log(`PASS: ${checks} synthetic volume checks (10 s local VM limit per invocation).`);
