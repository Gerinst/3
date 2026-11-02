// Stateful, offline audit of the actual parser and the HTML flow definition.
// This is NOT a Microsoft 365 integration test. The fake mailbox explicitly
// models PATCH as field replacement, move as an ID change, and final action
// statuses after connector retries. It cannot verify connector serialization,
// server permissions, delivery guarantees, or Office Script performance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, eml, fixtures } = require('./fixtures.cjs');

const mailbox = 'avis@firma.de';
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/avis-flow.html'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1], context);
const flow = context.window.AvisFlow;
const parser = load();
const clone = value => JSON.parse(JSON.stringify(value));
const local = text => text.replaceAll('{{MB}}', mailbox).replaceAll('{{mb}}', mailbox);

function evaluate(raw, state) {
  if (typeof raw !== 'string' || !raw.startsWith('@')) return raw;
  return vm.runInNewContext(local(raw.slice(1)).replace(/\?\[/g, '?.[').replace(/\bif\(/g, 'iif('), {
    actions: name => ({ status: state.status[name] }),
    outputs: () => Object.fromEntries(Object.entries(state.result || {})
      .map(([k, v]) => ['body/result/' + k, v])),
    triggerOutputs: () => ({ 'body/id': state.event.id, 'body/from': state.event.from,
      'body/subject': state.event.subject }),
    body: name => state.outputs[name],
    equals: (a, b) => a === b, not: a => !a,
    and: (...args) => args.every(Boolean), or: (...args) => args.some(Boolean),
    empty: a => a == null || a === '' || (Array.isArray(a) && a.length === 0),
    concat: (...args) => args.join(''), coalesce: (...args) => args.find(a => a != null),
    split: (s, sep) => s.split(sep), trim: s => s.trim(), first: a => a[0],
    endsWith: (s, suffix) => s.endsWith(suffix), contains: (a, b) => a.includes(b),
    toLower: s => s.toLowerCase(), json: JSON.parse, string: JSON.stringify,
    iif: (c, a, b) => c ? a : b, union: (...arrays) => [...new Set(arrays.flat())],
    createArray: (...args) => args, setProperty: (obj, key, value) => ({ ...obj, [key]: value }),
  });
}
function condition(expr, state) {
  if (expr.and) return expr.and.every(x => condition(x, state));
  if (expr.not) return !condition(expr.not, state);
  if (expr.equals) return evaluate(expr.equals[0], state) === evaluate(expr.equals[1], state);
  if (expr.contains) return evaluate(expr.contains[0], state).includes(evaluate(expr.contains[1], state));
  throw Error('Unsupported condition: ' + JSON.stringify(expr));
}
function uiGraph(items, mode) {
  return Object.fromEntries(items.map(item => {
    const id = typeof item === 'string' ? item : item.cond;
    const node = flow.node(id, mode);
    const after = node.settings.flatMap(s => s.items).find(i => i.t === 'runafter');
    const names = { s: 'Succeeded', f: 'Failed', t: 'TimedOut', k: 'Skipped' };
    const runAfter = after ? { [after.action.replaceAll(' ', '_')]:
      Object.keys(after.st).filter(k => after.st[k]).map(k => names[k]) } : {};
    if (typeof item === 'string') return [id, { type: 'OpenApiConnection', runAfter }];
    const expression = id === 'Keine_Automatik' ? flow.code(id).expression : {
      and: node.params.find(p => p.t === 'condition').rows.map(row => ({
        equals: ['@' + row.l.expr, '@' + row.r.expr],
      })),
    };
    return [id, { type: 'If', runAfter, expression,
      actions: uiGraph(item.yes, mode), else: { actions: uiGraph(item.no, mode) } }];
  }));
}
const graphs = {
  main: { Keine_Automatik: flow.code('Keine_Automatik') },
  planB: uiGraph(flow.tree('planB').filter(x => x !== 'trigger'), 'planB'),
};
function skip(actions, state) {
  for (const [id, action] of Object.entries(actions)) {
    state.status[id] = 'Skipped';
    if (action.type === 'If') { skip(action.actions, state); skip(action.else.actions, state); }
  }
}
function execute(actions, state) {
  const pending = new Set(Object.keys(actions).sort());
  const result = {};
  while (pending.size) {
    let progress = false;
    for (const id of pending) {
      const action = actions[id];
      const dependencies = Object.entries(action.runAfter || {});
      if (!dependencies.every(([key]) => key in state.status && !pending.has(key))) continue;
      pending.delete(id); progress = true;
      const forced = state.options.forced?.[id];
      if (!dependencies.every(([key, allowed]) => allowed.includes(state.status[key])) || forced === 'Skipped') {
        skip({ [id]: action }, state); result[id] = 'Skipped';
      } else if (action.type === 'If') {
        const yes = condition(action.expression, state);
        state.decisions[id] = yes;
        skip(yes ? action.else.actions : action.actions, state);
        const children = execute(yes ? action.actions : action.else.actions, state);
        result[id] = Object.values(children).some(s => ['Failed', 'TimedOut'].includes(s)) ? 'Failed' : 'Succeeded';
      } else {
        let status = forced || 'Succeeded';
        let detail;
        if (status === 'Succeeded' || state.options.commitDespiteFailure === id) {
          try { detail = effect(id, state); }
          catch (error) { status = 'Failed'; detail = { error: error.message }; }
        }
        result[id] = status;
        state.trace.push({ id, status, detail });
      }
      state.status[id] = result[id];
    }
    assert(progress, 'Unresolved flow dependencies: ' + [...pending]);
  }
  return result;
}

function environment(fixture = fixtures.three, extra = {}) {
  const record = { id: 'message-1', subject: 'Abrechnung Oktober', categories: ['Buchhaltung'],
    from: 'kunde@example.org', folder: 'Posteingang', fixture: clone(fixture), ...extra };
  return { records: new Map([[record.id, record]]), record, sent: [], drafts: [], sequence: 1 };
}
const eventOf = record => ({ id: record.id, subject: record.subject, from: record.from });
function mime(record, withCategories = true) {
  return Buffer.from(Buffer.from(eml({ ...record.fixture, subject: record.subject,
    keywords: withCategories ? record.categories.join(', ') : '' }), 'base64').toString()
    .replace('Kunde <kunde@example.org>', '<' + record.from + '>')).toString('base64');
}
function requireRecord(state) {
  const record = state.env.records.get(state.event.id);
  if (!record) throw Error('simulated 404: stale message ID');
  return record;
}
function nodeBody(id, state) {
  const param = flow.node(id, state.mode).params.find(p => p.label === 'Text');
  return param.expr ? evaluate('@' + param.expr, state) : param.value;
}
function patch(record, body) {
  const payload = JSON.parse(body);
  if ('subject' in payload) record.subject = payload.subject;
  if ('categories' in payload) record.categories = clone(payload.categories);
  if ('replyTo' in payload) record.replyTo = clone(payload.replyTo);
  return clone(payload);
}
function effect(id, state) {
  const env = state.env;
  if (id === 'Export_email') {
    state.exported = mime(requireRecord(state), state.options.exportCategories !== false);
    state.options.afterExport?.(env.record);
    return;
  }
  if (id === 'Run_script') {
    state.result = clone(parser.main({}, state.exported, '', state.event.subject, mailbox));
    return { verdict: state.result.verdict, needsReview: state.result.needsReview };
  }
  if (['Nachricht_vor_Betreff_lesen', 'Nachricht_vor_Kategorie_lesen'].includes(id)) {
    const record = requireRecord(state);
    state.outputs[id] = clone({ subject: record.subject, categories: record.categories });
    state.options.afterRead?.(id, record);
    return state.outputs[id];
  }
  if (['Betreff_setzen', 'Kategorie_setzen'].includes(id)) {
    return patch(requireRecord(state), nodeBody(id, state));
  }
  if (id === 'Kopie_anlegen') {
    const draft = { ...clone(requireRecord(state)), id: 'draft-' + ++env.sequence };
    env.drafts.push(draft); state.draft = draft; state.outputs[id] = { id: draft.id };
    return { id: draft.id };
  }
  if (id === 'Kopie_anpassen') return patch(state.draft, nodeBody(id, state));
  if (id === 'Kopie_senden') {
    const copy = { ...clone(state.draft), id: 'copy-' + ++env.sequence,
      from: mailbox, folder: 'Posteingang' };
    env.records.set(copy.id, copy); env.sent.push(copy);
    return { id: copy.id };
  }
  if (['Avisbetrag_fehlt_verschieben', 'Original_verschieben'].includes(id)) {
    const record = requireRecord(state);
    env.records.delete(record.id);
    record.id = 'moved-' + ++env.sequence;
    record.folder = id === 'Original_verschieben' ? 'Avis-Original' : 'Posteingang/Archive/Avisbetrag fehlt';
    env.records.set(record.id, record);
    return { id: record.id, folder: record.folder };
  }
  throw Error('Unmodelled action: ' + id);
}
function run(mode, env, event = eventOf(env.record), options = {}) {
  const state = { mode, env, event: clone(event), options, result: {}, status: {},
    decisions: {}, trace: [], outputs: {} };
  execute(graphs[mode], state);
  return state;
}
const attempted = state => state.trace.map(x => x.id);
const succeeded = (state, id) => state.trace.some(x => x.id === id && x.status === 'Succeeded');
const risks = [];
let cases = 0;
function test(name, fn) { fn(); cases++; }
function knownRisk(name, fn) {
  // Reproductions describe current limitations, not desirable behavior. If a
  // future fix changes an assertion, convert it into a prevention regression.
  test(name, fn); risks.push(name);
}

for (const mode of ['main', 'planB']) {
  test(mode + ': success preserves unrelated categories', () => {
    const env = environment(fixtures.three, { categories: ['Buchhaltung', 'Priorität', 'mehrere Avise'] });
    const state = run(mode, env);
    assert.deepEqual(env.record.categories, ['Buchhaltung', 'Priorität', 'mehrere Avise', 'Avis']);
    const lastWrite = mode === 'main' ? 'Betreff_setzen' : 'Kopie_senden';
    assert(attempted(state).indexOf(lastWrite) < attempted(state).indexOf('Kategorie_setzen'));
    assert.equal(env.record.folder, mode === 'main' ? 'Posteingang' : 'Avis-Original');
  });
  for (const action of mode === 'main' ? ['Betreff_setzen'] : ['Kopie_anlegen', 'Kopie_anpassen', 'Kopie_senden']) {
    for (const failure of ['Failed', 'TimedOut', 'Skipped']) {
      test(mode + ': ' + action + ' ' + failure + ' blocks category and move', () => {
        const env = environment(); const state = run(mode, env, undefined, { forced: { [action]: failure } });
        assert(!attempted(state).includes('Kategorie_setzen'));
        assert.equal(env.record.folder, 'Posteingang');
        assert.deepEqual(env.record.categories, ['Buchhaltung']);
        assert.equal(env.sent.length, 0);
      });
    }
  }
  test(mode + ': already matching prefix allows category without write/copy', () => {
    const env = environment(); const result = parser.main({}, mime(env.record));
    env.record.subject = result.newSubject;
    const state = run(mode, env);
    assert(succeeded(state, 'Kategorie_setzen'));
    assert(!attempted(state).includes(mode === 'main' ? 'Betreff_setzen' : 'Kopie_anlegen'));
    assert.equal(env.record.folder, 'Posteingang');
  });
  test(mode + ': review move failure preserves subject and categories; retry succeeds', () => {
    const env = environment({ body: 'Zahlungsavis: Den Betrag finden Sie in unserem Kundenportal.' });
    const event = eventOf(env.record);
    const failed = run(mode, env, event, { forced: { Avisbetrag_fehlt_verschieben: 'Failed' } });
    assert.equal(failed.result.needsReview, true);
    assert.equal(env.record.subject, event.subject);
    assert.deepEqual(env.record.categories, ['Buchhaltung']);
    assert.equal(env.record.folder, 'Posteingang');
    const retry = run(mode, env, event);
    assert(succeeded(retry, 'Avisbetrag_fehlt_verschieben'));
    assert.deepEqual(env.record.categories, ['Buchhaltung']);
    const stale = run(mode, env, event);
    assert.equal(stale.status.Run_script, 'Skipped');
    assert.equal(stale.status.Avisbetrag_fehlt_verschieben, 'Failed');
    assert(!attempted(stale).includes('Kategorie_setzen'));
  });
}
test('main: duplicate old delivery and fresh rerun do not stack prefixes', () => {
  const env = environment(); const event = eventOf(env.record);
  run('main', env, event); const expected = env.record.subject;
  run('main', env, event); assert.equal(env.record.subject, expected);
  const fresh = run('main', env); assert(!attempted(fresh).includes('Betreff_setzen'));
  assert.deepEqual(env.record.categories, ['Buchhaltung', 'Avis']);
});
test('main: successful remote patch with timeout response still blocks category', () => {
  const env = environment(); const state = run('main', env, undefined, {
    forced: { Betreff_setzen: 'TimedOut' }, commitDespiteFailure: 'Betreff_setzen',
  });
  assert(env.record.subject.startsWith('1.200,30 + '));
  assert(!attempted(state).includes('Kategorie_setzen'));
  assert.deepEqual(env.record.categories, ['Buchhaltung']);
});
test('planB: normal own copy terminates without exporting or creating another copy', () => {
  const env = environment(); run('planB', env);
  assert.equal(env.sent.length, 1);
  const copyRun = run('planB', env, eventOf(env.sent[0]));
  assert.deepEqual(attempted(copyRun), []);
  assert.equal(env.sent.length, 1);
});
for (const marker of ['?', '(prüfen)', 'EUR ? -', 'EUR (prüfen) -']) {
  test('planB: old own review marker ' + marker + ' is left for manual handling', () => {
    const env = environment({}, { from: mailbox, subject: '1.200,30 ' + marker + ' Zahlungsavis' });
    const state = run('planB', env);
    assert.deepEqual(attempted(state), []);
    assert.equal(env.record.folder, 'Posteingang');
    assert.deepEqual(env.record.categories, ['Buchhaltung']);
  });
}
test('planB: same-sender non-advice cannot receive automatic Avis', () => {
  const env = environment({ body: 'Hallo, unser Besprechungstermin ist morgen um zehn Uhr.' },
    { from: mailbox, subject: 'Besprechung' });
  assert.equal(parser.main({}, mime(env.record)).verdict, 'other');
  const state = run('planB', env);
  assert.deepEqual(attempted(state), []);
  assert.deepEqual(env.record.categories, ['Buchhaltung']);
});
test('planB: own-copy bypass leaves unrelated categories unchanged', () => {
  const env = environment({}, { from: mailbox, subject: '1.200,30 Zahlungsavis', categories: ['Priorität'] });
  run('planB', env); assert.deepEqual(env.record.categories, ['Priorität']);
});
knownRisk('planB: replay after successful send and failed original move creates a second copy', () => {
  const env = environment(); const event = eventOf(env.record);
  run('planB', env, event, { forced: { Original_verschieben: 'Failed' } });
  assert.equal(env.record.folder, 'Posteingang'); assert.equal(env.sent.length, 1);
  run('planB', env, event); assert.equal(env.sent.length, 2);
});
knownRisk('planB: send committed but timed-out response permits a duplicate on replay', () => {
  const env = environment(); const event = eventOf(env.record);
  const state = run('planB', env, event, {
    forced: { Kopie_senden: 'TimedOut' }, commitDespiteFailure: 'Kopie_senden',
  });
  assert.equal(env.sent.length, 1); assert(!attempted(state).includes('Kategorie_setzen'));
  run('planB', env, event); assert.equal(env.sent.length, 2);
});
test('main: stale trigger cannot overwrite a later manual subject edit', () => {
  const env = environment(); const event = eventOf(env.record);
  run('main', env, event);
  env.record.subject = 'Manuell korrigierter Betreff';
  const state = run('main', env, event);
  assert.equal(env.record.subject, 'Manuell korrigierter Betreff');
  assert(!attempted(state).includes('Betreff_setzen'));
  assert(!attempted(state).includes('Kategorie_setzen'));
});
test('main: category added after export is preserved by fresh category GET', () => {
  const env = environment(); run('main', env, undefined, {
    afterExport: record => record.categories.push('Neu durch Kollegin'),
  });
  assert.deepEqual(env.record.categories, ['Buchhaltung', 'Neu durch Kollegin', 'Avis']);
});
test('main: fresh category GET preserves categories omitted from MIME export', () => {
  const env = environment(); run('main', env, undefined, { exportCategories: false });
  assert.deepEqual(env.record.categories, ['Buchhaltung', 'Avis']);
});
knownRisk('main: subject edit between final GET and PATCH can still be overwritten', () => {
  const env = environment(); run('main', env, undefined, {
    afterRead: (id, record) => { if (id === 'Nachricht_vor_Betreff_lesen') record.subject = 'Manuelle Zwischenänderung'; },
  });
  assert.notEqual(env.record.subject, 'Manuelle Zwischenänderung');
});
knownRisk('main: category added between final GET and PATCH can still be lost', () => {
  const env = environment(); run('main', env, undefined, {
    afterRead: (id, record) => { if (id === 'Nachricht_vor_Kategorie_lesen') record.categories.push('Gleichzeitig neu'); },
  });
  assert.deepEqual(env.record.categories, ['Buchhaltung', 'Avis']);
});
for (const mode of ['main', 'planB']) {
  for (const action of ['Nachricht_vor_Betreff_lesen', 'Nachricht_vor_Kategorie_lesen']) {
    for (const failure of ['Failed', 'TimedOut', 'Skipped']) {
      test(mode + ': ' + action + ' ' + failure + ' blocks category/archive', () => {
        const env = environment(); const state = run(mode, env, undefined, { forced: { [action]: failure } });
        assert(!attempted(state).includes('Kategorie_setzen'));
        assert.equal(env.record.folder, 'Posteingang');
        assert.deepEqual(env.record.categories, ['Buchhaltung']);
      });
    }
  }
}
console.log(`PASS: ${cases} stateful offline safety scenarios; ${risks.length} current limitations reproduced.`);
for (const name of risks) console.log('KNOWN LIMITATION (simulation): ' + name);
console.log('No network or Microsoft 365 calls made; delivery/ID changes/response loss are explicit simulated conditions.');
