const assert = require("node:assert/strict");
const vm = require("node:vm");
const { load, eml, pdf, textAdvice } = require("./fixtures.cjs");
const { zip, xlsx, ods, adviceRows, cmsSigned, msg } = require("./format-fixtures/builders.cjs");

// All cases enter the public Office Script main(), including the MIME/base64 envelope.
// A wall-clock VM limit protects this suite from hangs independently of the script's budget.
const ctx = load();
let tests = 0;
const failures = [];
function check(name, fn) {
  try { fn(); tests++; }
  catch (error) { failures.push(name + ": " + error.message); }
}
function main(input) {
  ctx.formatInput = input;
  return JSON.parse(JSON.stringify(vm.runInContext("main({},formatInput,'','Abrechnung Oktober')", ctx, {timeout:2000})));
}
function attachment(name, data, type = "application/octet-stream") {
  return main(eml({attachments:[{name,type,text:data}]}));
}
function review(r) {
  assert.equal(r.needsReview, true, JSON.stringify(r));
  for (const key of ["category","patchCategory","subjectPrefix","newSubject","patchSubject"]) assert.equal(r[key], "", key);
}
function single(r, expected = 1200.3, high = true) {
  assert.equal(r.verdict, "advice", JSON.stringify(r));
  assert.equal(r.amountNumber, expected, JSON.stringify(r));
  if (!high) { review(r); return; }
  assert.equal(r.confidence, "high");
  assert.equal(r.needsReview, false);
  assert.equal(r.category, "Avis");
  const formatted = expected.toLocaleString("de-DE", {minimumFractionDigits:2,maximumFractionDigits:2});
  assert.equal(r.newSubject, formatted + " Abrechnung Oktober");
  assert.deepEqual(JSON.parse(r.patchSubject), {subject:r.newSubject});
  assert.deepEqual(JSON.parse(r.patchCategory), {categories:["Avis"]});
}
function several(r, high = true) {
  assert.equal(r.verdict, "several", JSON.stringify(r));
  assert.deepEqual(r.paymentAmounts, ["1.200,30 EUR","5.632,21 EUR"]);
  if (!high) { review(r); return; }
  assert.equal(r.confidence, "high");
  assert.equal(r.needsReview, false);
  assert.equal(r.category, "Avis");
  assert.equal(r.newSubject, "1.200,30 + 5.632,21 Abrechnung Oktober");
}
const rows = (amount=1200.3) => [["Zahlungsavis"],["Zahlbetrag",amount,"EUR"]];
const twoSheets = [{name:"Avis 1",rows:rows()},{name:"Avis 2",rows:rows(5632.21)}];
const xml = '<?xml version="1.0"?><RemittanceAdvice><PaymentAmount Ccy="EUR">1200.30</PaymentAmount></RemittanceAdvice>';
const json = {type:"Remittance advice",payment:{amount:1200.3,currency:"EUR"}};
const rtf = "{\\rtf1\\ansi Zahlungsavis\\par Wir haben Ihre Rechnungen heute bezahlt.\\par Zahlbetrag: 1.200,30 EUR\\par}";
const html = "<!doctype html><html><body><h1>Zahlungsavis</h1><p>Wir haben Ihre Rechnungen heute bezahlt.</p><p>Zahlbetrag: <strong>1.200,30</strong> EUR</p></body></html>";

for (const [format, build] of [["xlsx",xlsx],["ods",ods]]) {
  check(format + " real ZIP: explicit payment", () => single(attachment("avis."+format,build([{name:"Avis",rows:rows()}]))));
  check(format + " real ZIP: two separate payments", () => several(attachment("avis."+format,build(twoSheets))));
  check(format + " computed column requires review", () => single(attachment("avis."+format,build([{name:"Avis",rows:adviceRows()}])),1200.3,false));
  check(format + " two computed columns preserve amounts and require review", () => several(attachment("avis."+format,build([{name:"Avis 1",rows:adviceRows()},{name:"Avis 2",rows:adviceRows(5632.21)}])),false));
  check(format + " local ZIP headers survive missing directory", () => single(attachment("avis."+format,build([{name:"Avis",rows:rows()}],{noDirectory:true}))));
  check(format + " truncated package requires review", () => {
    const data=build();
    review(attachment("avis."+format,data.subarray(0,Math.floor(data.length*0.6))));
  });
  // These fixtures carry format encryption indicators, not actual encrypted payloads.
  check(format + " encryption indicator requires review", () => review(attachment("avis."+format,build(undefined,{encrypted:true}))));
}
check("XLSX saved formula result", () => single(attachment("avis.xlsx",xlsx([{name:"Avis",rows:[["Zahlungsavis"],["Zahlbetrag",{formula:"SUM(B3:B4)",value:1200.3},"EUR"],["RE100",1000.1],["RE101",200.2]]}]))));
check("XLSX missing formula result cannot borrow first invoice amount", () => review(attachment("avis.xlsx",xlsx([{name:"Avis",rows:[["Zahlungsavis"],["Zahlbetrag",{formula:"SUM(B3:B4)"}],["RE100",1000.1],["RE101",200.2]]}]))));
check("XLSX missing formula in one payment blocks partial multi subject", () => review(attachment("avis.xlsx",xlsx([twoSheets[0],{name:"Avis 2",rows:[["Zahlungsavis"],["Zahlbetrag",{formula:"5632.21"},"EUR"]]}]))));
check("XLSX hidden sheet follows existing visible-only policy", () => single(attachment("avis.xlsx",xlsx([twoSheets[0],{...twoSheets[1],hidden:true}]))));
check("XLSX partly truncated second sheet does not yield partial subject", () => review(attachment("avis.xlsx",xlsx(twoSheets,{noDirectory:true}).subarray(0,-40))));

check("XML payment with currency attribute", () => single(attachment("avis.xml",xml,"application/xml")));
check("XML namespace, comment and CDATA", () => single(attachment("avis.xml",'<?xml version="1.0"?><!-- exporter --><r:RemittanceAdvice xmlns:r="urn:example"><r:PaymentAmount Ccy="EUR"><![CDATA[1200.30]]></r:PaymentAmount></r:RemittanceAdvice>',"application/xml")));
check("XML two separately identified payments", () => several(attachment("avis.xml",'<RemittanceAdvice><Payments><Payment><PaymentId>PAY1</PaymentId><PaymentAmount Ccy="EUR">1200.30</PaymentAmount></Payment><Payment><PaymentId>PAY2</PaymentId><PaymentAmount Ccy="EUR">5632.21</PaymentAmount></Payment></Payments></RemittanceAdvice>')));
check("XML unclosed second payment cannot preserve first as complete", () => review(attachment("avis.xml",xml.replace("</RemittanceAdvice>",'<PaymentAmount Ccy="EUR">5632.21'))));
check("XML mismatched closing tag", () => review(attachment("avis.xml",'<RemittanceAdvice><PaymentAmount Ccy="EUR">1200.30</WrongTag>')));
check("XML incomplete trailing tag", () => review(attachment("avis.xml",xml+'<RemittanceAdvice')));
check("XML depth limit cannot silently omit content", () => review(attachment("avis.xml","<RemittanceAdvice>"+"<Extra>".repeat(101)+'<PaymentAmount Ccy="EUR">1200.30</PaymentAmount>'+"</Extra>".repeat(101)+"</RemittanceAdvice>")));
check("JSON payment object", () => single(attachment("avis.json",JSON.stringify(json),"application/json")));
check("JSON amount in minor units", () => single(attachment("avis.json",JSON.stringify({type:"Remittance advice",payment:{amount:{value:120030,exponent:2,currency:"EUR"}}}))));
check("JSON two separately identified payments", () => several(attachment("avis.json",JSON.stringify({type:"Remittance advice",payments:[{payment_id:"PAY1",amount:1200.3,currency:"EUR"},{payment_id:"PAY2",amount:5632.21,currency:"EUR"}]}))));
check("JSON truncated second value", () => review(attachment("avis.json",JSON.stringify(json).slice(0,-1)+',"second":')));
check("RTF paragraphs", () => single(attachment("avis.rtf",rtf,"application/rtf")));
check("RTF Unicode currency", () => single(attachment("avis.rtf",rtf.replace("EUR","\\u8364?"))));
check("RTF deleted amount excluded", () => single(attachment("avis.rtf",rtf.slice(0,-1)+"{\\deleted Zahlbetrag: 9.999,99 EUR\\par}}")));
check("RTF escaped braces are text", () => single(attachment("avis.rtf",rtf.replace("Zahlungsavis","Zahlungsavis \\{Kopie\\}"))));
check("RTF unclosed group cannot approve first amount", () => review(attachment("avis.rtf",rtf.slice(0,-1)+"{")));
check("RTF extra closing group", () => review(attachment("avis.rtf",rtf+"}")));
check("RTF truncated binary field", () => review(attachment("avis.rtf",rtf.slice(0,-1)+"{\\pict\\bin100 abc}")));
check("RTF incomplete hex escape", () => review(attachment("avis.rtf",rtf.slice(0,-1)+"\\'4}")));
check("HTML rich text amount", () => single(attachment("avis.html",html,"text/html")));
check("HTML numeric entities", () => single(attachment("avis.html",html.replace("1.200,30","1&#46;200&#44;30"),"text/html")));
check("HTML script and style amounts excluded", () => single(attachment("avis.html",html.replace("</body>","<script>Zahlbetrag: 9.999,99 EUR</script><style>Zahlbetrag: 8.888,88 EUR</style></body>"),"text/html")));

const inner = Buffer.from(eml({body:textAdvice("1.200,30")}),"base64");
const innerPdf = Buffer.from(eml({attachments:[{name:"avis.pdf",type:"application/pdf",text:pdf(textAdvice("1.200,30"))}]}),"base64");
check("attached EML body preserves correct amount for review", () => single(attachment("avis.eml",inner,"message/rfc822"),1200.3,false));
check("attached EML with actual PDF", () => single(attachment("avis.eml",innerPdf,"message/rfc822")));
check("empty attached EML is not silently ignored", () => review(attachment("avis.eml","","message/rfc822")));
check("attached EML with missing multipart body", () => review(attachment("avis.eml","From: kunde@example.org\r\nSubject: Zahlungsavis\r\nContent-Type: multipart/mixed; boundary=lost\r\n\r\n","message/rfc822")));
check("attached MSG actual CFB mini streams", () => single(attachment("avis.msg",msg("Zahlungsavis",textAdvice("1.200,30")),"application/vnd.ms-outlook"),1200.3,false));
check("MSG truncated declared body stream is not silently ignored", () => review(attachment("avis.msg",msg("Zahlungsavis",textAdvice("1.200,30"),{brokenBodyChain:true}),"application/vnd.ms-outlook")));
check("MSG cyclic mini chain cannot repeat a partial body", () => {
  const data=msg("Zahlungsavis",textAdvice("1.200,30"));
  const bodyStart=data.readUInt32LE(512+3*128+116);
  const miniFat=(data.readUInt32LE(0x3c)+1)*512;
  data.writeUInt32LE(bodyStart,miniFat+bodyStart*4);
  review(attachment("avis.msg",data,"application/vnd.ms-outlook"));
});
check("MSG truncated CFB header", () => review(attachment("avis.msg",msg("Zahlungsavis",textAdvice("1.200,30")).subarray(0,200),"application/vnd.ms-outlook")));
// CMS SignedData is structurally real, with no signer. These cases do not claim signature verification.
check("CMS encapsulated EML body", () => single(attachment("smime.p7m",cmsSigned(inner),"application/pkcs7-mime"),1200.3,false));
check("CMS encapsulated EML with PDF", () => single(attachment("smime.p7m",cmsSigned(innerPdf),"application/pkcs7-mime")));
check("CMS truncated ASN.1 content", () => review(attachment("smime.p7m",cmsSigned(inner).subarray(0,300),"application/pkcs7-mime")));
check("direct CMS truncated ASN.1 content", () => review(main(cmsSigned(inner).subarray(0,300).toString("base64"))));
check("empty declared S/MIME content", () => review(attachment("smime.p7m",Buffer.alloc(0),"application/pkcs7-mime")));
check("S/MIME encryption indicator", () => review(attachment("smime.p7m",Buffer.from("300f06092a864886f70d010703a0023000","hex"),"application/pkcs7-mime; smime-type=enveloped-data")));

check("generic ZIP is an unsupported document for review", () => review(attachment("avis.zip",zip([{name:"avis.txt",data:textAdvice("1.200,30")}]))));
check("DOCX package remains unsupported", () => review(attachment("avis.docx",zip([{name:"[Content_Types].xml",data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},{name:"word/document.xml",data:'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Zahlungsavis Zahlbetrag 1.200,30 EUR</w:t></w:r></w:p></w:body></w:document>'}]))));
check("old XLS binary marker is not guessed as text", () => review(attachment("avis.xls",Buffer.from("d0cf11e0a1b11ae1","hex"))));
check("file named PDF without PDF data", () => review(attachment("avis.pdf",Buffer.from("broken payment file"),"application/pdf")));

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exitCode=1;
}
console.log(`${tests} format safety checks passed${failures.length ? `, ${failures.length} failed` : ""}`);
