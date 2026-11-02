#!/usr/bin/env node
/*
 * osemu.js - emulator of the Office Scripts sync->async conversion.
 *
 * Usage:
 *   node osemu.js <file.ts> --model <M> [--emit await|paren|es5|es5s|all] [--run] [--patch]
 *                 [--only <substr>] [--fixtures <dir>] [--dump <out.js>] [--first-only] [--no-array-helper]
 *                 [--json <report.json>] [--quiet]
 *   node osemu.js --calibrate [--old <old.ts>] [--cand <candidate.ts>] [--also <more.ts>]...
 *   node osemu.js --list-models
 *
 * What it does:
 *   1. builds a TypeScript Program (TS from $OSEMU_TS, default the read-only copy below) for
 *      <file.ts> + stub.d.ts (ExcelScript/console ambient declarations),
 *   2. decides with the type checker which functions become async and which calls get "await"
 *      according to the chosen model,
 *   3. applies that as a TS "before" transformer and emits JS (target ES2019, or ES5 for --emit es5
 *      which turns every await into "yield" like TS downlevelling does),
 *   4. parses the result with V8 (vm.Script) and reports the first syntax error, then iterates
 *      (suppressing the matched await) to list every syntax error, each mapped back to the
 *      original TS line through the emitted source map,
 *   5. with --run, executes all fixtures against the converted async main().
 *      --patch removes the awaits that cause syntax errors so the semantics can still be tested.
 *
 * Emit formats (how the runtime is assumed to print an inserted await):
 *   await : plain "await x"    (V8: "await is only valid in async functions ..." for x;-statements)
 *   paren : "(await x)"        (V8: "Unexpected token 'this'" / "Unexpected identifier 'x'")
 *   es5   : TS target ES5, sloppy ("yield x" -> "Unexpected token 'this'" / "Unexpected identifier 'x'")
 *   es5s  : TS target ES5 + "use strict" ("yield x" -> "Unexpected strict mode reserved word")
 */
// Adapted from Gerinst/2testordner b9ada7d60cdb2ce76dfc06a90834cecce23ab422, test/tools/osemu.js.
// Changes: portable local defaults and fullResult reporting; transformation behavior is unchanged.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TS_PATH = process.env.OSEMU_TS || 'typescript';
const ts = require(TS_PATH);
const HERE = __dirname;
const STUB = path.join(HERE, 'stub.d.ts');
const DEFAULT_FIXTURES = path.join(__dirname, '..', 'fixtures');
const DEFAULT_OLD = path.resolve(HERE, '../../../gerinst-2testordner/dist/AvisV2.ts');
const DEFAULT_CAND = path.resolve(HERE, '../../dist/AvisV2.ts');

// ---------------------------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------------------------
// baseFns/baseMethods: every function declaration / class method is async from the start.
// colored: function declarations / methods become async only if they contain an awaited call.
// awaitAll: every call expression (incl. builtins like Math.min, Date.now) gets await.
// bug: 'methods' = class methods with a leading comment do not get the async keyword (#4005);
//      'methods+functions' = additionally non-main function declarations with a leading comment.
// ctorAwait: false = calls inside constructors / field initializers are never awaited.
// Arrow functions / function expressions are async iff they contain an await (all models).
// main() is always async. Calls to ExcelScript APIs and console.* are always awaited.
const MODELS = {
  none: { desc: 'no conversion (plain sync baseline)', none: true },
  M1: { desc: 'all-methods: every function decl + class method async, await every call to an async user fn', baseFns: true, baseMethods: true },
  M2: { desc: 'M1 + bug #4005: commented class methods lose the async keyword (body still awaited)', baseFns: true, baseMethods: true, bug: 'methods' },
  M2f: { desc: 'M2, bug also hits commented non-main function declarations', baseFns: true, baseMethods: true, bug: 'methods+functions' },
  M2c: { desc: 'M2 but constructors/field initializers are never awaited', baseFns: true, baseMethods: true, bug: 'methods', ctorAwait: false },
  M3: { desc: 'colored: only functions that (transitively) call ExcelScript API/console become async', colored: true },
  M3b: { desc: 'M3 + bug #4005', colored: true, bug: 'methods' },
  M4: { desc: 'await-all-calls: all fn decls/methods async, await EVERY call incl. builtins', baseFns: true, baseMethods: true, awaitAll: true },
  M5: { desc: 'class methods always async (+bug #4005), plain functions colored', baseMethods: true, colored: true, bug: 'methods' },
};

const ARRAY_HELPER_METHODS = new Set(['forEach', 'map', 'filter', 'some', 'every', 'find', 'findIndex', 'reduce', 'reduceRight', 'flatMap']);

const HELPER_JS = `
async function __osArr(arr, method, cb, ...rest) {
  const n = arr.length;
  switch (method) {
    case "forEach": for (let i = 0; i < n; i++) await cb(arr[i], i, arr); return undefined;
    case "map": { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = await cb(arr[i], i, arr); return out; }
    case "filter": { const out = []; for (let i = 0; i < n; i++) if (await cb(arr[i], i, arr)) out.push(arr[i]); return out; }
    case "some": for (let i = 0; i < n; i++) if (await cb(arr[i], i, arr)) return true; return false;
    case "every": for (let i = 0; i < n; i++) if (!(await cb(arr[i], i, arr))) return false; return true;
    case "find": for (let i = 0; i < n; i++) if (await cb(arr[i], i, arr)) return arr[i]; return undefined;
    case "findIndex": for (let i = 0; i < n; i++) if (await cb(arr[i], i, arr)) return i; return -1;
    case "reduce": { let i = 0, acc; if (rest.length) acc = rest[0]; else { acc = arr[0]; i = 1; } for (; i < n; i++) acc = await cb(acc, arr[i], i, arr); return acc; }
    case "reduceRight": { let i = n - 1, acc; if (rest.length) acc = rest[0]; else { acc = arr[n - 1]; i = n - 2; } for (; i >= 0; i--) acc = await cb(acc, arr[i], i, arr); return acc; }
    case "flatMap": { const out = []; for (let i = 0; i < n; i++) { const r = await cb(arr[i], i, arr); if (Array.isArray(r)) out.push(...r); else out.push(r); } return out; }
  }
  throw new Error("__osArr: unsupported " + method);
}
`;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
function isFnLike(n) {
  return ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) ||
    ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);
}
function fnKind(n) {
  if (!n) return 'top-level';
  if (n.kind === 'field') return 'field-initializer';
  if (ts.isFunctionDeclaration(n)) return 'function';
  if (ts.isMethodDeclaration(n)) return 'method';
  if (ts.isArrowFunction(n)) return 'arrow';
  if (ts.isFunctionExpression(n)) return 'function-expression';
  if (ts.isConstructorDeclaration(n)) return 'constructor';
  return 'accessor';
}
function fnName(n, sf) {
  if (!n) return '<top-level>';
  if (n.kind === 'field') return 'field ' + n.node.name.getText(sf);
  const cls = (x) => { let p = x.parent; while (p && !ts.isClassLike(p)) p = p.parent; return p && p.name ? p.name.text + '.' : ''; };
  if (ts.isConstructorDeclaration(n)) return cls(n) + 'constructor';
  if (n.name) return cls(n) + n.name.getText(sf);
  if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
    const p = n.parent;
    if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf) + ' (arrow)';
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    return 'anonymous ' + fnKind(n) + ' @L' + (line + 1);
  }
  return '<fn>';
}
function lineOf(sf, pos) { const lc = sf.getLineAndCharacterOfPosition(pos); return { line: lc.line + 1, col: lc.character }; }
function lineText(sf, line) { return sf.text.split('\n')[line - 1]; }
function inExcelScriptNs(decl) {
  for (let p = decl; p; p = p.parent) if (ts.isModuleDeclaration(p) && p.name && p.name.text === 'ExcelScript') return true;
  return false;
}
function rootIdent(expr) {
  let e = expr;
  while (e && (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isCallExpression(e))) e = e.expression;
  return e && ts.isIdentifier(e) ? e.text : null;
}
function hasLeadingComment(sf, node) {
  const r = ts.getLeadingCommentRanges(sf.text, node.pos);
  return !!(r && r.length);
}

// ---------------------------------------------------------------------------------------------
// Program + analysis
// ---------------------------------------------------------------------------------------------
function makeProgram(file, target, sloppy) {
  const opts = {
    target: target, lib: ['lib.es2019.d.ts'], types: [], strict: true, noImplicitAny: true, alwaysStrict: !sloppy,
    sourceMap: true, module: ts.ModuleKind.None, noEmitOnError: false, removeComments: false,
    outDir: '/osemu-virtual-out', newLine: ts.NewLineKind.LineFeed, skipLibCheck: true,
  };
  const program = ts.createProgram([file, STUB], opts);
  return program;
}

function analyze(program, file, model) {
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file);
  const fns = [];
  const calls = [];
  const callByNode = new Map();
  const isArrayType = (t) => {
    if (!t) return false;
    t = checker.getNonNullableType(t);
    if (typeof checker.isArrayType === 'function') return checker.isArrayType(t);
    return !!(t.symbol && (t.symbol.name === 'Array' || t.symbol.name === 'ReadonlyArray'));
  };
  const userFnOf = (expr) => { // identifier/property referring to a user fn-like (for identifier callbacks)
    const sym = checker.getSymbolAtLocation(expr);
    if (!sym) return null;
    const s = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
    const d = s.valueDeclaration;
    if (!d || d.getSourceFile() !== sf) return null;
    if (isFnLike(d)) return d;
    if (ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return d.initializer;
    return null;
  };
  function visit(n, owner) {
    if (isFnLike(n)) { fns.push(n); owner = n; }
    else if (ts.isPropertyDeclaration(n) && n.initializer && !(ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Static)) {
      owner = { kind: 'field', node: n };
    }
    if (ts.isCallExpression(n)) {
      let decl = null;
      try { const sig = checker.getResolvedSignature(n); decl = sig && sig.declaration ? sig.declaration : null; } catch (e) { decl = null; }
      const declSf = decl && decl.getSourceFile ? decl.getSourceFile() : null;
      const userDecl = decl && declSf === sf && isFnLike(decl) ? decl : null;
      const seed = (decl && declSf && declSf.isDeclarationFile && inExcelScriptNs(decl)) || rootIdent(n.expression) === 'console';
      let arrayMethod = null, recvIsArray = false, methodName = null;
      if (ts.isPropertyAccessExpression(n.expression)) {
        methodName = n.expression.name.text;
        recvIsArray = isArrayType(checker.getTypeAtLocation(n.expression.expression));
        if (recvIsArray) arrayMethod = methodName;
      }
      const fnArgs = n.arguments.filter((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
      const identArgs = n.arguments.filter((a) => ts.isIdentifier(a) || ts.isPropertyAccessExpression(a))
        .map((a) => ({ arg: a, fn: userFnOf(a) })).filter((x) => x.fn);
      const c = { node: n, owner, decl, userDecl, seed, arrayMethod, recvIsArray, methodName, fnArgs, identArgs, builtin: !userDecl };
      calls.push(c);
      callByNode.set(n, c);
    }
    ts.forEachChild(n, (ch) => visit(ch, owner));
  }
  visit(sf, null);

  const asyncSet = new Set();
  const awaited = new Map(); // call node -> kind
  if (!model.none) {
    for (const f of fns) {
      if (ts.isFunctionDeclaration(f) && (model.baseFns || (f.name && f.name.text === 'main' && f.parent === sf))) asyncSet.add(f);
      if (ts.isMethodDeclaration(f) && model.baseMethods) asyncSet.add(f);
    }
    const isCtorCtx = (o) => o && (o.kind === 'field' || ts.isConstructorDeclaration(o));
    let changed = true, guard = 0;
    while (changed && guard++ < 1000) {
      changed = false;
      for (const c of calls) {
        if (model.ctorAwait === false && isCtorCtx(c.owner)) continue;
        let kind = null;
        if (!model.noArrayHelper && c.arrayMethod && ARRAY_HELPER_METHODS.has(c.arrayMethod) && c.fnArgs.some((a) => asyncSet.has(a))) kind = 'arrayHelper';
        else if (c.seed) kind = 'api';
        else if (c.userDecl && asyncSet.has(c.userDecl)) kind = 'user';
        else if (model.awaitAll) kind = 'all';
        if (!kind || awaited.get(c.node) === kind) continue;
        awaited.set(c.node, kind);
        changed = true;
        const o = c.owner;
        if (o && o.kind !== 'field' && !asyncSet.has(o)) {
          if (ts.isArrowFunction(o) || ts.isFunctionExpression(o)) asyncSet.add(o);
          else if ((ts.isFunctionDeclaration(o) || ts.isMethodDeclaration(o)) && model.colored) asyncSet.add(o);
        }
      }
    }
  }
  // functions that keep their awaits but lose the async keyword (bug #4005)
  const noAsync = new Set();
  if (model.bug) {
    for (const f of asyncSet) {
      if (ts.isMethodDeclaration(f) && hasLeadingComment(sf, f)) noAsync.add(f);
      if (model.bug === 'methods+functions' && ts.isFunctionDeclaration(f) && !(f.name && f.name.text === 'main') && hasLeadingComment(sf, f)) noAsync.add(f);
    }
  }
  const effAsync = (o) => !!o && o.kind !== 'field' && asyncSet.has(o) && !noAsync.has(o) && !ts.isConstructorDeclaration(o) && !ts.isGetAccessorDeclaration(o) && !ts.isSetAccessorDeclaration(o);

  // static syntax errors: await inside a function that is not (effectively) async
  const errors = [];
  for (const c of calls) {
    if (!awaited.has(c.node)) continue;
    if (effAsync(c.owner)) continue;
    const start = c.node.getStart(sf);
    const lc = lineOf(sf, start);
    let reason;
    const k = fnKind(c.owner);
    if (k === 'top-level') reason = 'await at script top level';
    else if (k === 'field-initializer') reason = 'await in class field initializer (runs in constructor)';
    else if (k === 'constructor') reason = 'await in constructor (constructors cannot be async)';
    else if (noAsync.has(c.owner)) reason = 'await in ' + k + ' that lost async (leading comment, bug #4005)';
    else reason = 'await in non-async ' + k;
    errors.push({ call: c.node, kind: awaited.get(c.node), line: lc.line, col: lc.col, owner: fnName(c.owner, sf), ownerLine: c.owner && c.owner.kind !== 'field' ? lineOf(sf, c.owner.getStart(sf)).line : null, reason, code: c.node.getText(sf).split('\n')[0].slice(0, 100), lineText: lineText(sf, lc.line).trim().slice(0, 160) });
  }
  errors.sort((a, b) => a.call.getStart(sf) - b.call.getStart(sf));

  // semantic warnings
  const warnings = [];
  for (const c of calls) {
    const kindAw = awaited.get(c.node);
    for (const a of c.fnArgs) {
      if (asyncSet.has(a) && kindAw !== 'arrayHelper') {
        const lc = lineOf(sf, a.getStart(sf));
        warnings.push({ type: 'async-callback-not-awaited', line: lc.line, detail: 'async callback passed to ' + (c.recvIsArray ? 'Array.' : '') + (c.methodName || c.node.expression.getText(sf)) + '() which does not await it: ' + lineText(sf, lc.line).trim().slice(0, 140) });
      }
    }
    for (const ia of c.identArgs) {
      if (asyncSet.has(ia.fn) && c.builtin) {
        const lc = lineOf(sf, ia.arg.getStart(sf));
        warnings.push({ type: 'identifier-callback', line: lc.line, detail: 'async user function "' + ia.arg.getText(sf) + '" passed by identifier to ' + (c.recvIsArray ? 'Array.' : '') + (c.methodName || '?') + '() - results become Promises: ' + lineText(sf, lc.line).trim().slice(0, 140) });
      }
    }
  }
  return { sf, checker, fns, calls, asyncSet, awaited, noAsync, errors, warnings };
}

// ---------------------------------------------------------------------------------------------
// Transform + emit
// ---------------------------------------------------------------------------------------------
function addAsync(f, node) {
  const mods = [...(node.modifiers || []), f.createModifier(ts.SyntaxKind.AsyncKeyword)];
  // the return type annotation is dropped: with target ES5 TS would otherwise use it as the Promise
  // constructor (__awaiter(this, void 0, Uint8Array, ...)); the runtime has to rewrite it to Promise<T> anyway
  if (ts.isMethodDeclaration(node)) return f.updateMethodDeclaration(node, mods, node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, undefined, node.body);
  if (ts.isFunctionDeclaration(node)) return f.updateFunctionDeclaration(node, mods, node.asteriskToken, node.name, node.typeParameters, node.parameters, undefined, node.body);
  if (ts.isArrowFunction(node)) return f.updateArrowFunction(node, mods, node.typeParameters, node.parameters, undefined, node.equalsGreaterThanToken, node.body);
  if (ts.isFunctionExpression(node)) return f.updateFunctionExpression(node, mods, node.asteriskToken, node.name, node.typeParameters, node.parameters, undefined, node.body);
  return node;
}

function makeTransformer(an, emitMode, suppressed) {
  return (context) => {
    const f = context.factory;
    const visit = (node) => {
      if (ts.isCallExpression(node) && an.awaited.has(node) && !suppressed.has(node)) {
        const kind = an.awaited.get(node);
        let inner;
        if (kind === 'arrayHelper') {
          const pa = node.expression;
          inner = f.createCallExpression(f.createIdentifier('__osArr'), undefined,
            [ts.visitNode(pa.expression, visit), f.createStringLiteral(pa.name.text), ...node.arguments.map((a) => ts.visitNode(a, visit))]);
          ts.setSourceMapRange(inner, node);
        } else {
          inner = ts.visitEachChild(node, visit, context);
        }
        let aw = f.createAwaitExpression(inner);
        ts.setSourceMapRange(aw, { pos: node.getStart(an.sf), end: node.end });
        if (emitMode === 'paren') aw = f.createParenthesizedExpression(aw);
        return aw;
      }
      if (isFnLike(node) && an.asyncSet.has(node) && !an.noAsync.has(node) &&
          !ts.isConstructorDeclaration(node) && !ts.isGetAccessorDeclaration(node) && !ts.isSetAccessorDeclaration(node)) {
        return addAsync(f, ts.visitEachChild(node, visit, context));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sf) => ts.visitNode(sf, visit);
  };
}

function emit(program, an, emitMode, suppressed) {
  const out = {};
  const res = program.emit(an.sf, (name, text) => { if (name.endsWith('.map')) out.map = text; else if (name.endsWith('.js')) out.js = text; },
    undefined, false, an.awaited.size || an.asyncSet.size ? { before: [makeTransformer(an, emitMode, suppressed || new Set())] } : undefined);
  if (!out.js) throw new Error('emit produced no JS: ' + JSON.stringify(res.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))));
  // ES5 only: TS passes the ORIGINAL return type (e.g. Uint8Array) as the Promise constructor of
  // __awaiter for functions the emulator made async; the real runtime would have rewritten the
  // return type to Promise<T>, so neutralise it (same line, only columns shift).
  out.js = out.js.replace(/__awaiter\((_this|this), (void 0|arguments), (?!void 0,)[A-Za-z_$][\w$.]*, function/g, '__awaiter($1, $2, void 0, function');
  return out;
}

// ---------------------------------------------------------------------------------------------
// Source maps
// ---------------------------------------------------------------------------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(seg) {
  const out = []; let shift = 0, val = 0;
  for (const ch of seg) {
    const d = B64.indexOf(ch); const cont = d & 32; val += (d & 31) << shift;
    if (cont) shift += 5; else { out.push(val & 1 ? -(val >> 1) : val >> 1); val = 0; shift = 0; }
  }
  return out;
}
function decodeMap(mapText) {
  const map = JSON.parse(mapText);
  let sl = 0, sc = 0;
  return map.mappings.split(';').map((l) => {
    const segs = []; let gc = 0;
    if (l) for (const s of l.split(',')) { const v = vlq(s); gc += v[0]; if (v.length >= 4) { sl += v[2]; sc += v[3]; segs.push([gc, sl, sc]); } }
    return segs;
  });
}
function mapPos(dec, line1, col0) {
  for (let L = line1 - 1; L >= 0; L--) {
    const segs = dec[L] || [];
    let best = null;
    for (const s of segs) { if (L < line1 - 1 || s[0] <= col0) best = s; else break; }
    if (!best && L === line1 - 1 && segs.length) best = segs[0];
    if (best) return { line: best[1] + 1, col: best[2] };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// V8 parse
// ---------------------------------------------------------------------------------------------
function v8parse(js) {
  try { new vm.Script(js, { filename: 'osemu-converted.js' }); return null; } catch (e) {
    const st = String(e.stack || '').split('\n');
    let line = null, col = null;
    const m = /osemu-converted\.js:(\d+)/.exec(st[0] || '');
    if (m) { line = +m[1]; const caret = st.findIndex((x, i) => i > 0 && /^\s*\^+\s*$/.test(x)); if (caret > 0) col = st[caret].indexOf('^'); }
    return { message: e.message, jsLine: line, jsCol: col, jsText: line ? js.split('\n')[line - 1] : '' };
  }
}

function parseReport(program, an, emitMode, opts) {
  const suppressed = new Set();
  const found = [];
  const maxIter = opts.firstOnly ? 1 : (opts.maxIter || 400);
  let unmatched = null;
  let firstError = null;
  for (let it = 0; it < maxIter; it++) {
    const out = emit(program, an, emitMode, suppressed);
    const err = v8parse(out.js);
    if (!err) break;
    const dec = decodeMap(out.map);
    const ts0 = err.jsLine ? mapPos(dec, err.jsLine, err.jsCol || 0) : null;
    const entry = { message: err.message, tsLine: ts0 ? ts0.line : null, tsCol: ts0 ? ts0.col : null, jsLine: err.jsLine, jsText: (err.jsText || '').trim().slice(0, 160) };
    if (!firstError) firstError = entry;
    // match against static errors
    const remaining = an.errors.filter((e) => !suppressed.has(e.call));
    let match = null;
    if (ts0) {
      const same = remaining.filter((e) => e.line === ts0.line);
      if (same.length) match = same.reduce((a, b) => (Math.abs(a.col - ts0.col) <= Math.abs(b.col - ts0.col) ? a : b));
    }
    if (!match && remaining.length) match = remaining[0];
    if (!match) { unmatched = entry; break; }
    entry.match = match;
    found.push(entry);
    suppressed.add(match.call);
    if (opts.firstOnly) break;
  }
  return { firstError, found, unmatched };
}

// ---------------------------------------------------------------------------------------------
// Fixture runner
// ---------------------------------------------------------------------------------------------
async function runFixtures(js, opts) {
  const fixDir = opts.fixtures || DEFAULT_FIXTURES;
  const expected = JSON.parse(fs.readFileSync(path.join(fixDir, 'expected.json'), 'utf8'));
  const factory = new Function(js + '\n' + HELPER_JS + '\nreturn main;');
  let unhandled = 0;
  const onRej = () => { unhandled++; };
  process.on('unhandledRejection', onRej);
  let pass = 0, fail = 0;
  const rows = [];
  for (const name of Object.keys(expected).sort()) {
    if (opts.only && !name.includes(opts.only)) continue;
    const file = path.join(fixDir, name);
    if (!fs.existsSync(file)) { rows.push({ name, status: 'SKIP' }); continue; }
    // *.input.txt fixtures hold the exact input string (see test/gen/make_input.js)
    const b64 = name.endsWith('.input.txt') ? fs.readFileSync(file, 'utf8') : fs.readFileSync(file).toString('base64');
    const main = factory();
    const u0 = unhandled;
    const t0 = Date.now();
    let r, exc = null;
    const subject = expected[name] && typeof expected[name] === 'object' && expected[name].mailSubject !== undefined ? expected[name].mailSubject : undefined;
    try { r = subject === undefined ? await main({}, b64, '') : await main({}, b64, '', subject); } catch (e) { exc = e; }
    await new Promise((res) => setImmediate(res));
    const ms = Date.now() - t0;
    const want = expected[name];
    let ok = false;
    if (!exc && r) {
      if (typeof want === 'string') ok = want === '' ? r.ok === false : (r.ok && r.amount === want);
      else {
        // object form, same rules as test/run.js
        const rank = { low: 0, medium: 1, high: 2 };
        ok = true;
        if (want.amount !== undefined) ok = ok && (want.amount === '' ? r.ok === false : (r.ok && r.amount === want.amount));
        if (want.confidence !== undefined) ok = ok && r.confidence === want.confidence;
        if (want.maxConfidence !== undefined) ok = ok && rank[r.confidence] <= rank[want.maxConfidence];
        if (want.check) ok = ok && (!r.ok || r.confidence === 'low');
        if (want.error !== undefined) ok = ok && String(r.error).indexOf(want.error) >= 0;
        if (want.warning !== undefined) ok = ok && String(r.warnings).indexOf(want.warning) >= 0;
        if (want.notInText !== undefined) ok = ok && String(r.text).indexOf(want.notInText) < 0;
        // version 2 fields, same rules as test/run.js
        for (const k of ['verdict', 'category', 'subjectPrefix', 'newSubject']) if (want[k] !== undefined) ok = ok && r[k] === want[k];
        for (const k of ['patchSubject', 'patchCategory', 'verdictWhy']) if (want[k] !== undefined) ok = ok && String(r[k]).indexOf(want[k]) >= 0;
      }
      for (const k of ['verdict', 'verdictWhy', 'category', 'subjectPrefix', 'newSubject', 'patchCategory', 'patchSubject']) if (typeof r[k] !== 'string') ok = false;
      if (!Array.isArray(r.documents)) ok = false;
    }
    if (ok) pass++; else fail++;
    rows.push({ name, status: ok ? 'PASS' : 'FAIL', amount: r ? r.amount : undefined, want, conf: r ? r.confidence : undefined, method: r ? r.method : undefined, pages: r ? r.pages : undefined, ms, error: exc ? 'THROWN: ' + String(exc) : (r && r.error) || '', warnings: r ? String(r.warnings || '').slice(0, 160) : '', unhandled: unhandled - u0, isPromiseResult: r && typeof r.then === 'function', fullResult: r });
  }
  process.removeListener('unhandledRejection', onRej);
  return { pass, fail, rows };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--model') o.model = argv[++i];
    else if (a === '--emit') o.emit = argv[++i];
    else if (a === '--run') o.run = true;
    else if (a === '--patch') o.patch = true;
    else if (a === '--only') o.only = argv[++i];
    else if (a === '--fixtures') o.fixtures = argv[++i];
    else if (a === '--dump') o.dump = argv[++i];
    else if (a === '--first-only') o.firstOnly = true;
    else if (a === '--calibrate') o.calibrate = true;
    else if (a === '--old') o.old = argv[++i];
    else if (a === '--cand') o.cand = argv[++i];
    else if (a === '--list-models') o.listModels = true;
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--no-array-helper') o.noArrayHelper = true;
    else if (a === '--also') (o.also = o.also || []).push(argv[++i]);
    else o._.push(a);
  }
  return o;
}

const programCache = new Map();
function getProgram(file, emitMode) {
  const target = emitMode === 'es5' || emitMode === 'es5s' ? ts.ScriptTarget.ES5 : ts.ScriptTarget.ES2019;
  const sloppy = emitMode === 'es5';
  const key = path.resolve(file) + '|' + target + '|' + sloppy;
  if (!programCache.has(key)) programCache.set(key, makeProgram(path.resolve(file), target, sloppy));
  return programCache.get(key);
}

function preDiagnostics(program, file) {
  const sf = program.getSourceFile(path.resolve(file));
  return [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)].map((d) => {
    const lc = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    return (lc ? 'L' + (lc.line + 1) + ': ' : '') + ts.flattenDiagnosticMessageText(d.messageText, ' ');
  });
}

function fmtErr(e) {
  if (!e) return 'parses OK';
  return '"' + e.message + '" at TS L' + e.tsLine + (e.tsCol !== null ? ':' + (e.tsCol + 1) : '') + ' | JS: ' + e.jsText.slice(0, 90);
}

async function single(file, opts) {
  const modelName = opts.model || 'M1';
  let model = MODELS[modelName];
  if (!model) throw new Error('unknown model ' + modelName + ' (see --list-models)');
  if (opts.noArrayHelper) model = Object.assign({}, model, { noArrayHelper: true, desc: model.desc + ' [--no-array-helper: async arrow callbacks to Array methods are NOT awaited]' });
  const emits = !opts.emit || opts.emit === 'all' ? ['await', 'paren', 'es5', 'es5s'] : [opts.emit];
  const report = { file: path.resolve(file), model: modelName, modelDesc: model.desc, emits: {} };
  const p0 = getProgram(file, 'await');
  const diags = preDiagnostics(p0, file);
  console.log('== osemu: ' + report.file);
  console.log('   model ' + modelName + ': ' + model.desc);
  console.log('   TS diagnostics before conversion (stub ExcelScript): ' + (diags.length ? diags.length + '\n     ' + diags.slice(0, 10).join('\n     ') : 0));
  const an0 = analyze(p0, path.resolve(file), model);
  console.log('   async functions: ' + an0.asyncSet.size + ' (keyword dropped by bug: ' + an0.noAsync.size + ')' + ', awaited calls: ' + an0.awaited.size +
    ' [' + Object.entries([...an0.awaited.values()].reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {})).map(([k, v]) => k + '=' + v).join(', ') + ']');
  if (an0.noAsync.size) console.log('   methods hit by bug #4005: ' + [...an0.noAsync].map((f) => fnName(f, an0.sf) + '@L' + lineOf(an0.sf, f.getStart(an0.sf)).line).join(', '));
  console.log('   static syntax errors (await outside async): ' + an0.errors.length);
  const byOwner = new Map();
  for (const e of an0.errors) { const k = e.owner + ' [' + e.reason + ']'; if (!byOwner.has(k)) byOwner.set(k, []); byOwner.get(k).push(e); }
  for (const [k, list] of byOwner) {
    console.log('     - ' + k + ': ' + list.length + ' await(s), lines ' + list.map((e) => e.line).filter((v, i, a) => a.indexOf(v) === i).join(','));
    if (!opts.quiet) for (const e of list.slice(0, 4)) console.log('         L' + e.line + ':' + (e.col + 1) + '  ' + e.lineText);
  }
  if (an0.warnings.length) {
    console.log('   semantic warnings: ' + an0.warnings.length);
    for (const w of an0.warnings) console.log('     - [' + w.type + '] L' + w.line + ': ' + w.detail);
  }
  report.static = { asyncCount: an0.asyncSet.size, awaitedCount: an0.awaited.size, errors: an0.errors.map(({ call, ...r }) => r), warnings: an0.warnings, bugMethods: [...an0.noAsync].map((f) => fnName(f, an0.sf)) };
  for (const em of emits) {
    const p = getProgram(file, em);
    const an = em.startsWith('es5') ? analyze(p, path.resolve(file), model) : an0;
    const pr = parseReport(p, an, em, opts);
    report.emits[em] = { first: pr.firstError, all: pr.found.map((f) => ({ message: f.message, tsLine: f.tsLine, matchLine: f.match ? f.match.line : null, owner: f.match ? f.match.owner : null, jsText: f.jsText })), unmatched: pr.unmatched };
    console.log('   [emit ' + em + '] first V8 error: ' + fmtErr(pr.firstError));
    if (!opts.firstOnly && pr.found.length > 0) {
      const counts = pr.found.reduce((m, f) => { m[f.message] = (m[f.message] || 0) + 1; return m; }, {});
      console.log('      all V8 errors (' + pr.found.length + '): ' + Object.entries(counts).map(([k, v]) => v + 'x "' + k + '"').join('; '));
      if (!opts.quiet) for (const f of pr.found) console.log('        TS L' + f.tsLine + ' (' + (f.match ? f.match.owner : '?') + '): ' + f.message);
    }
    if (pr.unmatched) console.log('      UNMATCHED V8 error (not an inserted await): ' + fmtErr(pr.unmatched));
    if (opts.dump) {
      const out = emit(p, an, em, new Set());
      const dp = opts.dump.replace(/(\.js)?$/, '.' + modelName + '.' + em + '.js');
      fs.writeFileSync(dp, out.js + '\n' + HELPER_JS);
      console.log('      dumped ' + dp);
    }
  }
  if (opts.run) {
    const em = ['es5', 'es5s', 'paren'].includes(opts.emit) ? opts.emit : 'await';
    const p = getProgram(file, em);
    const an = em.startsWith('es5') ? analyze(p, path.resolve(file), model) : an0;
    const supp = new Set();
    if (an.errors.length) {
      if (!opts.patch) { console.log('   --run: converted code has syntax errors; not runnable (use --patch to drop the failing awaits and run anyway)'); report.run = null; return report; }
      for (const e of an.errors) supp.add(e.call);
      console.log('   --run --patch: dropped ' + supp.size + ' failing awaits so the code parses');
    }
    const out = emit(p, an, em, supp);
    const err = v8parse(out.js);
    if (err) { console.log('   --run: still a parse error: ' + err.message); return report; }
    const rr = await runFixtures(out.js, opts);
    report.run = rr;
    console.log('   --run [emit ' + em + ']: ' + rr.pass + ' passed, ' + rr.fail + ' failed');
    for (const r of rr.rows) {
      console.log('     ' + r.status + '  ' + r.name.padEnd(34) + (r.status === 'SKIP' ? '' : ' amount=' + JSON.stringify(r.amount) + ' want=' + JSON.stringify(r.want) + ' conf=' + r.conf + ' method=' + r.method + ' pages=' + r.pages + ' ' + r.ms + 'ms' + (r.unhandled ? ' unhandledRejections=' + r.unhandled : '') + (r.error ? ' error=' + r.error : '') + (r.status === 'FAIL' && r.warnings ? ' warn=' + r.warnings : '')));
    }
  }
  return report;
}

async function calibrate(opts) {
  const files = {
    OLD: opts.old || DEFAULT_OLD,
    CAND: opts.cand || DEFAULT_CAND,
    'S4005': path.join(HERE, 'sample4005.ts'),
    'S4005-nc': path.join(HERE, 'sample4005_nocomment.ts'),
  };
  for (const a of opts.also || []) files[path.basename(a, '.ts')] = a;
  const emits = ['await', 'paren', 'es5', 'es5s'];
  const rows = [];
  const want = "Unexpected token 'this'";
  console.log('Calibration: a model+emit is credible if OLD and S4005 (#4005 repro with comment) fail with "' + want + '" and S4005-nc (no comment) parses.\n');
  for (const [mn, model] of Object.entries(MODELS)) {
    if (model.none) continue;
    for (const em of emits) {
      const res = {};
      for (const [fk, f] of Object.entries(files)) {
        const p = getProgram(f, em);
        const an = analyze(p, path.resolve(f), model);
        const pr = parseReport(p, an, em, { firstOnly: true });
        res[fk] = { first: pr.firstError, staticErrors: an.errors.length };
      }
      const ok = (r) => r.first && r.first.message === want;
      const credibleOld = ok(res.OLD);
      const credible4005 = ok(res.S4005) && !res['S4005-nc'].first;
      rows.push({ model: mn, emit: em, credible: credibleOld && credible4005, credibleOld, credible4005, res });
      console.log(mn.padEnd(4) + ' ' + em.padEnd(5) + ' | credible=' + (credibleOld && credible4005 ? 'YES' : 'no ') + ' (OLD ' + (credibleOld ? 'ok' : '--') + ', #4005 ' + (credible4005 ? 'ok' : '--') + ')');
      for (const fk of Object.keys(files)) console.log('        ' + fk.padEnd(9) + ' static=' + String(res[fk].staticErrors).padStart(3) + '  first: ' + fmtErr(res[fk].first));
    }
  }
  return rows;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.listModels) { for (const [k, m] of Object.entries(MODELS)) console.log(k.padEnd(5) + m.desc); return; }
  let out;
  if (opts.calibrate) out = await calibrate(opts);
  else {
    if (!opts._[0]) { console.error('usage: node osemu.js <file.ts> --model <M> [--emit await|paren|es5|all] [--run] [--patch] [--only s] | --calibrate | --list-models'); process.exit(2); }
    out = await single(opts._[0], opts);
  }
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(out, (k, v) => (k === 'call' ? undefined : v), 2));
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
