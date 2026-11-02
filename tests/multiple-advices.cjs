const assert = require("node:assert/strict");
const vm = require("node:vm");
const { load, eml, textAdvice, fixtures, pdf } = require("./fixtures.cjs");
const ctx = load();
let count = 0;
function check(name, fn) {
  try {
    fn();
    count++;
  } catch (e) {
    e.message = name + ": " + e.message;
    throw e;
  }
}
const run = (args) => ctx.main({}, eml(args));
const arr = (x) => Array.from(x);
const two = "1.200,30 + 5.632,21";
const three = two + " + 500,42";
function multiple(args, prefix, amounts) {
  const r = run(args);
  assert.equal(r.verdict, "several", r.verdictWhy);
  assert.equal(r.category, "Avis");
  assert.equal(r.subjectPrefix, prefix + " ");
  assert.equal(
    r.newSubject,
    prefix +
      (args.subject === "" ? "" : " " + (args.subject || "Abrechnung Oktober")),
  );
  assert.deepEqual(JSON.parse(r.patchSubject), { subject: r.newSubject });
  assert.deepEqual(JSON.parse(r.patchCategory), { categories: ["Avis"] });
  if (amounts) assert.deepEqual(arr(r.paymentAmounts), amounts);
  return r;
}
for (const name of ["two", "pdf"])
  check(name, () =>
    multiple(fixtures[name], two, ["1.200,30 EUR", "5.632,21 EUR"]),
  );
for (const name of ["three", "stated", "numbered", "csv", "pdfParts"])
  check(name, () =>
    multiple(fixtures[name], three, [
      "1.200,30 EUR",
      "5.632,21 EUR",
      "500,42 EUR",
    ]),
  );
check("empty original subject", () =>
  multiple({ ...fixtures.three, subject: "" }, three),
);
check("preserve arbitrary original subject", () =>
  multiple(
    { ...fixtures.two, subject: "WG: Abrechnung 4711 - Rückfrage?" },
    two,
  ),
);
check("duplicate attachment counted once", () =>
  multiple(
    {
      attachments: [
        ...fixtures.two.attachments,
        { name: "avis-kopie.txt", text: textAdvice("1.200,30") },
      ],
    },
    two,
  ),
);
check("several document plus separate advice", () =>
  multiple(
    {
      attachments: [
        ...fixtures.pdfParts.attachments,
        {
          name: "avis4.pdf",
          type: "application/pdf",
          text: pdf(textAdvice("700,17")),
        },
      ],
    },
    three + " + 700,17",
  ),
);
check("two several documents contribute", () =>
  multiple(
    {
      attachments: [
        ...fixtures.pdfParts.attachments,
        {
          name: "avis-weitere.txt",
          text: "Zahlungsavis\nZahlung 1 von 2\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 700,17 EUR\nZahlung 2 von 2\nWir haben Ihre Rechnungen heute bezahlt.\nZahlbetrag: 800,23 EUR",
        },
      ],
    },
    three + " + 700,17 + 800,23",
  ),
);
check("several document duplicate copy counted once", () =>
  multiple(
    {
      attachments: [
        ...fixtures.pdfParts.attachments,
        { ...fixtures.pdfParts.attachments[0], name: "avis-kopie.pdf" },
      ],
    },
    three,
  ),
);
check("cover note aggregate is not another payment", () =>
  multiple(
    {
      ...fixtures.pdfParts,
      body: "Anbei unsere Zahlungsavise. Wir haben insgesamt 7.332,93 EUR überwiesen.",
    },
    three,
  ),
);
check("explicit extra payment equal to aggregate is retained", () =>
  multiple(
    {
      ...fixtures.pdfParts,
      body: "Zusätzlich zu den angehängten Zahlungsavisen haben wir heute separat 7.332,93 EUR überwiesen.",
    },
    three + " + 7.332,93",
  ),
);
check("same value different currencies remain separate", () =>
  multiple(
    {
      attachments: [
        { name: "euro.txt", text: textAdvice("1.200,30", "EUR") },
        { name: "dollar.txt", text: textAdvice("1.200,30", "USD") },
      ],
    },
    "1.200,30 + 1.200,30",
    ["1.200,30 EUR", "1.200,30 USD"],
  ),
);
for (const subject of [
  three + " Abrechnung Oktober",
  "AW: " + three + " Abrechnung Oktober",
  "WG: AW: " + three + " Abrechnung Oktober",
  "500,42 + 1.200,30 + 5.632,21 Abrechnung Oktober",
])
  check("idempotent " + subject, () => {
    const r = run({ ...fixtures.three, subject });
    assert.equal(r.category, "Avis");
    assert.equal(r.newSubject, "");
    assert.equal(r.patchSubject, "");
  });
check("changed second amount does not match first only", () => {
  const subject = "1.200,30 + 8.888,88 Abrechnung Oktober";
  const r = run({ ...fixtures.two, subject });
  assert.equal(r.newSubject, two + " " + subject);
});
check("list multiplicity matters", () => {
  const subject = "1.200,30 + 5.632,21 + 5.632,21 Abrechnung Oktober";
  const r = run({ ...fixtures.two, subject });
  assert.equal(r.newSubject, two + " " + subject);
});
check("single prefix is not a multiple prefix", () => {
  const subject = "1.200,30 Abrechnung Oktober";
  const r = run({ ...fixtures.two, subject });
  assert.equal(r.newSubject, two + " " + subject);
});
check("legacy currency prefix is not a multiple prefix", () => {
  const subject = "1.200,30 EUR - Abrechnung Oktober";
  const r = run({ ...fixtures.two, subject });
  assert.equal(r.newSubject, two + " " + subject);
});
check("current multi prefix takes precedence over legacy suffix", () => {
  const subject = two + " Abrechnung Oktober - 1.200,30 EUR";
  const r = run({ ...fixtures.two, subject });
  assert.equal(r.newSubject, "");
  assert.equal(r.patchSubject, "");
});
check("legacy suffix cannot hide changed current multi list", () => {
  const subject = "1.200,30 + 8.888,88 Abrechnung Oktober - 1.200,30 EUR";
  const r = run({ ...fixtures.two, subject });
  assert.equal(r.newSubject, two + " " + subject);
});
check("single result not suppressed by multi prefix first amount", () => {
  const subject = two + " Abrechnung Oktober";
  const r = run({ attachments: [fixtures.two.attachments[0]], subject });
  assert.equal(r.newSubject, "1.200,30 " + subject);
  assert.equal(r.category, "Avis");
});
check(
  "single result not suppressed by matching legacy suffix below multi list",
  () => {
    const subject = two + " Abrechnung Oktober - 1.200,30 EUR";
    const r = run({ attachments: [fixtures.two.attachments[0]], subject });
    assert.equal(r.newSubject, "1.200,30 " + subject);
  },
);
check(
  "legacy multiple category replaced and unrelated categories preserved",
  () => {
    const r = run({
      ...fixtures.two,
      keywords: "Wichtig, mehrere Avise, WICHTIG, Intern",
    });
    assert.deepEqual(JSON.parse(r.patchCategory), {
      categories: ["Wichtig", "Intern", "Avis"],
    });
  },
);
check("normal single advice unchanged", () => {
  const r = run({ attachments: [fixtures.two.attachments[0]] });
  assert.equal(r.verdict, "advice");
  assert.equal(r.category, "Avis");
  assert.equal(r.newSubject, "1.200,30 Abrechnung Oktober");
});
check("legacy single prefix remains idempotent", () => {
  const r = run({
    attachments: [fixtures.two.attachments[0]],
    subject: "AW: 1.200,30 EUR - Abrechnung Oktober",
  });
  assert.equal(r.newSubject, "");
  assert.equal(r.patchSubject, "");
});
check("invoice is unchanged", () => {
  const r = run({
    subject: "Rechnung",
    body: "Rechnung 4711\nGesamtbetrag: 1.200,30 EUR\nBitte ueberweisen Sie den Betrag bis 15.11.2026.",
  });
  assert.equal(r.verdict, "other");
  assert.equal(r.patchCategory, "");
  assert.equal(r.patchSubject, "");
});
const tables = {
  dates:
    "Zahlungsavis\nZahlungsdatum;Rechnungsnummer;Zahlbetrag;Currency\n30.10.2026;RE100;1.000,00;EUR\n30.10.2026;RE101;200,30;EUR\n31.10.2026;RE102;5.632,21;EUR",
  blocks:
    "Zahlungsavis\nRechnungsnummer;Zahlbetrag;Currency\nRE100;1.000,00;EUR\nRE101;200,30;EUR\nSumme Zahlung 1;1.200,30;EUR\nRE102;5.632,21;EUR\nSumme Zahlung 2;5.632,21;EUR",
  mixed:
    "Zahlungsavis\nRechnungsnummer;Zahlbetrag;Currency\nRE100;1.000,00;EUR\nRE101;200,30;EUR\nRE102;5.632,21;USD",
  repeated:
    "Remittance advice\nPayment Number;Invoice Number;Payment Amount;Amount Paid;Currency\nPAY101;RE100;1200.30;1000.00;EUR\nPAY101;RE101;1200.30;200.30;EUR\nPAY102;RE102;5632.21;5000.00;EUR\nPAY102;RE103;5632.21;632.21;EUR",
  blankIds:
    "Zahlungsavis\nZahlungsnummer;Rechnungsnummer;Zahlbetrag;Currency\nPAY101;RE100;1.000,00;EUR\n;RE101;200,30;EUR\nPAY102;RE102;5.632,21;EUR",
  negativeRows:
    "Zahlungsavis\nZahlungsnummer;Rechnungsnummer;Zahlbetrag;Currency\nPAY101;RE100;1.500,30;EUR\nPAY101;GS101;-300,00;EUR\nPAY102;RE102;5.632,21;EUR",
  sameTotals:
    "Zahlungsavis\nZahlungsnummer;Rechnungsnummer;Zahlbetrag;Currency\nPAY101;RE100;1.000,00;EUR\nPAY101;RE101;200,30;EUR\nPAY102;RE102;1.200,30;EUR",
};
for (const [name, text] of Object.entries(tables))
  check("CSV " + name, () =>
    multiple(
      {
        attachments: [
          { name: "avis.csv", type: "text/csv; charset=utf-8", text },
        ],
      },
      name === "sameTotals" ? "1.200,30 + 1.200,30" : two,
    ),
  );
check("equal payment multiplicity survives duplicate table", () => {
  const a = {
    name: "avis.csv",
    type: "text/csv; charset=utf-8",
    text: tables.sameTotals,
  };
  multiple(
    { attachments: [a, { ...a, name: "avis-kopie.csv" }] },
    "1.200,30 + 1.200,30",
  );
});
check("grand total is not an extra payment", () =>
  multiple(
    {
      attachments: [
        {
          name: "avis.pdf",
          type: "application/pdf",
          text: pdf(
            fixtures.numbered.body + "\nSumme der Zahlungen: 7.332,93 EUR",
          ),
        },
      ],
    },
    three,
  ),
);
check("unclosed payment block prevents partial subject", () => {
  const text = tables.blocks + "\nRE103;500,42;EUR";
  const r = run({
    attachments: [{ name: "avis.csv", type: "text/csv; charset=utf-8", text }],
  });
  assert.equal(r.category, "Avis prüfen");
  assert.equal(r.newSubject, "");
});
check("unmatched earlier block prevents partial subject", () => {
  const text =
    tables.blocks.replace(
      "Summe Zahlung 1;1.200,30;EUR",
      "Summe Zahlung 1;1.300,30;EUR",
    ) + "\nRE103;500,42;EUR\nSumme Zahlung 3;500,42;EUR";
  const r = run({
    attachments: [{ name: "avis.csv", type: "text/csv; charset=utf-8", text }],
  });
  assert.equal(r.category, "Avis prüfen");
  assert.equal(r.newSubject, "");
});
check("unreadable third numbered payment prevents partial subject", () => {
  const body = fixtures.numbered.body.replace(
    "Zahlbetrag: 500,42 EUR",
    "Zahlbetrag: Betrag nicht lesbar",
  );
  const r = run({ body });
  assert.equal(r.category, "Avis prüfen");
  assert.equal(r.newSubject, "");
});
for (const values of [
  [],
  ["garbage"],
  ["1.200,30 EUR"],
  ["1.200,30 EUR", "1.000.000.000.000,00 EUR"],
])
  check("invalid/incomplete amounts " + values.join(","), () => {
    ctx.values = values;
    const r = vm.runInContext(
      `(() => {
        const result = emptyResult();
        result.verdict = 'several';
        result.paymentAmounts = values;
        subjectFields(result, 'Abrechnung Oktober', '');
        return result;
      })()`,
      ctx,
    );
    assert.equal(r.category, "Avis prüfen");
    assert.equal(r.newSubject, "");
    assert.equal(r.patchSubject, "");
  });
check(
  "missing multiple-source amounts block partial subject from good sources",
  () => {
    const r = vm.runInContext(
      `(() => {
        const good = emptyResult();
        good.ok = true;
        good.amountNumber = 1200.3;
        good.amount = '1.200,30';
        good.currency = 'EUR';
        good.confidence = 'high';
        const goodDoc = newDoc('good.pdf', 'pdf', good);
        goodDoc.verdict = 'advice';
        const incompleteDoc = newDoc('incomplete.csv', 'csv', emptyResult());
        incompleteDoc.verdict = 'several';
        incompleteDoc.why = '2 payments';
        const result = decideMail([goodDoc, incompleteDoc], '', '');
        subjectFields(result, 'Abrechnung Oktober', '');
        return result;
      })()`,
      ctx,
    );
    assert.equal(r.category, "Avis prüfen");
    assert.equal(r.newSubject, "");
    assert.equal(r.patchSubject, "");
  },
);

// The ordinary single-advice contract must survive the new multiple-advice path.
for (const [confidence, category, marker] of [
  ["high", "Avis", ""],
  ["medium", "Avis", " (prüfen)"],
  ["low", "Avis prüfen", " ?"],
]) {
  for (const value of [1200.3, -1200.3, 0]) {
    check(`single ${confidence}, amount ${value}`, () => {
      ctx.single = { confidence, value };
      const result = vm.runInContext(
        `(() => {
        const result = emptyResult();
        result.ok = true;
        result.verdict = 'advice';
        result.amountNumber = single.value;
        result.amount = germanAmount(single.value);
        result.currency = 'EUR';
        result.confidence = single.confidence;
        subjectFields(result, 'Abrechnung Oktober', '');
        return result;
      })()`,
        ctx,
      );
      const amount =
        value === 0 ? "0,00" : value < 0 ? "-1.200,30" : "1.200,30";
      assert.equal(result.category, category);
      assert.equal(result.newSubject, amount + marker + " Abrechnung Oktober");
      assert.deepEqual(JSON.parse(result.patchCategory), {
        categories: [category],
      });
      assert.deepEqual(JSON.parse(result.patchSubject), {
        subject: result.newSubject,
      });
      assert.deepEqual(Array.from(result.paymentAmounts), []);
    });
  }
}

check(
  "inferred document currency updates all inferred payment currencies",
  () => {
    const result = vm.runInContext(
      `(() => {
    const result = emptyResult();
    result.currency = 'EUR';
    result.paymentAmounts = ['1.200,30 EUR', '5.632,21 EUR'];
    inferredPaymentCurrency(result, 'USD');
    return result;
  })()`,
      ctx,
    );
    assert.equal(result.currency, "USD");
    assert.deepEqual(Array.from(result.paymentAmounts), [
      "1.200,30 USD",
      "5.632,21 USD",
    ]);
  },
);

check(
  "inferred document currency preserves explicitly mixed payment currencies",
  () => {
    const result = vm.runInContext(
      `(() => {
    const result = emptyResult();
    result.currency = 'EUR';
    result.paymentAmounts = ['1.200,30 EUR', '5.632,21 CHF'];
    inferredPaymentCurrency(result, 'USD');
    return result;
  })()`,
      ctx,
    );
    assert.equal(result.currency, "USD");
    assert.deepEqual(Array.from(result.paymentAmounts), [
      "1.200,30 EUR",
      "5.632,21 CHF",
    ]);
  },
);

for (const usePdf of [false, true]) {
  check(`two unreadable numbered payments (${usePdf ? "PDF" : "body"})`, () => {
    const body = fixtures.numbered.body
      .replace("Zahlbetrag: 5.632,21 EUR", "Zahlbetrag: unlesbar")
      .replace("Zahlbetrag: 500,42 EUR", "Zahlbetrag: unlesbar");
    const result = run(usePdf ? {
      attachments: [{ name: "avis.pdf", type: "application/pdf", text: pdf(body) }],
    } : { body });
    assert.equal(result.category, "Avis prüfen");
    assert.equal(result.patchSubject, "");
    assert.deepEqual(arr(result.paymentAmounts), []);
  });
}

check("incomplete PDF extraction cannot write a partial payment list", () => {
  const partial = load();
  vm.runInContext(`
    const readPdf = analyzePdf;
    analyzePdf = (bytes, keywords) => {
      const result = readPdf(bytes, keywords);
      result.incomplete = true;
      return result;
    };
  `, partial);
  const result = partial.main({}, eml(fixtures.pdfParts));
  assert.equal(result.category, "Avis prüfen");
  assert.equal(result.patchSubject, "");
  assert.deepEqual(arr(result.paymentAmounts), []);
});

console.log(`PASS: ${count} multi-advice and regression checks.`);
