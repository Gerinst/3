const assert = require("node:assert/strict");
const vm = require("node:vm");
const { load, eml, pdf } = require("./fixtures.cjs");

const ctx = load();
const failures = [];
let passed = 0;
let lastResult;

function check(name, fn) {
  try {
    lastResult = undefined;
    fn();
    passed++;
  } catch (error) {
    failures.push({ name, error: error.message, actual: lastResult && {
      verdict: lastResult.verdict,
      confidence: lastResult.confidence,
      category: lastResult.category,
      newSubject: lastResult.newSubject,
      amounts: Array.from(lastResult.paymentAmounts),
      documents: Array.from(lastResult.documents),
    } });
  }
}

function amount(cents) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return sign + String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    "," + String(absolute % 100).padStart(2, "0");
}

function advice(cents, reference = "", currency = "EUR") {
  return "Zahlungsavis\n" + (reference ? `Zahlungsnummer ${reference}\n` : "") +
    `Wir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: ${amount(cents)} ${currency}\nMit freundlichen Gruessen`;
}

function attachment(text, name = "avis.pdf", type = "pdf") {
  return {
    name,
    type: type === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
    text: type === "pdf" ? pdf(text) : text,
  };
}

function run(input) {
  ctx.encodedSafetyMail = eml({ subject: "Abrechnung", ...input });
  lastResult = vm.runInContext("main({}, encodedSafetyMail)", ctx, { timeout: 2000 });
  return lastResult;
}

function noUpdates(result) {
  assert.equal(result.needsReview, true, "uncertain mail must require review");
  for (const key of ["category", "subjectPrefix", "newSubject", "patchSubject", "patchCategory"]) {
    assert.equal(result[key], "", `review must leave ${key} empty`);
  }
}

function exactPayments(result, cents, currencies = cents.map(() => "EUR"), ordered = true) {
  assert.equal(result.confidence, "high");
  assert.equal(result.category, "Avis");
  assert.equal(result.needsReview, false);
  const expected = cents.map((value, i) => `${amount(value)} ${currencies[i]}`);
  const actual = result.verdict === "several" ? Array.from(result.paymentAmounts) :
    [`${amount(Math.round(result.amountNumber * 100))} ${result.currency}`];
  assert.deepEqual(ordered ? actual : actual.slice().sort(), ordered ? expected : expected.slice().sort(),
    "automatic processing must retain every expected payment occurrence and cent");
  assert.equal(result.subjectPrefix, actual.map(value => value.replace(/ [A-Z]{3}$/, "")).join(" + ") + " ");
  assert.deepEqual(JSON.parse(result.patchCategory), { categories: ["Avis"] });
}

function blocks(cents) {
  return "Zahlungsavis\n" + cents.map((value, i) =>
    `Zahlung ${i + 1} von ${cents.length}\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: ${amount(value)} EUR`
  ).join("\n");
}

const values = [120030, 563221, 50042];
const pair = values.slice(0, 2);
const base = pair.map((value, i) => attachment(advice(value), `avis${i + 1}.pdf`));
const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

for (const type of ["pdf", "text"]) {
  for (const order of permutations) {
    const expected = order.map(i => values[i]);
    const attachments = order.map(i => attachment(advice(values[i]), `avis${i}.${type}`, type));
    check(`${type} preserves order ${order}`, () => {
      const result = run({ attachments });
      exactPayments(result, expected);
      assert.equal(result.newSubject, expected.map(amount).join(" + ") + " Abrechnung");
    });
    check(`${type} repeated run is idempotent ${order}`, () => {
      const first = run({ attachments });
      const second = run({ attachments: attachments.slice().reverse(), subject: "AW: " + first.newSubject });
      exactPayments(second, expected.slice().reverse());
      assert.equal(second.newSubject, "");
      assert.equal(second.patchSubject, "");
    });
  }
}

for (const cents of [[120030, 120031], [99999, 100001], [123456789, 50042]]) {
  check(`near and large amounts retain exact cents ${cents}`, () => {
    exactPayments(run({ attachments: cents.map((value, i) => attachment(advice(value), `avis${i}.pdf`)) }), cents);
  });
}

for (const type of ["pdf", "text"]) {
  for (const cents of [[120030, 120030], [120030, 563221, 120030]]) {
    check(`${type} equal explicitly numbered payments ${cents}`, () => {
      exactPayments(run({ attachments: [attachment(blocks(cents), `avis.${type}`, type)] }), cents);
    });
  }
  check(`${type} distinct payment references keep equal amounts`, () => {
    exactPayments(run({ attachments: [
      attachment(advice(120030, "PAY1001"), `avis1.${type}`, type),
      attachment(advice(120030, "PAY1002"), `avis2.${type}`, type),
    ] }), [120030, 120030]);
  });
  check(`${type} same reference copy counts once beside another payment`, () => {
    exactPayments(run({ attachments: [
      attachment(advice(120030, "PAY1001"), `avis1.${type}`, type),
      attachment(advice(563221, "PAY1002"), `avis2.${type}`, type),
      attachment(advice(120030, "PAY1001") + "\nKopie", `kopie.${type}`, type),
    ] }), pair);
  });
}

check("two distinct equal payments and a third amount keep all occurrences", () => {
  exactPayments(run({ attachments: [
    attachment(advice(120030, "PAY1001")),
    attachment(advice(120030, "PAY1002"), "avis2.pdf"),
    attachment(advice(563221, "PAY1003"), "avis3.pdf"),
  ] }), [120030, 120030, 563221]);
});

check("same payment reference with conflicting amounts requires review", () => {
  noUpdates(run({ attachments: [
    attachment(advice(120030, "PAY1001")),
    attachment(advice(130030, "PAY1001"), "replacement.pdf"),
  ] }));
});

// Archived sm_two_pdfs_conflict used the same advice number and invoice rows,
// changing only the total. A space before "Nr." must not hide that identity.
const numberedAdvice = (total, id = "4711") =>
  `Zahlungsavis Nr. ${id} vom 01.10.2026\n` +
  "RE-2026-0917   1.000,00   20,00   980,00\n" +
  "RE-2026-0931   2.500,00   26,00   2.474,00\n" +
  `Zahlbetrag: ${total} EUR`;
for (const type of ["pdf", "text"]) {
  check(`${type} same spaced advice number with conflicting totals requires review`, () => {
    noUpdates(run({ attachments: [
      attachment(numberedAdvice("3.454,00"), `first.${type}`, type),
      attachment(numberedAdvice("1.250,00"), `changed.${type}`, type),
    ] }));
  });
}
check("same spaced advice number and amount is one copy", () => {
  exactPayments(run({ attachments: [
    attachment(numberedAdvice("3.454,00"), "first.pdf"),
    attachment(numberedAdvice("3.454,00") + "\nKopie", "copy.pdf"),
  ] }), [345400]);
});
check("distinct spaced advice numbers preserve equal separate payments", () => {
  exactPayments(run({ attachments: [
    attachment(numberedAdvice("3.454,00", "4711"), "first.pdf"),
    attachment(numberedAdvice("3.454,00", "4712"), "second.pdf"),
  ] }), [345400, 345400]);
});

check("explicit extra same amount beside a multi-payment PDF requires review", () => {
  const result = run({ attachments: [attachment(blocks(values))],
    body: "Zusätzlich haben wir heute weitere 1.200,30 EUR an Sie überwiesen." });
  noUpdates(result);
  assert.deepEqual(Array.from(result.paymentAmounts), [...values, 120030].map(value => amount(value) + " EUR"));
});

check("a new reference cannot silently collapse into an unidentified multi-payment PDF", () => {
  noUpdates(run({ attachments: [attachment(blocks(values)),
    attachment(advice(120030, "PAY9999"), "extra.pdf")] }));
});

const referencedList = "Zahlungsavis\n" + pair.map((value, i) =>
  `Zahlungsnummer PAY100${i + 1}\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: ${amount(value)} EUR`
).join("\n");

check("a reference alone cannot prove which amount in a mixed multi-payment list it identifies", () => {
  noUpdates(run({ attachments: [attachment(referencedList),
    attachment(advice(120030, "PAY1001"), "copy.pdf")] }));
});

check("a repeated reference cannot be assigned another amount from the same multi-payment list", () => {
  noUpdates(run({ attachments: [attachment(referencedList),
    attachment(advice(563221, "PAY1001"), "conflict.pdf")] }));
});

check("separate multi-payment references must not collapse matching amount lists", () => {
  noUpdates(run({ attachments: [attachment(referencedList),
    attachment(referencedList.replaceAll("PAY100", "PAY200"), "other-payments.pdf")] }));
});

check("swapping amount assignments under existing references requires review", () => {
  noUpdates(run({ attachments: [attachment(referencedList), attachment(
    referencedList.replace("1.200,30", "SWAP").replace("5.632,21", "1.200,30").replace("SWAP", "5.632,21"),
    "changed-payments.pdf")] }));
});

check("a new reference beside an identified list retains an equal new payment", () => {
  exactPayments(run({ attachments: [attachment(referencedList),
    attachment(advice(120030, "PAY1003"), "extra.pdf")] }), [...pair, 120030]);
});

check("an identified list appearing after its extra payment retains every occurrence", () => {
  exactPayments(run({ attachments: [attachment(advice(120030, "PAY1003"), "extra.pdf"),
    attachment(referencedList)] }), [120030, ...pair]);
});

check("a weaker duplicate cannot lower independently confirmed payment identities", () => {
  exactPayments(run({ attachments: [
    attachment(advice(120030, "PAY1001")),
    attachment(advice(120030, "PAY1002"), "second.pdf"),
    attachment("Zahlungsavis\nZahlungsnummer PAY1002\nWir haben Ihre Rechnungen heute bezahlt.\nBetrag: 1.200,30 EUR", "copy.pdf"),
  ] }), [120030, 120030]);
});

check("the same reference with conflicting currencies requires review", () => {
  noUpdates(run({ attachments: [
    attachment(advice(120030, "PAY1001", "EUR")),
    attachment(advice(120030, "PAY1001", "USD"), "currency-correction.pdf"),
  ] }));
});

check("mixed PDF and text sources keep the complete amount multiset", () => {
  exactPayments(run({ attachments: [
    attachment(advice(50042), "avis.txt", "text"), ...base,
  ] }), values, undefined, false);
});

for (const body of [
  "Anbei unsere Zahlungsavise. Wir haben insgesamt 6.832,51 EUR überwiesen.",
  "Attached are the two remittance advices. The total actually paid is EUR 6,832.51.",
  advice(120030),
  "Attached are the remittance advices. Amount paid: EUR 1,200.30.",
]) {
  check(`cover echo adds no payment: ${body}`, () => exactPayments(run({ attachments: base, body }), pair));
}

for (const body of [
  "Zusätzlich zu den angehängten Zahlungsavisen haben wir heute separat 6.832,51 EUR überwiesen.",
  "In addition to the attached remittances we have transferred EUR 500.42 to you today.",
  "Zusätzlich haben wir heute weitere 1.200,30 EUR an Sie überwiesen.",
]) {
  check(`unconfirmed extra body payment requires review: ${body}`, () => noUpdates(run({ attachments: base, body })));
}

for (const body of [
  "Anbei die beiden Zahlungsavise. Abweichend davon wurden heute nur 1.000,00 EUR überwiesen.",
  "Insgesamt haben wir statt der avisierten Beträge 1.000,00 EUR überwiesen.",
  "Die beiden beigefügten Avise wurden noch nicht ausgeführt. Bisher haben wir lediglich 1.000,00 EUR gezahlt.",
  "We have only transferred EUR 1,000.00 today; the remainder of the attached remittances is still outstanding.",
  "Please disregard the attached remittance amounts. The amount actually transferred was EUR 1,000.00.",
  "Correction: only EUR 1,000.00 has been paid; the remaining balance is on hold.",
  "Anbei unsere Zahlungsavise. Tatsächlich überwiesen wurden insgesamt 1.000,00 EUR.",
]) {
  for (const attachments of [base, [attachment(blocks(pair))]]) {
    check(`contradicting cover note requires review (${attachments.length} PDFs): ${body}`, () => {
      noUpdates(run({ attachments, body }));
    });
  }
}

for (const name of ["avis3.pdf", "document.pdf", ""]) {
  for (const valid of [base, base.slice(0, 1)]) {
    for (const content of ["%PDF-1.4\n%%EOF", ""]) {
      check(`unreadable ${name || "unnamed"} beside ${valid.length} readable advice(s), bytes=${content.length}`, () => {
        noUpdates(run({ attachments: [...valid, { name, type: "application/pdf", text: content }] }));
      });
    }
  }
}

for (const text of [
  "Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 500 EUR",
  "Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nBetrag: 500,42 EUR",
  "Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: unlesbar",
  "Zahlungsavis\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 999.999.999.999.999,99 EUR",
  "Zahlungsavis\nWir haben 500,42 EUR als Teilzahlung überwiesen. Der Rest ist noch offen.",
  blocks(pair).replace("Zahlung 2 von 2", "Zahlung 2 von 3") + "\nZahlung 3 von 3\nZahlbetrag: unlesbar",
]) {
  check(`uncertain third source cannot be silently dropped: ${text}`, () => {
    noUpdates(run({ attachments: [...base, attachment(text, "avis3.pdf")] }));
  });
}

check("unlabelled CSV row sum cannot certify a new third payment", () => {
  noUpdates(run({ attachments: [...base, {
    name: "avis3.csv", type: "text/csv; charset=utf-8",
    text: "Zahlungsavis\nZahlungsnummer;Rechnungsnummer;Zahlbetrag;Waehrung\nPAY1003;RE500;300,00;EUR\nPAY1003;RE501;200,42;EUR",
  }] }));
});

check("same amount in distinct currencies remains two payments", () => {
  exactPayments(run({ attachments: [
    attachment(advice(120030, "", "EUR"), "euro.pdf"),
    attachment(advice(120030, "", "USD"), "dollar.pdf"),
  ] }), [120030, 120030], ["EUR", "USD"]);
});

for (const text of [
  "Remittance advice\nWe have not paid this invoice.\nNo transfer has been executed.\nPayment amount: EUR 1,200.30",
  "CANCELLED remittance advice\nThis payment instruction was cancelled before execution.\nNo funds were transferred.\nPayment amount: EUR 1,200.30",
  "Remittance advice\nWe have paid your invoices today.\nTotal paid: EUR 1,200.30\nPayment currency: USD",
]) {
  for (const count of [1, 2]) {
    check(`equal amount cannot hide contradictory source beside ${count} safe advice(s): ${text}`, () => {
      noUpdates(run({ attachments: [...base.slice(0, count), attachment(text, "conflict.pdf")] }));
    });
  }
}

check("an unrelated attachment does not invalidate complete advices", () => {
  exactPayments(run({ attachments: [...base, attachment("Vielen Dank für die Zusammenarbeit. Unsere neue Anschrift lautet Hauptstrasse 17.", "adresse.txt", "text")] }), pair);
});

for (const failure of failures) console.error(JSON.stringify(failure));
console.log(`PASS: ${passed} multiple-advice safety checks; FAIL: ${failures.length}.`);
if (failures.length) process.exitCode = 1;
