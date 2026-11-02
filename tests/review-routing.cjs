const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, eml, fixtures } = require('./fixtures.cjs');

const html = fs.readFileSync(path.join(__dirname, '../dist/avis-flow.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context = { window: {} };
vm.runInNewContext(script, context);
const flow = context.window.AvisFlow;
const plain = value => JSON.parse(JSON.stringify(value));
const resultKeys = result => Object.fromEntries(
  Object.entries(result).map(([key, value]) => ['body/result/' + key, value]),
);

// Evaluate the actual expressions from the HTML in a local, network-free model
// of the Power Automate functions used by this flow.
function expression(raw, state) {
  if (typeof raw !== 'string' || !raw.startsWith('@')) return raw;
  const code = raw.slice(1).replace(/\?\[/g, '?.[');
  return vm.runInNewContext(code, {
    actions: name => ({ status: state.status[name] }),
    outputs: () => resultKeys(state.result),
    triggerOutputs: () => ({
      'body/id': 'original-message-id',
      'body/from': state.from || 'kunde@example.org',
      'body/subject': state.subject || 'Abrechnung Oktober',
    }),
    body: () => ({ id: 'draft-copy-id' }),
    equals: (a, b) => a === b,
    not: a => !a,
    and: (...args) => args.every(Boolean),
    or: (...args) => args.some(Boolean),
    empty: a => a == null || a === '' || (Array.isArray(a) && a.length === 0),
    concat: (...args) => args.join(''),
    coalesce: (...args) => args.find(a => a != null),
    split: (s, separator) => s.split(separator),
    trim: s => s.trim(),
    first: a => a[0],
    endsWith: (s, suffix) => s.endsWith(suffix),
    contains: (a, b) => a.includes(b),
    toLower: s => s.toLowerCase(),
  });
}

function condition(tree, state) {
  if (tree.and) return tree.and.every(item => condition(item, state));
  if (tree.not) return !condition(tree.not, state);
  if (tree.equals) {
    return expression(tree.equals[0], state) === expression(tree.equals[1], state);
  }
  if (tree.contains) {
    return expression(tree.contains[0], state).includes(expression(tree.contains[1], state));
  }
  throw Error('Unmodelled condition: ' + JSON.stringify(tree));
}

function skipAll(actions, state) {
  for (const [name, action] of Object.entries(actions)) {
    state.status[name] = 'Skipped';
    if (action.type === 'If') {
      skipAll(action.actions, state);
      skipAll(action.else.actions, state);
    }
  }
}

function execute(actions, state) {
  // Names are deliberately sorted: the runAfter graph must establish order,
  // regardless of JSON property order or the layout in the designer.
  const pending = new Set(Object.keys(actions).sort());
  const local = {};
  while (pending.size) {
    let progress = false;
    for (const name of pending) {
      const action = actions[name];
      const dependencies = Object.entries(action.runAfter || {});
      if (!dependencies.every(([id]) => id in state.status && !pending.has(id))) continue;
      pending.delete(name);
      progress = true;
      if (!dependencies.every(([id, allowed]) => allowed.includes(state.status[id]))) {
        skipAll({ [name]: action }, state);
        local[name] = 'Skipped';
      } else if (action.type === 'If') {
        const yes = condition(action.expression, state);
        skipAll(yes ? action.else.actions : action.actions, state);
        const children = execute(yes ? action.actions : action.else.actions, state);
        local[name] = Object.values(children).some(s => s === 'Failed' || s === 'TimedOut')
          ? 'Failed' : 'Succeeded';
      } else {
        state.trace.push(name);
        local[name] = state.forced[name] || 'Succeeded';
        if (action.inputs?.parameters?.Body) {
          const payload = expression(action.inputs.parameters.Body, state);
          if (typeof payload === 'string' && payload.startsWith('{')) {
            const json = JSON.parse(payload);
            assert(!json.categories?.includes('Avis prüfen'), 'retired review category written');
          }
        }
      }
      state.status[name] = local[name];
    }
    assert(progress, 'Unsatisfied action dependencies: ' + [...pending]);
  }
  return local;
}

function graphFromUi(items, mode) {
  const statuses = { s: 'Succeeded', t: 'TimedOut', f: 'Failed', k: 'Skipped' };
  return Object.fromEntries(items.map(item => {
    const id = typeof item === 'string' ? item : item.cond;
    const node = flow.node(id, mode);
    const after = node.settings.flatMap(section => section.items).find(x => x.t === 'runafter');
    const runAfter = after ? {
      [after.action.replaceAll(' ', '_')]: Object.keys(after.st)
        .filter(key => after.st[key]).map(key => statuses[key]),
    } : {};
    if (typeof item === 'string') return [id, { type: 'OpenApiConnection', runAfter }];
    const rows = node.params.find(p => p.t === 'condition').rows;
    return [id, {
      type: 'If', runAfter,
      expression: { and: rows.map(row => ({ equals: ['@' + row.l.expr, '@' + row.r.expr] })) },
      actions: graphFromUi(item.yes, mode),
      else: { actions: graphFromUi(item.no, mode) },
    }];
  }));
}

function findNode(items, id) {
  for (const item of items) {
    if (typeof item === 'string') continue;
    if (item.cond === id) return item;
    const found = findNode(item.yes, id) || findNode(item.no, id);
    if (found) return found;
  }
}

const parser = load();
const multi = parser.main({}, eml(fixtures.three));
const rerun = parser.main({}, eml({ ...fixtures.three, subject: multi.newSubject }));
const missing = parser.main({}, eml({
  subject: 'Zahlungsavis',
  attachments: [{ name: 'Avis.pdf', type: 'application/pdf', text: '%PDF-1.4\n%%EOF' }],
}));
const low = vm.runInContext(`(() => {
  const result = emptyResult();
  Object.assign(result, { verdict: 'advice', ok: true, amountNumber: 1200.3,
    currency: 'EUR', confidence: 'low' });
  return finishResult(result, 'Abrechnung Oktober', '');
})()`, parser);
const other = parser.main({}, eml({ subject: 'Hallo', body: 'Vielen Dank für Ihre Nachricht.' }));
const noInput = parser.main({}, '');
assert.equal(missing.needsReview, true);
assert.equal(low.needsReview, true);
assert.equal(other.needsReview, false);
assert.equal(noInput.needsReview, true);

const main = { Bearbeitung_noetig: flow.code('Bearbeitung_noetig') };
const pbNode = findNode(flow.tree('planB'), 'Bearbeitung_noetig');
const planB = graphFromUi([pbNode], 'planB');
let checks = 0;
function check(label, graph, result, expected, options = {}) {
  const state = {
    result, trace: [], status: { Run_script: options.scriptStatus || 'Succeeded' },
    forced: options.forced || {}, ...options,
  };
  execute(graph, state);
  assert.deepEqual(state.trace, expected, label);
  checks++;
  return state;
}

for (const [mode, graph] of [['main', main], ['planB', planB]]) {
  const subject = mode === 'main' ? ['Betreff_setzen'] : ['Kopie_anlegen', 'Kopie_anpassen', 'Kopie_senden'];
  const normal = [...subject, 'Kategorie_setzen', ...(mode === 'planB' ? ['Original_verschieben'] : [])];
  check(mode + ' normal multiple', graph, multi, normal);
  check(mode + ' repeated complete subject', graph, rerun, ['Kategorie_setzen']);
  check(mode + ' missing amount', graph, missing, ['Avisbetrag_fehlt_verschieben']);
  check(mode + ' low confidence', graph, low,
    [...(mode === 'main' ? subject : []), 'Avisbetrag_fehlt_verschieben']);
  check(mode + ' no input', graph, noInput, ['Avisbetrag_fehlt_verschieben']);
  check(mode + ' other mail', graph, other, []);
  check(mode + ' legacy script review category', graph,
    { category: 'Avis prüfen', patchCategory: '{"categories":["Avis prüfen"]}', patchSubject: '' },
    ['Avisbetrag_fehlt_verschieben']);
  for (const scriptStatus of ['Failed', 'TimedOut', 'Skipped']) {
    check(mode + ' script ' + scriptStatus, graph, {}, ['Avisbetrag_fehlt_verschieben'], { scriptStatus });
  }
  for (const failure of ['Failed', 'TimedOut']) {
    check(mode + ' failed move has no category fallback', graph, missing,
      ['Avisbetrag_fehlt_verschieben'], { forced: { Avisbetrag_fehlt_verschieben: failure } });
    check(mode + ' subject or copy failure still categorizes normal advice', graph, multi,
      [subject[0], 'Kategorie_setzen'], { forced: { [subject[0]]: failure } });
  }
}

for (const failure of ['Failed', 'TimedOut']) {
  check('review subject failure still moves original', main, low,
    ['Betreff_setzen', 'Avisbetrag_fehlt_verschieben'], { forced: { Betreff_setzen: failure } });
}

check('automatic reply never reaches review handling',
  { Keine_Automatik: flow.code('Keine_Automatik') }, missing, [],
  { subject: 'Automatische Antwort: Zahlungsavis' });
check('export failure skips script but still moves original',
  { Keine_Automatik: flow.code('Keine_Automatik') }, {},
  ['Export_email', 'Avisbetrag_fehlt_verschieben'],
  { forced: { Export_email: 'Failed' } });

// The final move addresses the original email in the selected shared mailbox.
const move = plain(flow.code('Avisbetrag_fehlt_verschieben', 'team@example.org'));
assert.equal(move.inputs.host.operationId, 'MoveV2');
assert.equal(move.inputs.parameters.messageId, "@triggerOutputs()?['body/id']");
assert.equal(move.inputs.parameters.mailboxAddress, 'team@example.org');
assert.equal(move.inputs.parameters.folderPath, flow.ID.reviewFolder);

const copyNode = findNode(flow.tree('planB'), 'Kopie_pruefen');
const copies = graphFromUi([copyNode], 'planB');
for (const subject of ['1.200,30 ? Zahlungsavis', '1.200,30 EUR ? - Zahlungsavis']) {
  check('old uncertain copy: ' + subject, copies, {}, ['Kopie_Pruefordner_verschieben'], { subject });
}
check('normal multiple copy with question in original subject', copies, {}, ['Kategorie_Kopie'],
  { subject: '1.200,30 + 5.632,21 Abrechnung?' });

const files = {
  pdf: 'Run_script_pdfBase64', workLinks: 'Bearbeitung_noetig_links',
  reviewLinks: 'Pruefung_noetig_links', uri: 'URI_Kategorie_und_Betreff',
  katText: 'Kategorie_setzen_Text', betLinks: 'Betreff_noetig_links',
  betText: 'Betreff_setzen_Text', betLinksB: 'Betreff_noetig_Plan_B_links',
  copyReviewLinks: 'Kopie_pruefen_links',
};
for (const [key, name] of Object.entries(files)) {
  const formula = fs.readFileSync(path.join(__dirname, '../formeln/' + name + '.txt'), 'utf8').trim();
  assert.equal(formula, flow.F[key].replaceAll('{{MB}}', 'avis@firma.de'), name);
}
function flatten(items) {
  return items.flatMap(item => typeof item === 'string' ? [item]
    : [item.cond, ...flatten(item.yes), ...flatten(item.no)]);
}
for (const mode of ['main', 'planB']) {
  const ids = plain(flatten(flow.tree(mode)));
  assert.equal(new Set(ids).size, ids.length, mode + ' has unique action IDs');
  assert.deepEqual(plain(flow.order(mode)).slice(0, -1), ids, mode + ' navigation follows diagram');
}
console.log(`PASS: ${checks} review-routing scenarios; destination, 9 formulas and both diagrams verified.`);
