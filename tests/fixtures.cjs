const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { stripTypeScriptTypes } = require("node:module");
function load() {
  const ctx = vm.createContext({});
  vm.runInContext(
    stripTypeScriptTypes(
      fs.readFileSync(path.join(__dirname, "../dist/AvisV2.ts"), "utf8"),
    ),
    ctx,
  );
  return ctx;
}
function eml({
  body = "",
  subject = "Abrechnung Oktober",
  attachments = [],
  keywords = "",
}) {
  let s = `From: Kunde <kunde@example.org>\r\nTo: avis@firma.de\r\nDate: Sat, 31 Oct 2026 09:00:00 +0100\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\n${keywords ? "Keywords: " + keywords + "\r\n" : ""}Content-Type: multipart/mixed; boundary="avis-boundary"\r\n\r\n`;
  const part = (type, text, name) =>
    `--avis-boundary\r\nContent-Type: ${type}${name ? '; name="' + name + '"' : ""}\r\nContent-Transfer-Encoding: base64\r\n${name ? 'Content-Disposition: attachment; filename="' + name + '"\r\n' : ""}\r\n${Buffer.from(text).toString("base64")}\r\n`;
  s += part("text/plain; charset=utf-8", body);
  for (const a of attachments)
    s += part(a.type || "text/plain; charset=utf-8", a.text, a.name);
  return Buffer.from(s + "--avis-boundary--\r\n").toString("base64");
}
const textAdvice = (amount, cur = "EUR") =>
  `Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: ${amount} ${cur}\nMit freundlichen Gruessen`;
function pdf(text) {
  const esc = (s) => s.replace(/([\\()])/g, "\\$1");
  const stream =
    "BT /F1 12 Tf " +
    text
      .split("\n")
      .map((s, i) => `1 0 0 1 72 ${760 - i * 22} Tm (${esc(s)}) Tj`)
      .join("\n") +
    " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((s, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${s}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((x) => String(x).padStart(10, "0") + " 00000 n \n")
      .join("");
  return (
    out +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  );
}
const csv = `Zahlungsavis\nZahlungsnummer;Rechnungsnummer;Zahlbetrag;Waehrung\nPAY101;RE100;1.000,00;EUR\nPAY101;RE101;200,30;EUR\nPAY102;RE102;5.632,21;EUR\nPAY103;RE103;500,42;EUR`;
const fixtures = {
  two: {
    attachments: [
      { name: "avis1.txt", text: textAdvice("1.200,30") },
      { name: "avis2.txt", text: textAdvice("5.632,21") },
    ],
  },
  three: {
    attachments: [
      { name: "avis1.txt", text: textAdvice("1.200,30") },
      { name: "avis2.txt", text: textAdvice("5.632,21") },
      { name: "avis3.txt", text: textAdvice("500,42") },
    ],
  },
  stated: {
    body: "Zahlungsavis\nWir haben heute drei separate Zahlungen an Sie ueberwiesen.\nZahlung 1: 1.200,30 EUR\nZahlung 2: 5.632,21 EUR\nZahlung 3: 500,42 EUR",
  },
  numbered: {
    body: "Zahlungsavis\nZahlung 1 von 3\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 1.200,30 EUR\nZahlung 2 von 3\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 5.632,21 EUR\nZahlung 3 von 3\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 500,42 EUR",
  },
  csv: {
    attachments: [
      { name: "avis.csv", type: "text/csv; charset=utf-8", text: csv },
    ],
  },
};
fixtures.pdf = {
  attachments: [
    {
      name: "avis1.pdf",
      type: "application/pdf",
      text: pdf(textAdvice("1.200,30")),
    },
    {
      name: "avis2.pdf",
      type: "application/pdf",
      text: pdf(textAdvice("5.632,21")),
    },
  ],
};
fixtures.pdfParts = {
  attachments: [
    {
      name: "avis.pdf",
      type: "application/pdf",
      text: pdf(fixtures.numbered.body),
    },
  ],
};
module.exports = { load, eml, textAdvice, fixtures, pdf };
