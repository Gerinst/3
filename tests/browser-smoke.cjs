// Optional UI check: requires Playwright and a Chromium executable.
// Run: CHROMIUM_PATH=/usr/bin/chromium node tests/browser-smoke.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(fs.readFileSync(path.join(__dirname, '../dist/avis-flow.html'), 'utf8'));
    for (const [id, parent] of [
      ['Betreff_setzen', 'Betreff_unveraendert'],
      ['Kategorie_setzen', 'Kategorie_Betreff_passt'],
      ['Avisbetrag_fehlt_verschieben', 'Pruefung_noetig'],
    ]) assert.equal(await page.locator(`#flow [data-id="${id}"]`).evaluate(e => e.closest('.scope').dataset.scope), parent);
    await page.locator('#flow [data-id="Run_script"]').click();
    await page.locator('[data-tab="param"]').click();
    assert.match(await page.locator('#panel').innerText(), /ScriptParameters\/mailboxAddress/);
    assert.match(await page.locator('#panel').innerText(), /avis@firma\.de/);
    for (const id of ['Nachricht_vor_Betreff_lesen', 'Nachricht_vor_Kategorie_lesen']) {
      await page.locator(`#flow [data-id="${id}"]`).click();
      assert.match(await page.locator('#panel').innerText(), /GET/);
    }
    await page.locator('#flow [data-id="Avisbetrag_fehlt_verschieben"]').click();
    assert.match(await page.locator('#panel').innerText(), /Posteingang.*Archive.*Avisbetrag fehlt/);
    await page.locator('[data-tab="code"]').click();
    const code = await page.evaluate(() => {
      const x = AvisFlow.code('Avisbetrag_fehlt_verschieben');
      x.inputs.parameters.folderPath = 'Id::tenant-specific-folder';
      return JSON.stringify(x);
    });
    await page.locator('#cmpIn').fill(code);
    await page.locator('#cmpBtn').click();
    assert.match(await page.locator('#cmpOut').innerText(), /stimmt|passt|überein/i);
    await page.locator('#vPlanB').click();
    assert.equal(await page.locator('#flow [data-id="Kategorie_Kopie"]').count(), 0);
    assert.equal(await page.locator('#flow [data-id="Kopie_pruefen"]').count(), 0);
    await page.locator('#flow [data-id="Eigene_Kopie"]').click();
    await page.locator('[data-tab="info"]').click();
    assert.match(await page.locator('#panel').innerText(), /keine|leer|unverändert/);
    await page.locator('#pClose').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#vMain').click();
    await page.locator('#flow [data-id="Avisbetrag_fehlt_verschieben"]').click();
    assert.match(await page.locator('#panel').innerText(), /Avisbetrag fehlt/);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile flow UI, fresh reads, mailbox parameter, folder-code comparison and disabled own-copy actions.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
