const assert = require('node:assert/strict');
const vm = require('node:vm');
const { load, pdf, textAdvice } = require('./fixtures.cjs');

// Complement runtime-budget.cjs: PDF syntax, CMaps, object streams, fonts,
// recursive appearances and ZIP metadata. Each parser invocation is bounded.
const ctx = load();
vm.runInContext('var safetyRealNow = Date.now;', ctx);
const failures = [];
let checks = 0;
function run(code) { return vm.runInContext(code, ctx, { timeout: 1000 }); }
function check(name, fn) {
  run('Date.now = safetyRealNow; runDeadline = Date.now() + 90000; totalDecoded = 0;');
  try { fn(); checks++; } catch (error) { failures.push(name + ': ' + error.message); }
}
function noAutomatic(result) {
  assert.notEqual(result.confidence, 'high', 'incomplete data cannot remain trusted');
  assert.equal(result.needsReview, true);
  for (const key of ['category', 'patchCategory', 'subjectPrefix', 'newSubject', 'patchSubject']) {
    assert.equal(result[key], '', key);
  }
}
function main(text) {
  ctx.safetyInput = Buffer.from(text, 'latin1').toString('base64');
  return run("main({}, safetyInput, '', 'Unterlagen')");
}
function stream(text, extra = '') {
  return `<< /Length ${Buffer.byteLength(text, 'latin1')} ${extra} >>\nstream\n${text}\nendstream`;
}
function content(text) { return pdf(text).match(/stream\n([\s\S]*?)\nendstream/)[1]; }
function document(objects, compressed = null) {
  let out = '%PDF-1.5\n';
  const offsets = new Map();
  for (const [id, body] of objects) {
    offsets.set(id, Buffer.byteLength(out, 'latin1'));
    out += `${id} 0 obj\n${body}\nendobj\n`;
  }
  const xrefId = Math.max(...objects.keys()) + 1;
  const xrefAt = Buffer.byteLength(out, 'latin1');
  offsets.set(xrefId, xrefAt);
  const entries = Buffer.alloc((xrefId + 1) * 7);
  for (let id = 0; id <= xrefId; id++) {
    const p = id * 7;
    if (compressed && id === compressed.id) {
      entries[p] = 2; entries.writeUInt32BE(compressed.stream, p + 1);
    } else if (offsets.has(id)) {
      entries[p] = 1; entries.writeUInt32BE(offsets.get(id), p + 1);
    } else entries.writeUInt16BE(65535, p + 5);
  }
  out += `${xrefId} 0 obj\n${stream(entries.toString('hex') + '>', `/Type /XRef /Size ${xrefId + 1} /Root 1 0 R /W [1 4 2] /Filter /ASCIIHexDecode`)}\nendobj\n`;
  return out + `startxref\n${xrefAt}\n%%EOF\n`;
}
const resources = '/Resources << /Font << /F1 4 0 R >> >>';
function base(extraPage = '', extraFont = '') {
  return new Map([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Count 1 /Kids [3 0 R] >>'],
    [3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${resources} /Contents 5 0 R ${extraPage} >>`],
    [4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica ${extraFont} >>`],
    [5, stream(content(textAdvice('1.200,30')))],
  ]);
}
function objectStream(first = 4, n = 1, header = '6 0 ') {
  const objects = base();
  objects.set(2, '<< /Type /Pages /Count 2 /Kids [3 0 R 6 0 R] >>');
  const page = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${resources} /Contents 7 0 R >>`;
  objects.set(7, stream(content(textAdvice('700,17'))));
  objects.set(8, stream(header + page, `/Type /ObjStm /N ${n} /First ${first}`));
  return document(objects, { id: 6, stream: 8 });
}
function withCmap(cmap) {
  const objects = base('', '/ToUnicode 6 0 R');
  objects.set(6, stream(cmap));
  return document(objects);
}
const identityCmap = '1 begincodespacerange <00> <ff> endcodespacerange\n1 beginbfrange <00> <ff> <0000> endbfrange';
function trueType(format, groups = 1) {
  const subLength = format === 12 ? 16 + groups * 12 : 16 + groups * 8;
  const b = Buffer.alloc(40 + subLength);
  b.writeUInt32BE(0x10000, 0); b.writeUInt16BE(1, 4);
  b.write('cmap', 12); b.writeUInt32BE(28, 20); b.writeUInt32BE(b.length - 28, 24);
  b.writeUInt16BE(1, 30); b.writeUInt16BE(3, 32); b.writeUInt16BE(format === 12 ? 10 : 1, 34); b.writeUInt32BE(12, 36);
  const s = 40; b.writeUInt16BE(format, s);
  if (format === 12) {
    b.writeUInt32BE(subLength, s + 4); b.writeUInt32BE(groups, s + 12);
    for (let i = 0; i < groups; i++) {
      b.writeUInt32BE(i * 65536, s + 16 + i * 12);
      b.writeUInt32BE(i * 65536 + (groups === 1 ? 2 : 65535), s + 20 + i * 12);
      b.writeUInt32BE(i * 65536 + 1, s + 24 + i * 12);
    }
  } else {
    b.writeUInt16BE(subLength, s + 2); b.writeUInt16BE(groups * 2, s + 6);
    for (let i = 0; i < groups; i++) {
      b.writeUInt16BE(groups === 1 ? 67 : 65534, s + 14 + i * 2);
      b.writeUInt16BE(groups === 1 ? 65 : 0, s + 16 + groups * 2 + i * 2);
      b.writeUInt16BE(1, s + 16 + groups * 4 + i * 2);
    }
  }
  return new Uint8Array(b);
}
function zipMetadata(count, central = false) {
  const pieces = [], directory = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const name = Buffer.from(`file${i}.txt`), header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(name.length, 26);
    pieces.push(header, name);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
    record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    directory.push(record, name);
    offset += header.length + name.length;
  }
  if (central) {
    const end = Buffer.alloc(22), records = Buffer.concat(directory);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
    end.writeUInt32LE(records.length, 12); end.writeUInt32LE(offset, 16);
    pieces.push(records, end);
  }
  return new Uint8Array(Buffer.concat(pieces));
}

// Valid controls must pass before a malformed variant can be meaningful.
check('valid PDF with complete ToUnicode', () => {
  const result = main(withCmap(identityCmap));
  assert.equal(result.confidence, 'high'); assert.equal(result.amountNumber, 1200.3);
});
check('valid compressed page object', () => {
  ctx.safetyBytes = new Uint8Array(Buffer.from(objectStream(), 'latin1'));
  const result = run('extractPdf(safetyBytes)');
  assert.equal(result.pages, 2);
  assert.deepEqual(Array.from(result.incomplete), []);
  assert(result.lines.some(line => line.includes('1.200,30')));
  assert(result.lines.some(line => line.includes('700,17')));
});
check('CMap Unicode ligatures and CID ranges', () => {
  assert.equal(run("cmapLookup(parseCMap('1 beginbfrange <01> <02> <00660069> endbfrange','uni'),2)"), 'fj');
  assert.equal(run("cmapLookupCid(parseCMap('1 begincidrange <01> <03> 10 endcidrange','cid'),3)"), 12);
});
for (const format of [4, 12]) check('valid TrueType cmap ' + format, () => {
  ctx.safetyFont = trueType(format);
  const result = run('parseTrueTypeCmap(safetyFont)');
  assert.equal(result.hasUni, true);
  assert.equal(result.gidToUni.get(format === 4 ? 66 : 1), format === 4 ? 65 : 0);
});
check('valid annotation appearance', () => {
  const objects = base('/Annots [6 0 R]');
  objects.set(5, stream(''));
  objects.set(6, '<< /Type /Annot /Subtype /Stamp /Rect [0 0 612 792] /AP << /N 7 0 R >> >>');
  objects.set(7, stream(content(textAdvice('1.200,30')), `/Type /XObject /Subtype /Form /BBox [0 0 612 792] ${resources}`));
  const result = main(document(objects));
  assert.equal(result.confidence, 'high'); assert.equal(result.amountNumber, 1200.3);
});
ctx.safetyZip = zipMetadata(3000);
ctx.safetyCentral = zipMetadata(3000, true);
check('valid ZIP local metadata fallback', () => assert.equal(run('shZipEntries(safetyZip).length'), 3000));
check('valid ZIP central directory', () => assert.equal(run('shZipEntries(safetyCentral).length'), 3000));

for (const [name, expression] of [
  ['CMap', "parseCMap('1 beginbfchar <41> <0041> endbfchar','uni')"],
  ['TrueType', 'parseTrueTypeCmap(safetyFont)'],
  ['literal string', "new Lexer('(ABC)',0).parse(0)"],
  ['hex string', "new Lexer('<414243>',0).parse(0)"],
  ['ZIP metadata', 'shZipEntries(safetyZip)'],
  ['ZIP central entries', 'shZipEntries(safetyCentral)'],
  ['font width range', 'new FontLoader(new PdfDoc(\'\')).parseW([0,65535,500],new Map())'],
]) check('expired budget before ' + name, () => {
  run('runDeadline=1; Date.now=()=>2;');
  assert.throws(() => run(expression), /time budget exhausted/);
});
for (const [name, expression, setupCalls = 1] of [
  ['CMap token stream', "parseCMap('1 beginbfchar <41> <0041> endbfchar '.repeat(5000),'uni')", 2],
  ['CMap ligature expansion', "parseCMap('1 beginbfrange <0000> <ffff> <00660069> endbfrange','uni')", 2],
  ['literal string', "new Lexer('('+ 'A'.repeat(50000)+')',0).parse(0)"],
  ['octal-escaped literal string', "new Lexer('('+ '\\\\123'.repeat(50000)+')',0).parse(0)"],
  ['hex string', "new Lexer('<'+ '41'.repeat(50000)+'>',0).parse(0)"],
  ['name escapes', "new Lexer('/'+ '#41'.repeat(50000),0).parse(0)"],
  ['ZIP metadata', 'shZipEntries(safetyZip)'],
  ['font width range', 'new FontLoader(new PdfDoc(\'\')).parseW([0,65535,500],new Map())', 2],
  ['ZIP central entries', 'shZipEntries(safetyCentral)'],
]) check('budget expires during ' + name, () => {
  run('runDeadline=1; var safetyCalls=0; Date.now=()=>++safetyCalls <= ' + setupCalls + ' ? 0 : 2;');
  assert.throws(() => run(expression), /time budget exhausted/);
  assert(run('safetyCalls') >= 2);
});
check('budget expires while expanding cached object-stream entries', () => {
  const header = Array.from({ length: 3000 }, (_, i) => `${100 + i} ${i * 3} `).join('');
  ctx.safetyObjects = document(new Map([[1, stream(header + '42 '.repeat(3000),
    `/Type /ObjStm /N 3000 /First ${header.length}`)]]));
  run(`var safetyObjectDoc = new PdfDoc(safetyObjects); safetyObjectDoc.scan();
    safetyObjectDoc.streamData(safetyObjectDoc.objs.get(1).obj);
    runDeadline=1; Date.now=()=>safetyObjectDoc.objs.has(100) ? 2 : 0;`);
  assert.throws(() => run('safetyObjectDoc.expandObjectStreams()'), /time budget exhausted/);
  assert.equal(run('safetyObjectDoc.objs.has(100)'), true);
  assert.equal(run('safetyObjectDoc.objs.has(101)'), false);
});
check('valid null object inside an object stream', () => {
  const objects = base();
  objects.set(7, stream('6 0 null', '/Type /ObjStm /N 1 /First 4'));
  const result = main(document(objects, { id: 6, stream: 7 }));
  assert.equal(result.confidence, 'high'); assert.equal(result.amountNumber, 1200.3);
});
for (const format of [4, 12]) check('budget expires during TrueType expansion ' + format, () => {
  ctx.safetyFont = trueType(format, 4);
  run('runDeadline=1; var safetyCalls=0; Date.now=()=>++safetyCalls <= 2 ? 0 : 2;');
  assert.throws(() => run('parseTrueTypeCmap(safetyFont)'), /time budget exhausted/);
});
check('budget expires during annotation scan without appearances', () => {
  run(`var safetyDoc = new PdfDoc(''); var safetyInterpreter = new ContentInterpreter(safetyDoc);
    var safetyPage=mkDict(), safetyAnn=mkDict(); safetyAnn.m.set('Subtype',mkName('Link'));
    safetyPage.m.set('Annots',{t:'arr',v:Array(10000).fill(safetyAnn)});
    runDeadline=1; var safetyCalls=0; Date.now=()=>++safetyCalls === 1 ? 0 : 2;`);
  assert.throws(() => run('safetyInterpreter.runAnnotations(safetyPage,null,0)'), /time budget exhausted/);
});

for (const [name, text] of [
  ['wrong object-stream start', objectStream(400000)],
  ['negative object-stream start', objectStream(-4)],
  ['truncated object-stream header', objectStream(4, 2)],
  ['negative object-stream offset', objectStream(5, 1, '6 -1 ')],
  ['incomplete CMap array', withCmap(identityCmap + '\n[')],
  ['incomplete CMap array ending in null', withCmap(identityCmap + '\n[null')],
  ['incomplete CMap dictionary ending in null', withCmap(identityCmap + '\n<< /Value null')],
  ['CMap character map missing destination', withCmap(identityCmap + '\n1 beginbfchar <31>')],
  ['CMap character map missing end marker', withCmap(identityCmap + '\n1 beginbfchar <31> <0039>')],
  ['CMap range missing destination', withCmap(identityCmap + '\n1 beginbfrange <30> <39>')],
  ['CMap codespace missing upper bound', withCmap(identityCmap + '\n1 begincodespacerange <30>')],
  ['overdeep CMap object', withCmap(identityCmap + '\n' + '['.repeat(305))],
]) check(name + ' never authorizes a partial amount', () => noAutomatic(main(text)));
check('cyclic form appearance never authorizes a partial amount', () => {
  const objects = base();
  objects.set(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /XObject << /Fm 6 0 R >> >> /Contents 5 0 R >>`);
  objects.set(5, stream(content(textAdvice('1.200,30')) + '\n/Fm Do'));
  objects.set(6, stream('/Fm Do', '/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /XObject << /Fm 6 0 R >> >>'));
  noAutomatic(main(document(objects)));
});
check('cyclic page tree never authorizes a partial amount', () => {
  const objects = base();
  objects.set(2, '<< /Type /Pages /Count 2 /Kids [3 0 R 2 0 R] >>');
  noAutomatic(main(document(objects)));
});
check('many stray delimiters are skipped without call-stack recursion', () => {
  assert.equal(run("new Lexer('}]>)'.repeat(20000)+' 42',0).parse(0)"), 42);
});
check('unrepresentable CID width range is rejected without looping', () => {
  assert.throws(() => run("new FontLoader(new PdfDoc('')).parseW([1e100,1e100,500],new Map())"), /invalid.*(?:CID|width)/i);
});

// Deterministic truncations remove the EOF marker, so completeness is never
// inferred from whatever earlier amount happens to remain readable.
const valid = [withCmap(identityCmap), objectStream(), document(base())];
for (const [index, text] of valid.entries()) {
  for (const fraction of [0.1, 0.4, 0.8, 0.99]) {
    check(`truncated PDF ${index} at ${fraction}`, () => {
      noAutomatic(main(text.slice(0, Math.floor(text.length * fraction))));
    });
  }
}
// Non-structural whitespace mutations must retain the same, exact amount.
for (let seed = 1; seed <= 12; seed++) check('bounded syntax mutation ' + seed, () => {
  const objects = base();
  objects.set(4, `<<%${'font comment '.repeat(seed)}\r\n/Type${' '.repeat(seed)} /Font\n/Subtype /Type1\r/BaseFont /Helvetica >>`);
  const text = document(objects);
  const result = main(text);
  if (result.category) assert.equal(result.amountNumber, 1200.3);
  else assert.equal(result.needsReview, true);
});

if (failures.length) {
  console.error(failures.join('\n'));
  throw Error(`${failures.length} safety-runtime failures; ${checks} passed`);
}
console.log(`PASS: ${checks} safety-runtime checks (1 s VM limit per invocation)`);
