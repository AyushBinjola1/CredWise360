import {test} from 'node:test';
import assert from 'node:assert/strict';
import {borrower,fundLoan,payment,addDays} from './lending-helpers.mjs';

async function fresh(label) {
  const ctx=await borrower(label);
  const loan=await fundLoan(ctx.session,ctx.admin);
  const detail=(await ctx.session.get('loans/'+loan)).data;
  return {...ctx,loan,detail};
}

test('late instalments assess one penalty after the grace period and collect it first',async()=>{
  const {session,loan,detail}=await fresh('late-fee');
  const {late_fee:fee,grace_days:grace}=detail.product;
  assert.ok(fee>0,'the personal product should define a late fee');
  const first=detail.schedule[0],second=detail.schedule[1];
  // Within grace: no charge.
  const onGrace=(await payment(session,loan,'edge-grace-'+loan,{kind:'emi',payment_date:addDays(first.due_date,grace)})).data;
  assert.equal(onGrace.transaction.penalty,0);
  assert.equal(onGrace.transaction.amount,first.payment);
  // Beyond grace: exactly one fee, settled ahead of the instalment.
  const late=addDays(second.due_date,grace+10);
  const quote=(await session.post(`loans/${loan}/payoff`,{payment_date:late})).data;
  assert.equal(quote.penalties,fee);
  assert.equal(quote.next_amount,second.payment+fee);
  const paid=(await payment(session,loan,'edge-late-'+loan,{kind:'emi',payment_date:late,expected_version:quote.ledger_version})).data;
  assert.equal(paid.transaction.penalty,fee);
  assert.equal(paid.transaction.amount,second.payment+fee);
  assert.equal(paid.transaction.principal+paid.transaction.interest+paid.transaction.fee+paid.transaction.penalty,paid.transaction.amount);
  const after=(await session.get('loans/'+loan)).data;
  assert.equal(after.penalties.length,1);
  assert.equal(after.penalties[0].amount,fee);
  assert.equal(after.penalties[0].paid,fee);
  assert.equal(after.schedule[1].status,'paid');
  assert.equal(after.loan.fees_paid,fee+after.transactions.find(t=>t.kind==='disbursement').fee);
  const profile=(await session.get('profile')).data;
  assert.ok(profile.portfolio.missed>=1,'a late payment counts against repayment history');
});

test('default documentation needs ninety days of arrears, an administrator and a note',async()=>{
  const {session,admin,loan,detail}=await fresh('default');
  const due=detail.schedule[0].due_date;
  await session.request('POST',`admin/loans/${loan}/default`,{body:{note:'Trying to default myself',as_of:addDays(due,120)},status:403});
  await admin.post(`admin/loans/${loan}/default`,{note:'',as_of:addDays(due,120)},422);
  const early=await admin.request('POST',`admin/loans/${loan}/default`,{body:{note:'Too soon',as_of:addDays(due,30)},status:409});
  assert.equal(early.error.code,'no_qualifying_arrears');
  assert.equal((await session.get('loans/'+loan)).data.loan.status,'active');
  const decided=(await admin.post(`admin/loans/${loan}/default`,{note:'Instalment unpaid for more than ninety days.',as_of:addDays(due,100)})).data;
  assert.equal(decided.loan.status,'defaulted');
  assert.equal(decided.loan.defaulted_on,addDays(due,100));
  assert.match(decided.loan.default_reason,/ninety days/);
  const second=await admin.request('POST',`admin/loans/${loan}/default`,{body:{note:'Again',as_of:addDays(due,110)},status:409});
  assert.equal(second.error.code,'loan_state');
  const detailAfter=(await session.get('loans/'+loan)).data;
  assert.ok(detailAfter.penalties.length>=1,'default assessment posts late charges');
  const application=(await session.get('applications/'+detailAfter.loan.application_id)).data;
  assert.equal(application.application.status,'defaulted');
  const events=application.timeline.map(e=>e.status);
  assert.ok(events.includes('defaulted'));
  const distress=(await session.get('distress')).data;
  assert.ok(distress.indicators.some(i=>i.key==='missed_payments'&&i.level!=='ok'));
});

test('concurrent payments stay atomic, idempotent and consistent with the ledger',async()=>{
  const {session,loan,detail}=await fresh('concurrent');
  const emi=detail.schedule[0].payment;
  // The same key sent twice at once records one transaction and returns the same receipt.
  const once=()=>payment(session,loan,'edge-same-key-'+loan,{kind:'emi'}).catch(()=>payment(session,loan,'edge-same-key-'+loan,{kind:'emi'},200));
  const twin=await Promise.all([once(),once()]);
  assert.equal(twin[0].data.transaction.id,twin[1].data.transaction.id);
  let ledger=(await session.get('loans/'+loan)).data;
  assert.equal(ledger.transactions.filter(t=>t.kind==='emi').length,1);
  await payment(session,loan,'edge-same-key-'+loan,{kind:'partial',amount:100},409);
  assert.equal((await payment(session,loan,'edge-same-key-'+loan,{kind:'emi'},200)).data.transaction.id,twin[0].data.transaction.id);
  // Two different keys race on one quote: exactly one wins and the other must re-quote.
  const version=ledger.transactions.length;
  const race=await Promise.allSettled([payment(session,loan,'edge-race-a-'+loan,{kind:'emi',expected_version:version}),payment(session,loan,'edge-race-b-'+loan,{kind:'emi',expected_version:version})]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.match(race.find(r=>r.status==='rejected').reason.message,/409/);
  // Without a quote check, simultaneous instalments are serialized and each settles a different month.
  await Promise.all([payment(session,loan,'edge-free-a-'+loan,{kind:'emi'}),payment(session,loan,'edge-free-b-'+loan,{kind:'emi'})]);
  ledger=(await session.get('loans/'+loan)).data;
  const emis=ledger.transactions.filter(t=>t.kind==='emi');
  assert.equal(emis.length,4);
  assert.equal(ledger.schedule.filter(r=>r.status==='paid').length,4);
  assert.equal(emis.reduce((sum,t)=>sum+t.principal,0),ledger.loan.principal-ledger.loan.outstanding);
  assert.equal(emis.reduce((sum,t)=>sum+t.amount,0),emi*4);
  assert.equal(ledger.loan.total_paid-ledger.transactions.find(t=>t.kind==='disbursement').fee,emi*4);
});
