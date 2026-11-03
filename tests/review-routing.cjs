const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, eml, fixtures } = require('./fixtures.cjs');
const mainOnly = process.argv.includes('--main-only') || process.env.AVIS_TEST_SCOPE === 'main';
const modes = mainOnly ? ['main'] : ['main', 'planB'];

const html = fs.readFileSync(path.join(__dirname, '../dist/avis-flow.html'), 'utf8');
let script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
if (mainOnly) {
  // The HTML eagerly flattens both navigation trees. Suppress only the unused
  // Plan B traversal; the actual main-flow code and formulas stay unchanged.
  const unusedNavigation = "planB: flatNodes(TREE.planB).concat('finishB')";
  assert.equal(script.split(unusedNavigation).length, 2, 'expected one Plan B navigation initializer');
  script = script.replace(unusedNavigation, 'planB: []');
}
const context = { window: {} };
vm.runInNewContext(script, context);
const flow = context.window.AvisFlow;
if (mainOnly) {
  for (const [name, modeIndex] of [['tree', 0], ['order', 0], ['node', 1]]) {
    const original = flow[name];
    flow[name] = (...args) => {
      assert.notEqual(args[modeIndex], 'planB', 'Plan B access is excluded in main-only scope');
      return original(...args);
    };
  }
}
const plain = value => JSON.parse(JSON.stringify(value));
const resultKeys = result => Object.fromEntries(
  Object.entries(result).map(([key, value]) => ['body/result/' + key, value]),
);

// Evaluate the actual expressions from the HTML in a local, network-free model
// of the Power Automate functions used by this flow.
function expression(raw, state) {
  if (typeof raw !== 'string' || !raw.startsWith('@')) return raw;
  const code = raw.slice(1).replaceAll('{{MB}}', state.mailbox || 'avis@firma.de')
    .replaceAll('{{mb}}', (state.mailbox || 'avis@firma.de').toLowerCase())
    .replace(/\?\[/g, '?.[').replace(/\bif\(/g, 'ifValue(');
  const currentSubject = state.subject ?? 'Abrechnung Oktober';
  const bodies = {
    Nachricht_vor_Betreff_lesen: {
      subject: state.subjectBeforePatch ?? currentSubject,
      categories: state.categoriesBeforePatch ?? [],
    },
    Nachricht_vor_Kategorie_lesen: {
      subject: state.subjectBeforeCategory ?? (state.mode === 'planB'
        ? currentSubject : state.result.patchSubject ? state.result.newSubject : currentSubject),
      categories: state.categoriesBeforeCategory ?? [],
    },
    Kopie_anlegen: { id: 'draft-copy-id' },
    ...state.bodies,
  };
  return vm.runInNewContext(code, {
    actions: name => ({ status: state.status[name] }),
    outputs: name => name === 'Run_script' ? resultKeys(state.result) : { body: bodies[name] },
    triggerOutputs: () => ({
      'body/id': 'original-message-id',
      'body/from': state.from || 'kunde@example.org',
      'body/subject': currentSubject,
    }),
    body: name => bodies[name],
    equals: (a, b) => a === b,
    not: a => !a,
    and: (...args) => args.every(Boolean),
    or: (...args) => args.some(Boolean),
    empty: a => a == null || a === '' || (Array.isArray(a) && a.length === 0),
    concat: (...args) => args.join(''),
    coalesce: (...args) => args.find(a => a != null),
    ifValue: (test, yes, no) => test ? yes : no,
    json: JSON.parse,
    string: value => typeof value === 'string' ? value : JSON.stringify(value),
    setProperty: (value, key, item) => ({ ...value, [key]: item }),
    createArray: (...items) => items,
    union: (...arrays) => [...new Set(arrays.flat())],
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
      } else if (state.forced[name] === 'Skipped') {
        // A skipped action has no side effects. Keep the enclosing condition
        // successful here: a success gate must check the required write itself.
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
            state.payloads[name] = json;
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
    if (typeof item === 'string') {
      const body = node.params.find(p => p.label === 'Text' && p.expr);
      return [id, { type: 'OpenApiConnection', runAfter,
        ...(body ? { inputs: { parameters: { Body: '@' + body.expr } } } : {}) }];
    }
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
const single = parser.main({}, eml({ attachments: [fixtures.two.attachments[0]] }));
const unreadableSubject = parser.main({}, eml({
  attachments: [fixtures.two.attachments[0]], subject: '=?UTF-8?B?/w==?=',
}));
const multi = parser.main({}, eml(fixtures.three));
const rerun = parser.main({}, eml({ ...fixtures.three, subject: multi.newSubject }));
const missing = parser.main({}, eml({
  subject: 'Zahlungsavis',
  attachments: [{ name: 'Avis.pdf', type: 'application/pdf', text: '%PDF-1.4\n%%EOF' }],
}));
const medium = parser.main({}, eml({
  keywords: 'Buchhaltung',
  attachments: [{ name: 'Avis.txt', text:
    'Zahlungsavis\nWir haben Ihre Rechnung heute bezahlt.\n1.200,30 EUR\nMit freundlichen Gruessen' }],
}));
const low = parser.main({}, eml({
  keywords: 'Buchhaltung',
  attachments: [{ name: 'Avis.txt', text:
    'Zahlungsavis\nWir werden am 15. Dezember den Zahlbetrag 1.200,30 EUR ueberweisen.' }],
}));
const other = parser.main({}, eml({ subject: 'Hallo', body: 'Vielen Dank für Ihre Nachricht.' }));
const noInput = parser.main({}, '');
assert.equal(missing.needsReview, true);
assert.equal(single.confidence, 'high');
assert.equal(unreadableSubject.confidence, 'high');
assert.equal(unreadableSubject.needsReview, false);
assert.equal(unreadableSubject.patchSubject, '');
assert.equal(unreadableSubject.patchCategory, '');
assert.equal(medium.confidence, 'medium');
assert.equal(low.confidence, 'low');
for (const result of [medium, low]) {
  assert.equal(result.needsReview, true);
  for (const key of ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject']) {
    assert.equal(result[key], '', result.confidence + ' must not change ' + key);
  }
}
assert.equal(other.needsReview, false);
assert.equal(noInput.needsReview, true);

const main = { Bearbeitung_noetig: flow.code('Bearbeitung_noetig') };
const mainUi = graphFromUi([findNode(flow.tree('main'), 'Bearbeitung_noetig')], 'main');
const graphs = [['main', main], ['main UI', mainUi]];
if (!mainOnly) {
  const pbNode = findNode(flow.tree('planB'), 'Bearbeitung_noetig');
  graphs.push(['planB', graphFromUi([pbNode], 'planB')]);
}
let checks = 0;
function check(label, graph, result, expected, options = {}) {
  const state = {
    result, trace: [], payloads: {}, status: { Run_script: options.scriptStatus || 'Succeeded' },
    forced: options.forced || {}, ...options,
  };
  execute(graph, state);
  assert.deepEqual(state.trace, expected, label);
  checks++;
  return state;
}

for (const [mode, graph] of graphs) {
  const run = (label, result, expected, options = {}) =>
    check(mode + ' ' + label, graph, result, expected, { mode, ...options });
  const writes = mode === 'planB' ? ['Kopie_anlegen', 'Kopie_anpassen', 'Kopie_senden'] : ['Betreff_setzen'];
  const subject = ['Nachricht_vor_Betreff_lesen', ...writes];
  const category = ['Nachricht_vor_Kategorie_lesen', 'Kategorie_setzen'];
  const normal = [...subject, ...category, ...(mode === 'planB' ? ['Original_verschieben'] : [])];
  run('normal single', single, normal);
  run('normal multiple', multi, normal);
  run('repeated complete subject', rerun, category, { subject: multi.newSubject });
  run('unreadable original subject cannot be overwritten or categorized', unreadableSubject, []);
  run('missing amount', missing, ['Avisbetrag_fehlt_verschieben']);
  run('medium confidence', medium, ['Avisbetrag_fehlt_verschieben']);
  run('low confidence', low, ['Avisbetrag_fehlt_verschieben']);
  run('stale review subject is ignored',
    { ...low, patchSubject: '{"subject":"1.200,30 ? Abrechnung Oktober"}' },
    ['Avisbetrag_fehlt_verschieben']);
  run('no input', noInput, ['Avisbetrag_fehlt_verschieben']);
  run('other mail', other, []);
  run('legacy script review category',
    { category: 'Avis prüfen', patchCategory: '{"categories":["Avis prüfen"]}',
      patchSubject: '{"subject":"1.200,30 ? Abrechnung Oktober"}' },
    ['Avisbetrag_fehlt_verschieben']);
  run('changed subject before required write blocks all writes', multi,
    ['Nachricht_vor_Betreff_lesen'], { subjectBeforePatch: 'Manuell korrigierter Betreff' });
  run('changed subject before category blocks category and archive', multi,
    [...subject, 'Nachricht_vor_Kategorie_lesen'],
    { subjectBeforeCategory: 'Manuell korrigierter Betreff' });
  run('changed already prefixed subject blocks category', rerun,
    ['Nachricht_vor_Kategorie_lesen'],
    { subject: multi.newSubject, subjectBeforeCategory: 'Manuell korrigierter Betreff' });
  const merged = run('category merges fresh Graph categories', multi, normal,
    { categoriesBeforeCategory: ['Buchhaltung', 'Neu gesetzt', 'Avis'] });
  assert.deepEqual(merged.payloads.Kategorie_setzen.categories,
    ['Buchhaltung', 'Neu gesetzt', 'Avis'], mode + ' preserves fresh categories without duplicate Avis');
  for (const scriptStatus of ['Failed', 'TimedOut', 'Skipped']) {
    run('script ' + scriptStatus, {}, ['Avisbetrag_fehlt_verschieben'], { scriptStatus });
  }
  for (const failure of ['Failed', 'TimedOut', 'Skipped']) {
    run('failed move has no category fallback', missing,
      failure === 'Skipped' ? [] : ['Avisbetrag_fehlt_verschieben'],
      { forced: { Avisbetrag_fehlt_verschieben: failure } });
    for (const [index, action] of subject.entries()) {
      const attempted = subject.slice(0, index + (failure === 'Skipped' ? 0 : 1));
      run('required ' + action + ' ' + failure + ' blocks category and archive',
        multi, attempted, { forced: { [action]: failure } });
    }
    run('category read ' + failure + ' blocks category and archive', multi,
      [...subject, ...(failure === 'Skipped' ? [] : ['Nachricht_vor_Kategorie_lesen'])],
      { forced: { Nachricht_vor_Kategorie_lesen: failure } });
    run('category ' + failure + ' blocks archive', multi,
      [...subject, 'Nachricht_vor_Kategorie_lesen', ...(failure === 'Skipped' ? [] : ['Kategorie_setzen'])],
      { forced: { Kategorie_setzen: failure } });
  }
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

if (!mainOnly) {
const ownNode = findNode(flow.tree('planB'), 'Eigene_Kopie');
assert.deepEqual(plain(ownNode.yes), [], 'sender alone must not classify an own copy');
const copies = graphFromUi([ownNode], 'planB');
for (const subject of [
  '1.200,30 ? Zahlungsavis', '1.200,30 EUR ? - Zahlungsavis',
  '1.200,30 (prüfen) Zahlungsavis', '1.200,30 EUR (prüfen) - Zahlungsavis',
  '1.200,30 + 5.632,21 Abrechnung?', 'Eigene Nachricht ohne Betrag',
  '1.200,30 Zahlungsavis (prüfen)', '1.200,30 EUR - Zahlungsavis (prüfen)',
  '1.200,30 Zahlungsavis - Rückfrage ?',
]) {
  check('own sender is not classified: ' + subject, copies, {}, [],
    { subject, from: 'avis@firma.de', mode: 'planB' });
}
}

const files = {
  pdf: 'Run_script_pdfBase64', workLinks: 'Bearbeitung_noetig_links',
  reviewLinks: 'Pruefung_noetig_links', uri: 'URI_Kategorie_und_Betreff',
  katText: 'Kategorie_setzen_Text', betLinks: 'Betreff_noetig_links',
  betText: 'Betreff_setzen_Text',
  categoryAllowedLinks: 'Kategorie_erlaubt_links',
  uriRead: 'Nachricht_lesen_URI',
  subjectUnchangedLinks: 'Betreff_unveraendert_links',
  categorySubjectLinks: 'Kategorie_Betreff_passt_links',
  ...(!mainOnly ? {
    betLinksB: 'Betreff_noetig_Plan_B_links',
    categoryAllowedLinksB: 'Kategorie_erlaubt_Plan_B_links',
    categorySubjectLinksB: 'Kategorie_Betreff_passt_Plan_B_links',
  } : {}),
};
for (const [key, name] of Object.entries(files)) {
  const formula = fs.readFileSync(path.join(__dirname, '../formeln/' + name + '.txt'), 'utf8').trim();
  assert.equal(formula, flow.F[key].replaceAll('{{MB}}', 'avis@firma.de'), name);
}
function flatten(items) {
  return items.flatMap(item => typeof item === 'string' ? [item]
    : [item.cond, ...flatten(item.yes), ...flatten(item.no)]);
}
for (const mode of modes) {
  const ids = plain(flatten(flow.tree(mode)));
  assert.equal(new Set(ids).size, ids.length, mode + ' has unique action IDs');
  assert.deepEqual(plain(flow.order(mode)).slice(0, -1), ids, mode + ' navigation follows diagram');
}
console.log(`PASS: ${checks} review-routing scenarios; destination, ${Object.keys(files).length} formulas and ${mainOnly ? 'main diagram verified; Plan B excluded' : 'both diagrams verified'}.`);
