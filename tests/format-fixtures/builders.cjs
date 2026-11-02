const zlib = require("node:zlib");

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A deterministic, standards-shaped ZIP package with local headers, CRCs and central directory.
function zip(entries, options = {}) {
  const local = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data);
    const method = entry.store ? 0 : 8;
    const compressed = method === 0 ? data : zlib.deflateRawSync(data);
    const flags = 0x800 | (entry.encrypted ? 1 : 0);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(flags, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(flags, 8);
    dir.writeUInt16LE(method, 10);
    header.copy(dir, 16, 14, 26);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...(options.noDirectory ? [] : [directory, end])]);
}

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (s) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[s]);
const adviceRows = (total = 1200.3) => [
  ["Zahlungsavis"],
  ["Wir haben Ihre Rechnungen heute bezahlt."],
  ["Rechnung", "Zahlbetrag", "Währung"],
  ["RE-100", Math.round((total - 200.2) * 100) / 100, "EUR"],
  ["RE-101", 200.2, "EUR"],
  ["Summe", total, "EUR"],
];
function xlsx(sheets = [{ name: "Avis", rows: adviceRows() }], options = {}) {
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const relns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageNs = "http://schemas.openxmlformats.org/package/2006/relationships";
  const entries = [
    {name:"[Content_Types].xml",data:`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`},
    {name:"_rels/.rels",data:`<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${relns}/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`<workbook xmlns="${ns}" xmlns:r="${relns}"><sheets>${sheets.map((sheet,i)=>`<sheet name="${escapeXml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"${sheet.hidden?' state="hidden"':''}/>`).join("")}</sheets></workbook>`,encrypted:options.encrypted},
    {name:"xl/_rels/workbook.xml.rels",data:`<Relationships xmlns="${packageNs}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${relns}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="styles" Type="${relns}/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",data:`<styleSheet xmlns="${ns}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`},
  ];
  sheets.forEach((sheet,i)=>entries.push({name:`xl/worksheets/sheet${i+1}.xml`,data:`<worksheet xmlns="${ns}"><sheetData>${sheet.rows.map((row,r)=>`<row r="${r+1}">${row.map((cell,c)=>{
    const ref=String.fromCharCode(65+c)+(r+1);
    if (typeof cell==='number') return `<c r="${ref}" s="1"><v>${cell}</v></c>`;
    if (cell && typeof cell==='object') return `<c r="${ref}" s="1"><f>${escapeXml(cell.formula)}</f>${cell.value===undefined?'':`<v>${cell.value}</v>`}</c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
  }).join("")}</row>`).join("")}</sheetData></worksheet>`}));
  return zip(entries, options);
}

function ods(tables = [{ name: "Avis", rows: adviceRows() }], options = {}) {
  const content = `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:spreadsheet>${tables.map(table=>`<table:table table:name="${escapeXml(table.name)}">${table.rows.map(row=>`<table:table-row>${row.map(cell=>typeof cell==='number'?`<table:table-cell office:value-type="float" office:value="${cell}"><text:p>${cell}</text:p></table:table-cell>`:`<table:table-cell office:value-type="string"><text:p>${escapeXml(cell)}</text:p></table:table-cell>`).join("")}</table:table-row>`).join("")}</table:table>`).join("")}</office:spreadsheet></office:body></office:document-content>`;
  return zip([
    {name:"mimetype",data:"application/vnd.oasis.opendocument.spreadsheet",store:true},
    {name:"META-INF/manifest.xml",data:`<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml">${options.encrypted?'<manifest:encryption-data manifest:checksum-type="SHA1/1K" manifest:checksum="AA=="/>':''}</manifest:file-entry></manifest:manifest>`},
    {name:"content.xml",data:content},
  ],options);
}

// CMS ContentInfo/SignedData carrying MIME bytes. The empty signerInfos is intentional:
// this tests container extraction, not signature validation or a cryptographic signature.
function der(tag, bytes) {
  const body = Buffer.from(bytes);
  const length = body.length < 128 ? Buffer.from([body.length]) : body.length < 256 ? Buffer.from([0x81,body.length]) : Buffer.from([0x82,body.length>>>8,body.length&255]);
  return Buffer.concat([Buffer.from([tag]),length,body]);
}
function cmsSigned(mime) {
  const dataOid = der(6,Buffer.from('2a864886f70d010701','hex'));
  const signedOid = der(6,Buffer.from('2a864886f70d010702','hex'));
  const content = der(0x30,Buffer.concat([dataOid,der(0xa0,der(4,Buffer.from(mime)))]));
  const signed = der(0x30,Buffer.concat([der(2,[1]),der(0x31,[]),content,der(0x31,[])]));
  return der(0x30,Buffer.concat([signedOid,der(0xa0,signed)]));
}

// Minimal CFB v3, with genuine mini-FAT chains for its small MAPI streams.
// This deliberately does not model recipient/attachment storages or compressed RTF.
function msg(subject, body, options = {}) {
  const END = 0xfffffffe, FREE = 0xffffffff, FAT = 0xfffffffd;
  const unicode = (s) => Buffer.from(s + "\0", "utf16le");
  const strings = [
    ["0037", unicode(subject)],
    ["1000", unicode(body)],
    ["0C1F", unicode("kunde@example.org")],
  ];
  const props = Buffer.alloc(32 + strings.length * 16);
  strings.forEach(([id, data], i) => {
    props.writeUInt32LE(parseInt(id + "001F", 16), 32 + i * 16);
    props.writeUInt32LE(6, 36 + i * 16);
    props.writeUInt32LE(data.length, 40 + i * 16);
  });
  const entries = [
    {name:"__properties_version1.0", data:props},
    ...strings.map(([id,data]) => ({name:"__substg1.0_" + id + "001F", data})),
  ];
  const miniPieces = [], miniChains = [];
  let miniCount = 0;
  entries.forEach((e) => {
    e.start = miniCount;
    const count = Math.ceil(e.data.length / 64);
    const padded = Buffer.alloc(count * 64);
    e.data.copy(padded);
    miniPieces.push(padded);
    for (let i = 0; i < count; i++) miniChains.push(i + 1 < count ? miniCount + i + 1 : END);
    miniCount += count;
  });
  const directorySectors = Math.ceil((entries.length + 1) / 4);
  const miniFatSectors = Math.ceil(miniCount / 128);
  const miniStreamSectors = Math.ceil(miniCount * 64 / 512);
  const fatSector = directorySectors;
  const miniFatSector = fatSector + 1;
  const miniStreamSector = miniFatSector + miniFatSectors;
  const sectorCount = miniStreamSector + miniStreamSectors;
  if (sectorCount > 128) throw new Error("minimal MSG fixture exceeds one FAT sector");
  const header = Buffer.alloc(512);
  Buffer.from("d0cf11e0a1b11ae1", "hex").copy(header);
  header.writeUInt16LE(0x3e, 0x18);
  header.writeUInt16LE(3, 0x1a);
  header.writeUInt16LE(0xfffe, 0x1c);
  header.writeUInt16LE(9, 0x1e);
  header.writeUInt16LE(6, 0x20);
  header.writeUInt32LE(1, 0x2c);
  header.writeUInt32LE(0, 0x30);
  header.writeUInt32LE(4096, 0x38);
  header.writeUInt32LE(miniFatSector, 0x3c);
  header.writeUInt32LE(miniFatSectors, 0x40);
  header.writeUInt32LE(END, 0x44);
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i === 0 ? fatSector : FREE, 0x4c + i * 4);
  const directory = Buffer.alloc(directorySectors * 512);
  const maxDepth = Math.floor(Math.log2(entries.length));
  const sorted = entries.map((e,i) => ({...e, index:i+1})).sort((a,b) => a.name.length-b.name.length || a.name.toUpperCase().localeCompare(b.name.toUpperCase(), "en"));
  function dirEntry(index, name, type, color, left, right, child, start, size) {
    const off = index * 128, nm = unicode(name);
    nm.copy(directory, off);
    directory.writeUInt16LE(nm.length, off+64);
    directory[off+66] = type;
    directory[off+67] = color;
    directory.writeUInt32LE(left, off+68);
    directory.writeUInt32LE(right, off+72);
    directory.writeUInt32LE(child, off+76);
    directory.writeUInt32LE(start, off+116);
    directory.writeUInt32LE(size, off+120);
  }
  function tree(es, depth) {
    if (!es.length) return FREE;
    const mid = es.length >> 1, e = es[mid];
    const left = tree(es.slice(0,mid), depth+1), right = tree(es.slice(mid+1), depth+1);
    dirEntry(e.index, e.name, 2, depth > 0 && depth === maxDepth ? 0 : 1, left, right, FREE, e.start, e.data.length);
    return e.index;
  }
  dirEntry(0, "Root Entry", 5, 1, FREE, FREE, tree(sorted,0), miniStreamSector, miniCount * 64);
  const fat = Buffer.alloc(512, 0xff);
  const chain = (start,count) => {
    for (let i = 0; i < count; i++) fat.writeUInt32LE(i+1<count ? start+i+1 : END, (start+i)*4);
  };
  chain(0,directorySectors);
  fat.writeUInt32LE(FAT, fatSector*4);
  chain(miniFatSector,miniFatSectors);
  chain(miniStreamSector,miniStreamSectors);
  const miniFat = Buffer.alloc(miniFatSectors * 512, 0xff);
  miniChains.forEach((next,i) => miniFat.writeUInt32LE(next,i*4));
  if (options.brokenBodyChain) miniFat.writeUInt32LE(END, entries[2].start*4);
  const miniStream = Buffer.alloc(miniStreamSectors * 512);
  Buffer.concat(miniPieces).copy(miniStream);
  return Buffer.concat([header,directory,fat,miniFat,miniStream]);
}

module.exports = { zip, xlsx, ods, adviceRows, cmsSigned, msg };
