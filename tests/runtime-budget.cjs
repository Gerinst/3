const assert = require("node:assert/strict");
const vm = require("node:vm");
const zlib = require("node:zlib");
const { load, eml, fixtures, pdf, textAdvice } = require("./fixtures.cjs");

const ctx = load();
vm.runInContext("var realNow = Date.now;", ctx);
let tests = 0;
function run(code) {
  return vm.runInContext(code, ctx, { timeout: 1000 });
}
function check(name, fn) {
  run("Date.now = realNow; runDeadline = 0; totalDecoded = 0;");
  try {
    fn();
    tests++;
  } catch (e) {
    e.message = name + ": " + e.message;
    throw e;
  }
}
function lzwLiteralStream(data) {
  const codes = [];
  for (const byte of data) codes.push(256, byte);
  codes.push(257);
  let acc = 0, bits = 0;
  const out = [];
  for (const code of codes) {
    acc = (acc << 9) | code;
    bits += 9;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >>> bits) & 255);
    }
  }
  if (bits) out.push((acc << (8 - bits)) & 255);
  return new Uint8Array(out);
}
const bytes = (value) => Array.from(value);
const sample = Buffer.from("Zahlungsavis 1.200,30 EUR\n".repeat(200));
ctx.zipped = new Uint8Array(zlib.deflateSync(sample));
ctx.raw = new Uint8Array(zlib.deflateRawSync(sample));
ctx.stored = new Uint8Array(zlib.deflateRawSync(sample, { level: 0 }));
ctx.literalLzw = lzwLiteralStream(Buffer.from("ABABABA"));
for (const expression of ["inflate(zipped)", "inflateRaw(raw, 0)", "inflateRaw(stored, 0)"]) {
  check("valid " + expression, () => {
    const result = run(expression);
    assert.equal(result.complete, true);
    assert.deepEqual(bytes(result.data), bytes(sample));
  });
}
check("valid LZW", () => {
  const result = run("lzwDecode(literalLzw, 1)");
  assert.equal(result.complete, true);
  assert.deepEqual(bytes(result.data), bytes(Buffer.from("ABABABA")));
});
check("valid ASCIIHex", () => assert.deepEqual(bytes(run("asciiHexDecode(new Uint8Array([52,49,52,50,52,51,62]))")), [65, 66, 67]));
check("valid ASCII85", () => assert.deepEqual(bytes(run("ascii85Decode(latin1ToBytes('<~87cURD]j7BEbo80~>'))")), bytes(Buffer.from("Hello world!"))));
check("valid RunLength", () => assert.deepEqual(bytes(run("runLengthDecode(new Uint8Array([2,65,66,67,254,90,128]))")), [65, 66, 67, 90, 90, 90]));
check("valid Base64", () => assert.deepEqual(bytes(run("decodeBase64Range('QUJD',0,4)")), [65, 66, 67]));
check("valid quoted-printable", () => assert.deepEqual(bytes(run("decodeQuotedPrintable('A=42=43',0,7)")), [65, 66, 67]));
for (const [label, expression, expected] of [
  ["TIFF", "applyPredictor(new Uint8Array([10,10,10]),2,1,8,3)", [10,20,30]],
  ["PNG None", "applyPredictor(new Uint8Array([0,10,20,30]),10,1,8,3)", [10,20,30]],
  ["PNG Sub", "applyPredictor(new Uint8Array([1,10,10,10]),11,1,8,3)", [10,20,30]],
  ["PNG Up", "applyPredictor(new Uint8Array([0,10,20,30,2,1,2,3]),12,1,8,3)", [10,20,30,11,22,33]],
  ["PNG Average", "applyPredictor(new Uint8Array([3,10,15,20]),13,1,8,3)", [10,20,30]],
  ["PNG Paeth", "applyPredictor(new Uint8Array([4,10,10,10]),14,1,8,3)", [10,20,30]],
]) check(label, () => assert.deepEqual(bytes(run(expression)), expected));

for (const parameters of ["1,8,0", "0,8,1", "1,0,1", "1,8,-1", "1,8,0.5", "1,8,NaN", "1,8,Infinity", "1,8,67108865"]) {
  check("invalid predictor " + parameters, () => {
    assert.throws(() => run("applyPredictor(new Uint8Array([1,2]),2," + parameters + ")"), /invalid PDF predictor/);
  });
}

const smallCalls = [
  "inflate(zipped)", "inflateRaw(raw,0)", "lzwDecode(literalLzw,1)",
  "asciiHexDecode(new Uint8Array([52,49]))", "ascii85Decode(new Uint8Array([122]))",
  "runLengthDecode(new Uint8Array([0,65,128]))", "applyPredictor(new Uint8Array([1,2]),2,1,8,1)",
  "decodeBase64Range('QUJD',0,4)", "decodeQuotedPrintable('ABC',0,3)",
];
for (const expression of smallCalls) {
  check("expired budget " + expression, () => {
    run("runDeadline = 1; Date.now = function () { return 2; };");
    assert.throws(() => run(expression), /time budget exhausted/);
  });
}

ctx.longStored = new Uint8Array(zlib.deflateRawSync(Buffer.alloc(8192,65), { level: 0 }));
ctx.longDeflated = new Uint8Array(zlib.deflateRawSync(Buffer.alloc(2 * 1024 * 1024,65)));
ctx.emptyBlocks = new Uint8Array(Array.from({length:5000}, () => [0,0,0,255,255]).flat().concat([1,0,0,255,255]));
ctx.longLzw = lzwLiteralStream(Buffer.alloc(5000,65));
ctx.longRuns = new Uint8Array(Array.from({length:5000}, () => [255,65]).flat().concat(128));
for (const [label, expression] of [
  ["Deflate stored block", "inflateRaw(longStored,0)"],
  ["Deflate compressed symbols", "inflateRaw(longDeflated,0)"],
  ["Deflate empty blocks", "inflateRaw(emptyBlocks,0)"],
  ["LZW codes", "lzwDecode(longLzw,1)"],
  ["ASCIIHex bytes", "asciiHexDecode(latin1ToBytes('41'.repeat(5000)))"],
  ["ASCII85 bytes", "ascii85Decode(latin1ToBytes('z'.repeat(5000)))"],
  ["RunLength runs", "runLengthDecode(longRuns)"],
  ["Base64 bytes", "decodeBase64Range('QUJD'.repeat(2000),0,8000)"],
  ["quoted-printable tokens", "decodeQuotedPrintable('ABC'.repeat(2000),0,6000)"],
  ["quoted-printable whitespace", "decodeQuotedPrintable('='.padEnd(8192,' '),0,8192)"],
  ["TIFF short rows", "applyPredictor(new Uint8Array(8192),2,1,8,1)"],
  ["TIFF wide row", "applyPredictor(new Uint8Array(8192),2,1,8,8192)"],
  ["PNG short rows", "applyPredictor(new Uint8Array(10000),10,1,8,1)"],
  ["PNG wide row", "applyPredictor(new Uint8Array(8193),10,1,8,8192)"],
]) {
  check("budget expires during " + label, () => {
    run("runDeadline = 1; var clockCalls = 0; Date.now = function () { return ++clockCalls === 1 ? 0 : 2; };");
    assert.throws(() => run(expression), /time budget exhausted/);
    assert(run("clockCalls") >= 2);
  });
}

function review(result) {
  assert.equal(result.needsReview, true);
  for (const field of ["category", "patchCategory", "subjectPrefix", "newSubject", "patchSubject"]) assert.equal(result[field], "", field);
}
check("invalid predictor in main stays a review case", () => {
  const original = pdf(textAdvice("1.200,30"));
  const malformed = original.replace(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/, (_, length, stream) => {
    const encoded = zlib.deflateSync(Buffer.from(stream)).toString("hex");
    return `<< /Length ${encoded.length+1} /Filter [/ASCIIHexDecode /FlateDecode] /DecodeParms [null << /Predictor 2 /Colors 1 /BitsPerComponent 8 /Columns 0 >>] >>\nstream\n${encoded}>\nendstream`;
  });
  ctx.badPdf = Buffer.from(malformed).toString("base64");
  const result = run("main({},badPdf,'','Abrechnung Oktober')");
  review(result);
  assert.match(result.warnings + result.error, /invalid PDF predictor/);
});
check("budget expires while main decodes input", () => {
  ctx.input = Buffer.from(pdf(textAdvice("1.200,30"))).toString("base64");
  run("var mainClockCalls = 0; Date.now = function () { return ++mainClockCalls === 1 ? 0 : 90001; };");
  const result = run("main({},input,'','Abrechnung Oktober')");
  review(result);
  assert.match(result.error, /time budget exhausted/);
});

ctx.lines = textAdvice("1.200,30").split("\n");
check("expired budget rejects amount parsing immediately", () => {
  run("runDeadline = 100; Date.now = () => 101;");
  assert.throws(() => run("pickAmount(lines, '')"), /time budget exhausted/);
});
check("amount parsing detects expiration during analysis", () => {
  run("var parserCalls = 0; runDeadline = 100; Date.now = () => ++parserCalls < 4 ? 0 : 101;");
  assert.throws(() => run("pickAmount(lines, '')"), /time budget exhausted/);
});
check("long amount lists check the budget within a parsing phase", () => {
  ctx.longLines = Array.from({ length: 2000 }, (_, i) => `RE${10000 + i} 123,45 EUR`);
  run("var listCalls = 0; runDeadline = 100; Date.now = () => ++listCalls < 3 ? 0 : 101;");
  assert.throws(() => run("pickAmount(longLines, '')"), /time budget exhausted/);
});
check("deduction search checks between payment candidates", () => {
  run(`
    const label = { strong: false, payment: true, ded: false, neg: false };
    const totalsLabel = { strong: true, payment: false, ded: false, neg: false };
    const deductionLabel = { strong: false, payment: false, ded: true, neg: false };
    const candidates = [
      { value: 1000, lineIdx: 0, label: totalsLabel, col: "", method: "keyword" },
      { value: 1, lineIdx: 1, label: deductionLabel, col: "", method: "keyword" },
      { value: 20, lineIdx: 2, label, col: "", method: "keyword" },
      { value: 30, lineIdx: 3, label, col: "", method: "keyword" },
    ];
    const infos = candidates.map(() => ({ pcts: [] }));
    const candidatesAt = candidates.map(c => [c]);
    var deductionCalls = 0;
    runDeadline = 100;
    Date.now = () => ++deductionCalls < 4 ? 0 : 101;
  `);
  assert.throws(() => run("deductionChain(candidates, infos, candidatesAt, [])"), /time budget exhausted/);
});
for (const verdict of ["advice", "several"]) {
  check(`final guard prevents expired ${verdict} updates`, () => {
    ctx.verdictUnderTest = verdict;
    const result = run(`
      runDeadline = 100;
      Date.now = () => 101;
      var finished = emptyResult();
      Object.assign(finished, {
        verdict: verdictUnderTest, confidence: "high", ok: true,
        amountNumber: 1200.3, currency: "EUR",
        paymentAmounts: ["1.200,30 EUR", "5.632,21 EUR"],
      });
      finishResult(finished, "Abrechnung", "Wichtig");
    `);
    review(result);
    assert.equal(result.verdict, "unclear");
    assert.equal(result.confidence, "low");
    assert.match(result.error, /time budget exhausted/);
  });
}
check("expired budget leaves an already unrelated mail alone", () => {
  const result = run(`
    runDeadline = 100;
    Date.now = () => 101;
    const unrelated = emptyResult();
    unrelated.verdict = "other";
    finishResult(unrelated, "Termin", "Wichtig");
  `);
  assert.equal(result.verdict, "other");
  assert.equal(result.needsReview, false);
  assert.equal(result.patchSubject, "");
  assert.equal(result.patchCategory, "");
});
check("normal complete multiple advice remains trusted", () => {
  ctx.message = eml(fixtures.pdfParts);
  const result = run("main({}, message)");
  assert.equal(result.verdict, "several");
  assert.equal(result.confidence, "high");
  assert.equal(result.needsReview, false);
  assert.equal(result.category, "Avis");
});

console.log(`PASS: ${tests} runtime-budget checks`);
