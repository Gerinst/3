// Run archived test inputs against the current parser without executing archived code.
// Usage: node tests/legacy-corpus.cjs /path/to/gerinst-2testordner /tmp/legacy-report.json [path-filter] [regenerated-root]
// Source files remain untouched. Missing files and cases without an independent oracle are explicit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { stripTypeScriptTypes } = require('node:module');

function cents(value) {
  if (typeof value === 'number') return Math.round(value * 100);
  if (typeof value !== 'string' || !value.trim()) return null;
  // Expectations contain both German and English decimal formats; the rightmost
  // separator followed by two digits is the decimal separator in these fixtures.
  const clean = value.trim().replace(/-$/, '');
  const decimal = /([.,])\d{2}$/.exec(clean);
  const normalized = decimal ? clean.slice(0, decimal.index).replace(/[.,\s']/g, '') + '.' + clean.slice(decimal.index + 1)
    : clean.replace(/[.,\s']/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) * (/-$/.test(value) ? -1 : 1) : null;
}
function trusted(r) { return ['advice', 'several'].includes(r.verdict) && r.confidence === 'high' && !r.needsReview; }
function sortedParts(r) {
  return (r.paymentAmounts || []).map(value => {
    const m = /^(.+)\s+([A-Z]{3})$/.exec(value);
    return m ? cents(m[1]) + ':' + m[2] : value;
  }).sort();
}
// An explicit archived non-advice oracle remains authoritative even when an old
// acceptable[] list also tolerated review. The current requirement is untouched.
function expectsOther(oracle) {
  const t = oracle.value;
  if (!t || typeof t !== 'object') return false;
  const kind = t.kind === undefined ? t.verdict : t.kind;
  if (['other', 'non-avis', 'non-advice'].includes(kind)) return true;
  // One archived legacy case specifies only category:"": a failed transfer.
  // Do not reinterpret amount:"", check:true or an explicit unclear verdict.
  return oracle.type === 'legacy-expected' && kind === undefined && t.category === '';
}
const writeFields = ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject'];
function evaluate(oracle, r) {
  const t = oracle.value;
  const out = { source: oracle.source, type: oracle.type, findings: [], observations: [] };
  const fail = detail => out.findings.push(detail);
  const note = detail => out.observations.push(detail);
  out.expectedOther = expectsOther(oracle);
  if (out.expectedOther) {
    if (t.category === 'Avis prüfen' || (Array.isArray(t.acceptable) && t.acceptable.includes('Avis prüfen'))) {
      note('historical review allowance superseded by current untouched-other requirement');
    }
    if (r.verdict !== 'other') fail('non-advice verdict: expected other, got ' + String(r.verdict));
    if (r.needsReview !== false) fail('non-advice routing: expected needsReview=false, got ' + String(r.needsReview));
    for (const key of writeFields) if (r[key] !== '') fail('non-advice mutation: expected empty ' + key);
    // Retain this diagnostic count for historical comparisons, now with findings.
    if (r.needsReview) note('conservative review of expected other mail');
  }
  if (oracle.type === 'truth') {
    const kind = t.kind === 'avis' ? 'advice' : t.kind === 'non-avis' ? 'other' : t.kind;
    if (out.expectedOther) {
      // The strict untouched checks above cover all independent non-advice forms.
    } else if (['advice', 'several', 'unreadable-advice'].includes(kind)) {
      if (r.verdict === 'other' && !r.needsReview) fail('lost-advice: expected advice, got untouched other mail');
      else if (r.needsReview) note('conservative review');
      if (kind === 'unreadable-advice' && trusted(r)) fail('unsafe-confidence: unreadable advice automatically trusted');
      if (trusted(r)) {
        if (kind === 'several') {
          if (Array.isArray(t.amounts) && t.amounts.length) {
            const want = t.amounts.map((a, i) => cents(a) + ':' + ((t.currencies || [])[i] || t.currency || 'EUR')).sort();
            if (JSON.stringify(sortedParts(r)) !== JSON.stringify(want)) fail('wrong-payment-list: expected ' + JSON.stringify(want) + ', got ' + JSON.stringify(sortedParts(r)));
          } else note('no independent amount-list oracle');
        } else if (t.amountNumber != null) {
          if (r.verdict !== 'advice' || cents(r.amountNumber) !== cents(t.amountNumber)) fail('wrong-amount: expected ' + t.amountNumber + ', got ' + r.amountNumber);
          if (t.currency && r.currency !== t.currency) fail('wrong-currency: expected ' + t.currency + ', got ' + r.currency);
        } else note('no independent amount oracle');
      }
    } else note('unmapped truth kind: ' + String(kind));
    return out;
  }
  const want = typeof t === 'string' ? { amount: t } : t;
  if (['advice', 'several', 'unclear'].includes(want.verdict) && r.verdict === 'other' && !r.needsReview) fail('lost-advice: legacy verdict ' + want.verdict + ' became other');
  if ((want.check || (want.maxConfidence && want.maxConfidence !== 'high') || want.confidence === 'low') && trusted(r)) fail('unsafe-confidence: legacy oracle requires checking');
  if (want.amount === '' && want.verdict !== 'several' && trusted(r)) fail('unsafe-confidence: legacy oracle expects no extractable single amount');
  if (want.amount) {
    if (trusted(r) && r.verdict === 'several' && want.verdict !== 'several') fail('wrong-payment-list: expected one amount ' + want.amount + ', got several');
    if (r.ok && cents(r.amountNumber) !== cents(want.amount)) {
      if (trusted(r)) fail('wrong-amount: expected ' + want.amount + ', got ' + r.amount);
      else note('different untrusted amount: expected ' + want.amount + ', got ' + r.amount);
    } else if (!r.ok) note('no single extracted amount, expected ' + want.amount);
  }
  if (want.currency && r.currency !== want.currency) {
    if (trusted(r)) fail('wrong-currency: expected ' + want.currency + ', got ' + r.currency);
    else note('different untrusted currency');
  }
  // Historical exact verdict/confidence/extraction behavior remains visible as a regression observation.
  for (const key of ['verdict', 'confidence']) if (want[key] !== undefined && want[key] !== r[key]) note('legacy ' + key + ': ' + want[key] + ' -> ' + r[key]);
  for (const [key, resultKey] of [['error', 'error'], ['warning', 'warnings']]) {
    if (want[key] !== undefined && !String(r[resultKey] || '').includes(want[key])) note('legacy diagnostic changed: ' + key);
  }
  if (want.notInText && r.text.includes(want.notInText)) fail('excluded text leaked into extraction');
  if (r.needsReview) note('conservative review');
  return out;
}

function validateCurrentBusinessOracles(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.cases)
    || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.decision?.date || '')
    || typeof manifest.decision?.rule !== 'string' || !manifest.decision.rule.trim()) {
    throw Error('Invalid current business oracle manifest');
  }
  const seen = new Set();
  for (const rule of manifest.cases) {
    if (typeof rule.file !== 'string' || !rule.file.startsWith('test/') || rule.file.includes('\\')
      || rule.file.split('/').some(part => !part || part === '.' || part === '..')
      || !/^[a-f0-9]{64}$/.test(rule.sha256 || '') || rule.truth?.kind !== 'other'
      || typeof rule.reason !== 'string' || !rule.reason.trim()
      || typeof rule.independentEvidence !== 'string' || !rule.independentEvidence.trim()) {
      throw Error('Invalid current business oracle: ' + String(rule.file));
    }
    if (seen.has(rule.file)) throw Error('Duplicate current business oracle: ' + rule.file);
    seen.add(rule.file);
  }
  return manifest.cases;
}
function selectCurrentBusinessOracles(entry, inputSha256, rules) {
  const source = 'tests/current-business-oracles.json';
  const matches = rules.filter(rule => rule.file === entry.file);
  const unchanged = { effectiveOracles: entry.oracles, findings: [] };
  if (matches.length === 0) return unchanged;
  if (matches.length !== 1) return {
    ...unchanged, findings: ['ambiguous current business oracle: ' + entry.file],
  };
  const rule = matches[0];
  const currentBusinessOverride = { source, applied: rule.sha256 === inputSha256, rule };
  if (!currentBusinessOverride.applied) return {
    ...unchanged, currentBusinessOverride,
    findings: ['current business oracle file hash mismatch: ' + entry.file
      + '; expected ' + rule.sha256 + ', got ' + String(inputSha256)],
  };
  return {
    currentBusinessOverride, findings: [],
    effectiveOracles: [{ source, type: 'truth', value: rule.truth,
      fileSha256: rule.sha256, evidence: rule.independentEvidence, reason: rule.reason }],
  };
}

function run() {
const source = path.resolve(process.argv[2] || '../gerinst-2testordner');
const reportPath = path.resolve(process.argv[3] || '/tmp/avis-legacy-report.json');
const filter = process.argv[4] || '';
const generatedRoot = process.argv[5] ? path.resolve(process.argv[5]) : '';
const timeoutMs = Number(process.env.AVIS_CASE_TIMEOUT_MS || 110000);
if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) throw Error('Invalid AVIS_CASE_TIMEOUT_MS');
const currentBusinessOraclePath = path.join(__dirname, 'current-business-oracles.json');
const currentBusinessOracleBytes = fs.readFileSync(currentBusinessOraclePath);
const currentBusinessOracleManifest = JSON.parse(currentBusinessOracleBytes);
const currentBusinessRules = validateCurrentBusinessOracles(currentBusinessOracleManifest);
const currentBusinessOracleSha256 = crypto.createHash('sha256').update(currentBusinessOracleBytes).digest('hex');
const testRoot = path.join(source, 'test');
if (!fs.existsSync(path.join(testRoot, 'fixtures/expected.json'))) throw Error('Archived test repository not found: ' + source);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.isFile() ? [p] : [];
  }).sort();
}
const allFiles = walk(testRoot);
const records = new Map();
function add(file, oracle, meta = {}) {
  const abs = path.resolve(file);
  if (!abs.startsWith(testRoot + path.sep)) throw Error('Fixture path escapes test root');
  const key = path.relative(source, abs).split(path.sep).join('/');
  let entry = records.get(key);
  if (!entry) { entry = { file: key, oracles: [], ...meta }; records.set(key, entry); }
  if (oracle) entry.oracles.push(oracle);
  if (meta.subject !== undefined && entry.subject === undefined) entry.subject = meta.subject;
}
for (const f of allFiles.filter(p => /^manifest.*\.json$/.test(path.basename(p)))) {
  const items = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(items)) continue;
  for (const item of items) if (item.file && item.truth) {
    add(path.resolve(path.dirname(f), item.file), { source: path.relative(source, f), type: 'truth', value: item.truth }, { subject: item.mailSubject });
  }
}
const expectedFile = path.join(testRoot, 'fixtures/expected.json');
for (const [name, value] of Object.entries(JSON.parse(fs.readFileSync(expectedFile, 'utf8')))) {
  add(path.join(testRoot, 'fixtures', name), { source: 'test/fixtures/expected.json', type: 'legacy-expected', value },
    { subject: typeof value === 'object' ? value.mailSubject : undefined });
}
// The B/N/X records contain independent expectations; *.live.json and local snapshots do not.
for (const dir of ['bench/burst', 'bench/brainstorm']) {
  for (const f of allFiles.filter(p => path.dirname(p) === path.join(testRoot, dir) && /^[BNX]\d+\.json$/.test(path.basename(p)))) {
    const item = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!item.expect) continue;
    add(f.replace(/\.json$/, '.eml'), { source: path.relative(source, f), type: 'truth', value: {
      kind: item.kind === 'trap' ? 'other' : item.kind === 'edge' && item.expect.category === 'Avis prüfen' ? 'unreadable-advice' : item.kind,
      ...item.expect, amountNumber: item.expect.amount,
      note: item.facts || item.trap || '',
    } }, { subject: item.subject });
  }
}
const liveFile = path.join(testRoot, 'bench/live3/expect.json');
if (fs.existsSync(liveFile)) for (const item of JSON.parse(fs.readFileSync(liveFile, 'utf8'))) {
  add(path.join(path.dirname(liveFile), item.id + '.eml'), item.truth ? {
    source: 'test/bench/live3/expect.json#truth', type: 'truth', value: item.truth,
  } : null, { subject: item.subject });
}
const scanFile = path.join(testRoot, 'bench/scans/cases.json');
if (fs.existsSync(scanFile)) for (const item of JSON.parse(fs.readFileSync(scanFile, 'utf8'))) {
  add(path.join(path.dirname(scanFile), item.file), { source: 'test/bench/scans/cases.json#want', type: 'truth', value: {
    kind: item.want.category === '' ? 'other' : item.want.category === 'Avis prüfen' ? 'unreadable-advice' : 'advice',
    amountNumber: item.want.amount,
  } }, { subject: item.subject });
}
// Independently read document contents fill nine gaps in the archived manifests.
// Every such expectation is tied to the exact archived file bytes.
const audited = JSON.parse(fs.readFileSync(path.join(__dirname, 'legacy-manual-oracles.json'), 'utf8'));
for (const item of audited) add(path.join(source, item.file), {
  source: 'tests/legacy-manual-oracles.json', type: 'truth', value: item.truth,
  fileSha256: item.sha256, evidence: item.evidence, auditMethod: item.auditMethod,
});
// Include every physical EML, even if no independent expectation accompanied it.
for (const file of allFiles.filter(f => /\.eml$/i.test(f))) add(file, null);

function mailboxFor(entry) {
  if (entry.file === 'test/bench/brainstorm/N16.eml') return { value: 'debitoren@nordwerk.example', basis: 'N16.json facts explicitly name the BCC recipient' };
  if (entry.file.startsWith('test/blind/')) return { value: 'debitoren@nordwerk.example', basis: 'fixed synthetic owner in archived blind generators' };
  if (/^test\/bench\/mailF(?:E)?\//.test(entry.file)) return { value: 'zahlungseingang@nordwerk.example.com', basis: 'fixed synthetic owner in archived mailF/mailFE generators' };
  return { value: undefined, basis: 'legacy-compatible call; no independently fixed receiving mailbox for this group' };
}
// Compile and fingerprint the exact same source snapshot, even if other work
// changes the checkout while this long corpus run is in progress.
const parserPath = path.join(__dirname, '../dist/AvisV2.ts');
const parserSource = fs.readFileSync(parserPath, 'utf8');
const parserSha256 = crypto.createHash('sha256').update(parserSource).digest('hex');
const parserCommit = revision(path.join(__dirname, '..'));
const sourceCommit = revision(source);
const context = vm.createContext({});
vm.runInContext(stripTypeScriptTypes(parserSource), context);
const cache = new Map();
const output = [];
let executed = 0;
const started = performance.now();
for (const entry of [...records.values()].sort((a, b) => a.file.localeCompare(b.file))) {
  if (filter && !entry.file.includes(filter)) continue;
  let abs = path.join(source, entry.file);
  let origin = 'original';
  if (!fs.existsSync(abs) && generatedRoot && fs.existsSync(path.join(generatedRoot, entry.file))) {
    abs = path.join(generatedRoot, entry.file); origin = 'regenerated';
  }
  if (!fs.existsSync(abs)) { output.push({ ...entry, status: 'missing' }); continue; }
  const raw = fs.readFileSync(abs);
  const mailbox = mailboxFor(entry);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const key = hash + ':' + JSON.stringify([entry.subject, mailbox.value]);
  const previous = cache.get(key);
  let result, error, elapsedMs;
  if (previous) ({ result, error, elapsedMs } = previous);
  else {
    context.legacyInput = entry.file.endsWith('.input.txt') ? raw.toString('utf8') : raw.toString('base64');
    context.legacySubject = entry.subject;
    context.legacyMailbox = mailbox.value;
    const before = performance.now();
    if (raw.length > 250000) console.log('Running large input: ' + entry.file + ' (' + raw.length + ' bytes)');
    try { result = vm.runInContext("main({}, legacyInput, '', legacySubject, legacyMailbox)", context, { timeout: timeoutMs }); }
    catch (e) { error = String(e); }
    elapsedMs = Math.round((performance.now() - before) * 10) / 10;
    cache.set(key, { result, error, elapsedMs });
    executed++;
    if (executed % 100 === 0) console.log('Executed ' + executed + ' unique inputs; last ' + entry.file);
  }
  const record = { ...entry, status: error ? 'execution-error' : entry.oracles.length ? 'evaluated' : 'no-oracle',
    sha256: hash, bytes: raw.length, origin, mailbox, elapsedMs, duplicateOf: previous ? previous.firstFile : undefined };
  cache.get(key).firstFile ||= entry.file;
  const selection = selectCurrentBusinessOracles(entry, hash, currentBusinessRules);
  record.effectiveOracles = selection.effectiveOracles;
  if (selection.currentBusinessOverride) record.currentBusinessOverride = selection.currentBusinessOverride;
  if (error) { record.error = error; record.findings = [...selection.findings, error]; output.push(record); continue; }
  record.result = Object.fromEntries(['verdict', 'confidence', 'needsReview', 'amount', 'amountNumber', 'currency', 'paymentAmounts',
    'category', 'subjectPrefix', 'newSubject', 'patchSubject', 'patchCategory', 'verdictWhy', 'error', 'warnings', 'documents'].map(k => [k, result[k]]));
  record.findings = [...selection.findings];
  if (selection.currentBusinessOverride?.applied) {
    record.supersededEvaluations = entry.oracles.map(o => evaluate(o, result));
    record.historicalFindings = record.supersededEvaluations.flatMap(e => e.findings);
  }
  for (const oracle of selection.effectiveOracles) if (oracle.fileSha256 && oracle.fileSha256 !== hash) {
    record.findings.push('audited oracle file hash mismatch: ' + oracle.source);
  }
  if (result.needsReview) for (const k of ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject']) {
    if (result[k]) record.findings.push('review invariant violated: nonempty ' + k);
  }
  if (result.category && (!trusted(result) || result.category !== 'Avis')) record.findings.push('automatic-category invariant violated');
  if (result.patchSubject && !trusted(result)) record.findings.push('automatic-subject invariant violated');
  record.evaluations = selection.effectiveOracles.map(o => evaluate(o, result));
  for (const e of record.evaluations) record.findings.push(...e.findings);
  output.push(record);
}
function revision(dir) { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } }
const count = pred => output.filter(pred).length;
const summary = {
  records: output.length, existing: count(x => x.status !== 'missing'),
  uniqueExecutions: executed, missing: count(x => x.status === 'missing'), empty: count(x => x.bytes === 0), regenerated: count(x => x.origin === 'regenerated'),
  withOracle: count(x => x.status === 'evaluated'), noOracle: count(x => x.status === 'no-oracle'),
  currentBusinessOverrides: count(x => x.currentBusinessOverride?.applied === true),
  currentBusinessHashMismatches: count(x => x.currentBusinessOverride?.applied === false),
  historicalFindingCases: count(x => x.historicalFindings?.length),
  historicalFindings: output.reduce((sum, x) => sum + (x.historicalFindings?.length || 0), 0),
  executionErrors: count(x => x.status === 'execution-error'), findingCases: count(x => x.findings?.length),
  conservativeReview: count(x => x.evaluations?.some(e => e.observations.some(n => n.startsWith('conservative review')))),
  expectedOtherCases: count(x => x.evaluations?.some(e => e.expectedOther)),
  expectedOtherReviewed: count(x => x.evaluations?.some(e => e.expectedOther) && x.result?.needsReview === true),
  expectedOtherUntouched: count(x => x.evaluations?.some(e => e.expectedOther) && x.result?.verdict === 'other' && x.result?.needsReview === false && writeFields.every(k => x.result[k] === '')),
  legacyBehaviorDifferences: count(x => x.evaluations?.some(e => e.observations.some(n => n.startsWith('legacy ') || n.startsWith('different untrusted') || n.startsWith('no single extracted amount')))),
  originalFindingCases: count(x => x.origin === 'original' && x.findings?.length),
  regeneratedFindingCases: count(x => x.origin === 'regenerated' && x.findings?.length),
  distinctInputHashes: new Set(output.map(x => x.sha256).filter(Boolean)).size,
  elapsedSeconds: Math.round((performance.now() - started) / 100) / 10,
};
const report = { sourceRepository: 'Gerinst/2testordner', sourceCommit, parserCommit, parserSha256,
  timeoutMs, generatedRoot: generatedRoot || undefined,
  currentBusinessOracleSha256, currentBusinessOracleManifest,
  scope: 'Local current-parser execution only; no archived JS executed, no external mail or Microsoft 365 calls. Explicit non-advice oracles require untouched other; historical advice UI expectations are not asserted.',
  summary, records: output };
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
for (const r of output.filter(x => x.findings?.length)) console.log('FINDING ' + r.file + ': ' + r.findings.join('; '));
console.log('Full report: ' + reportPath);
process.exitCode = summary.findingCases ? 1 : 0;
}

module.exports = { evaluate, expectsOther, validateCurrentBusinessOracles, selectCurrentBusinessOracles };
if (require.main === module) run();
