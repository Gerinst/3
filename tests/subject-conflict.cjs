const assert = require('node:assert/strict');
const {load,eml,pdf,textAdvice}=require('./fixtures.cjs');
const {xlsx}=require('./format-fixtures/builders.cjs');
const ctx=load();let count=0;const failures=[];
function check(name,fn){try{fn();count++;}catch(e){failures.push(name+': '+e.message);}}
function attachment(type,amount='3.454,00',currency='EUR'){
 return type==='pdf'?{name:'avis.pdf',type:'application/pdf',text:pdf(textAdvice(amount,currency))}:
 {name:'avis.xlsx',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',text:xlsx([{name:'Avis',rows:[['Zahlungsavis'],['Zahlbetrag',Number(amount.replaceAll('.','').replace(',','.')),currency]]}])};
}
function run(subject,type='pdf',amount='3.454,00',currency='EUR',extra={}){
 return ctx.main({},eml({subject,body:'Anbei unser Zahlungsavis.',attachments:[attachment(type,amount,currency)],...extra}));
}
function review(r){assert.equal(r.needsReview,true,JSON.stringify(r));assert.equal(r.confidence,'low');assert.match(r.error,/subject amount conflict/);for(const k of ['category','patchCategory','subjectPrefix','newSubject','patchSubject'])assert.equal(r[k],'',k);}
function safe(r){assert.equal(r.needsReview,false,r.error);assert.equal(r.confidence,'high',r.error);assert.equal(r.category,'Avis');}
for(const type of ['pdf','xlsx']){
 for(const subject of ['9.999,00 Zahlungsavis','9.999,00 EUR - Zahlungsavis','AW: 9.999,00 EUR - Zahlungsavis','Zahlungsavis 9.999,00','Zahlbetrag: 9999,00','Payment advice EUR 9,999.00','Payment advice 9999.00 EUR','EUR 9999 Zahlungsavis','CHF 3.454,00 Zahlungsavis','-3.454,00 Zahlungsavis','−3.454,00 Zahlungsavis','Zahlungsavis 3.454,00- EUR','Zahlungsavis Gesamtbetrag 9.999,00'])
  check(type+' conflict '+subject,()=>review(run(subject,type)));
 for(const subject of ['3.454,00 Zahlungsavis','AW: 3.454,00 EUR - Zahlungsavis','Payment advice EUR 3,454.00','Zahlbetrag: 3454,00','Zahlungsavis 3.454,00'])
  check(type+' matching '+subject,()=>safe(run(subject,type)));
 for(const subject of ['Zahlungsavis RE-2026-1234','Zahlungsavis INV-1234.56','Zahlungsavis Rechnung 1234.56','Zahlungsavis vom 29.10.2026 um 14:30','Zahlungsavis vom 12.03.','Zahlungsavis 4711','2,00 % Skonto - Zahlungsavis','24,80 kg - Zahlungsavis','8,00 h Zahlungsavis','Zahlungsavis Rechnungsbetrag: 9.999,00 EUR','Zahlungsavis Skonto: 99,00 EUR','Zahlungsavis Gegenwert: 9999 USD','12.03. Zahlungsavis','Zahlungsavis (entspricht ca. 9.999,00 USD)','Zahlungsavis invoice total 9,999.00 EUR','Zahlungsavis gross amount 9,999.00 EUR'])
  check(type+' not a conflicting payment '+subject,()=>safe(run(subject,type)));
}
check('same subject prefix unchanged',()=>assert.equal(run('3.454,00 Zahlungsavis').newSubject,''));
check('review does not add a category with existing categories',()=>review(run('9.999,00 Zahlungsavis','pdf','3.454,00','EUR',{keywords:'Wichtig, Kunde A'})));
check('nonpositive document remains an existing review case',()=>{const r=run('-3.454,00 Zahlungsavis','pdf','-3.454,00');assert.equal(r.needsReview,true);assert.equal(r.category,'');assert.doesNotMatch(r.error,/subject amount conflict/);});
check('matching amount repeated in prose is not another payment',()=>safe(run('3.454,00 Zahlungsavis - Zahlbetrag 3.454,00 EUR')));
check('foreign currency matching remains safe',()=>safe(run('CHF 3,454.00 Zahlungsavis','pdf','3.454,00','CHF')));
const two=[attachment('pdf','100,00'),{...attachment('pdf','200,00'),name:'zweites-avis.pdf'}];
const multi=subject=>ctx.main({},eml({subject,body:'Anbei zwei separate Zahlungsavise.',attachments:two}));
for(const subject of ['100,00 + 200,00 Zahlungsavise','200,00 + 100,00 Zahlungsavise','300,00 Zahlungsavise','100,00 Zahlungsavise'])check('multiple matching '+subject,()=>safe(multi(subject)));
for(const subject of ['100,00 + 999,00 Zahlungsavise','100,00 + 300,00 Zahlungsavise','100,00 + 100,00 + 200,00 Zahlungsavise','900,00 Zahlungsavise'])check('multiple conflict '+subject,()=>review(multi(subject)));
check('unrelated invoice remains untouched even with conflicting-looking subject',()=>{
 const r=ctx.main({},eml({subject:'Rechnung 9.999,00 EUR',body:'Anbei unsere Rechnung. Bitte überweisen Sie den Rechnungsbetrag bis zum Fälligkeitsdatum.',attachments:[{name:'Rechnung.pdf',type:'application/pdf',text:pdf('Rechnung\nRechnungsnummer RE-2026-4711\nRechnungsbetrag 3.454,00 EUR\nBitte überweisen Sie den Betrag innerhalb von 14 Tagen.')}]}));
 assert.equal(r.verdict,'other');assert.equal(r.needsReview,false);for(const k of ['category','newSubject','patchSubject','patchCategory'])assert.equal(r[k],'');
});
check('bare dollar does not assume USD but a different amount conflicts',()=>review(run('Payment advice $9,999.00','pdf','3.454,00','USD')));
check('explicit currency claims are matched before ambiguous values',()=>{
 const r=ctx.main({},eml({subject:'100,00 + 100,00 EUR Zahlungsavise',body:'Anbei zwei separate Zahlungsavise.',attachments:[attachment('pdf','100,00','EUR'),{...attachment('pdf','100,00','USD'),name:'usd-avis.pdf'}]}));safe(r);
});
check('long subject cannot silently bypass complete comparison',()=>{const r=run('Zahlungsavis '+ 'Text '.repeat(1800));assert.equal(r.needsReview,true);assert.equal(r.category,'');assert.match(r.error,/length limit/);});
check('direct PDF input also enforces conflict',()=>review(ctx.main({},Buffer.from(attachment('pdf').text).toString('base64'),'','9.999,00 Zahlungsavis')));
check('direct XLSX input also enforces conflict',()=>review(ctx.main({},attachment('xlsx').text.toString('base64'),'','9.999,00 Zahlungsavis')));
for(const type of ['pdf','xlsx']) {
 check(type+' English money with final full stop is not masked as a short date',()=>review(run('Payment advice EUR 12.03.',type)));
 check(type+' matching English money with final full stop remains safe',()=>safe(run('Payment advice EUR 12.03.',type,'12,03')));
 check(type+' short date without currency remains nonmonetary',()=>safe(run('12.03. Zahlungsavis',type)));
}
for(const subject of ['100,00+999,00 EUR Zahlungsavise','100,00+999,00 Zahlungsavise','100,00 +999,00 Zahlungsavise','100,00+ 999,00 Zahlungsavise','100,00+100,00+200,00 Zahlungsavise','100,00+300,00 Zahlungsavise']) {
 check('compact plus-list conflict '+subject,()=>review(multi(subject)));
}
for(const subject of ['100,00+200,00 Zahlungsavise','100,00 +200,00 Zahlungsavise','100,00+ 200,00 Zahlungsavise','100,00 EUR+200,00 EUR Zahlungsavise']) {
 check('compact plus-list matching '+subject,()=>safe(multi(subject)));
}
for(const subject of ['100,00 Zahlungsavise','300,00 Zahlungsavise','100,00+200,00 Zahlungsavise','Zahlungsavise Gesamtbetrag 300,00 EUR / total 300,00 EUR','Zahlungsavise Zahlung 100,00 EUR / Zahlbetrag 100,00 EUR']) {
 check('generated multiple prefix remains idempotent over original amount claims '+subject,()=>{
  const first=multi(subject);safe(first);assert.notEqual(first.newSubject,'');
  const second=multi(first.newSubject);safe(second);assert.equal(second.newSubject,'');assert.equal(second.patchSubject,'');
 });
}
for(const subject of ['100,00 + 200,00 999,00 Zahlungsavise','100,00 + 200,00 Zahlungsavise Gesamtbetrag 999,00 EUR','100,00 + 200,00 Zahlungsavise 100,00 EUR+300,00 EUR']) {
 check('matching prefix does not hide conflicting original subject '+subject,()=>review(multi(subject)));
}
check('independent repeated total assertions are not extra payments',()=>safe(multi('Gesamtbetrag 300,00 EUR / total 300,00 EUR')));
check('compact mixed-currency list still matches explicit currencies first',()=>{
 const r=ctx.main({},eml({subject:'100,00+100,00 EUR Zahlungsavise',body:'Anbei zwei separate Zahlungsavise.',attachments:[attachment('pdf','100,00','EUR'),{...attachment('pdf','100,00','USD'),name:'usd-avis.pdf'}]}));safe(r);
});
check('plus-separated reference numbers without money context are ignored',()=>safe(run('Zahlungsavis RE-4711+4712 vom 12.03.')));
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
console.log(`PASS: ${count} subject-conflict scenarios; ${failures.length} failures.`);
