import {test} from 'node:test';
import assert from 'node:assert/strict';
import {client,registerCustomer} from './helpers.mjs';
import {adminSession,borrower,draftAndSubmit,fundLoan,payment,proof,goodProfile} from './lending-helpers.mjs';

test('loan safety scanner reconstructs real cost, explains flags and validates input',async()=>{
  const {session}=await borrower('safety');
  const fair=(await session.post('safety/scan',{principal:10000000,months:12,advertised_rate_bps:1200,basis:'reducing',processing_fee:100000,
    late_fee:50000,prepayment_penalty_bps:100,lock_in_months:0})).data;
  assert.equal(fair.verdict,'no_major_concerns');
  assert.equal(fair.facts.net_disbursed,9900000);
  assert.ok(fair.facts.effective_annual_pct>12&&fair.facts.effective_annual_pct<15);
  assert.equal(fair.facts.total_repayment,fair.facts.payment*12);
  const predatory=(await session.post('safety/scan',{principal:5000000,months:12,advertised_rate_bps:1800,basis:'flat',processing_fee:500000,
    mandatory_charges:300000,stated_payment:520000,late_fee:200000,prepayment_penalty_bps:600,lock_in_months:18})).data;
  assert.equal(predatory.verdict,'high_concern');
  const codes=predatory.flags.map(f=>f.code);
  for(const code of ['rate_gap','flat_rate','upfront_deductions','bundled_charges','payment_mismatch','late_fee','prepayment','lock_in'])assert.ok(codes.includes(code),code);
  assert.ok(predatory.facts.effective_annual_pct>predatory.facts.advertised_rate_pct*2);
  assert.ok(predatory.flags.every(f=>f.title&&f.detail));
  assert.match(predatory.disclaimer,/do not establish/);
  assert.ok(predatory.checklist.some(c=>c.status==='fail'));
  const daily=(await session.post('safety/scan',{principal:1000000,months:6,advertised_rate_bps:2400,frequency:'daily'})).data;
  assert.ok(daily.flags.some(f=>f.code==='frequent_payments'));
  assert.ok(daily.flags.some(f=>f.code==='unclear_terms'));
  const zero=(await session.post('safety/scan',{principal:1200000,months:12,advertised_rate_bps:0,late_fee:0,prepayment_penalty_bps:0,lock_in_months:0})).data;
  assert.equal(zero.facts.effective_annual_pct,0);
  await session.post('safety/scan',{principal:1000,months:12,advertised_rate_bps:1000,processing_fee:2000},422);
  await session.post('safety/scan',{principal:0,months:12,advertised_rate_bps:1000},422);
  await session.post('safety/scan',{principal:1000000,months:12,advertised_rate_bps:1000,frequency:'hourly'},422);
  await session.post('safety/scan',{principal:1000000,months:12,advertised_rate_bps:1000,surprise:1},422);
  await client().post('safety/scan',{principal:1000000,months:12,advertised_rate_bps:1000},401);
});

test('distress early warning explains alerts, never penalizes and supports administrator outreach',async()=>{
  const healthy=await borrower('wellbeing');
  const calm=(await healthy.session.get('distress')).data;
  assert.equal(calm.level,'low');
  assert.match(calm.notice,/never changes your score/);
  const strained=await borrower('strained',{...goodProfile,salary:4000000,essential:2600000,discretionary:900000,existing_emi:1500000,debt:9000000,reserves:100000,missed:4,on_time:10,credit_months:20});
  const before=(await strained.session.get('credit')).data.score;
  const result=(await strained.session.get('distress')).data;
  assert.ok(['elevated','high'].includes(result.level));
  const keys=result.indicators.filter(i=>i.level==='alert').map(i=>i.key);
  assert.ok(keys.includes('cashflow')&&keys.includes('reserves'));
  assert.ok(result.indicators.every(i=>i.detail));
  assert.ok(result.recommendations.some(r=>/support request/.test(r)));
  assert.equal((await strained.session.get('credit')).data.score,before);
  const inbox=(await strained.session.get('notifications')).data.items.filter(n=>n.kind==='distress');
  await strained.session.get('distress');
  assert.equal(inbox.length,1);
  assert.equal((await strained.session.get('notifications')).data.items.filter(n=>n.kind==='distress').length,1);
  const admin=await adminSession();
  const list=(await admin.get('admin/distress')).data;
  const mine=list.items.find(i=>i.user_id===strained.user.id);
  assert.ok(mine);
  assert.ok(!list.items.some(i=>i.user_id===healthy.user.id));
  await admin.post('admin/distress/'+strained.user.id,{outreach:'contacted',note:''},422);
  const updated=(await admin.post('admin/distress/'+strained.user.id,{outreach:'contacted',note:'Offered a call to review instalments.'})).data;
  assert.equal(updated.outreach,'contacted');
  assert.equal((await strained.session.get('distress')).data.support.outreach,'contacted');
  assert.ok((await strained.session.get('notifications')).data.items.some(n=>n.title==='Our team would like to help'));
  await strained.session.get('admin/distress',403);
  await strained.session.post('admin/distress/'+strained.user.id,{outreach:'resolved',note:'x'},403);
});

test('dispute tickets run the full lifecycle with evidence, ownership and reconsideration',async()=>{
  const {session,admin,user}=await borrower('dispute');
  const stranger=(await registerCustomer('dispute-other')).session;
  await session.post('disputes',{category:'bogus',subject:'Wrong figure',description:'The profile total is wrong.'},422);
  await session.post('disputes',{category:'other',subject:'x',description:'short'},422);
  await session.post('disputes',{category:'application_reconsideration',subject:'Please review',description:'I would like a second look.'},422);
  const created=(await session.post('disputes',{category:'incorrect_record',subject:'Wrong repayment history',
    description:'My profile shows missed payments I did not miss.',document:proof('Payment statement')},201)).data;
  const id=created.ticket.id;
  assert.equal(created.ticket.status,'open');
  assert.equal(created.messages.length,1);
  const docId=created.messages[0].document_id;
  await stranger.get('disputes/'+id,404);
  await stranger.get(`disputes/${id}/documents/${docId}`,404);
  assert.ok(Buffer.from((await admin.get(`admin/disputes/${id}/documents/${docId}`)).data.content_base64,'base64').toString().startsWith('CREDWISE-SYNTHETIC'));
  await session.get('admin/disputes',403);
  assert.equal((await admin.get('admin/disputes?status=open')).data.items.some(t=>t.id===id),true);
  const assigned=(await admin.post(`admin/disputes/${id}/assign`,{})).data;
  assert.equal(assigned.ticket.status,'in_review');
  const asked=(await admin.post(`admin/disputes/${id}/respond`,{status:'awaiting_customer',body:'Please attach the bank statement for March.'})).data;
  assert.equal(asked.ticket.status,'awaiting_customer');
  assert.ok((await session.get('notifications')).data.items.some(n=>n.kind==='support'));
  const replied=(await session.post(`disputes/${id}/messages`,{body:'Attached the statement.',document:proof('March statement')})).data;
  assert.equal(replied.ticket.status,'in_review');
  await admin.post(`admin/disputes/${id}/respond`,{status:'open',body:'Moving backwards'},422);
  const resolved=(await admin.post(`admin/disputes/${id}/respond`,{status:'resolved',body:'Corrected the repayment record.'})).data;
  assert.equal(resolved.ticket.status,'resolved');
  assert.equal(resolved.ticket.resolution,'Corrected the repayment record.');
  assert.equal(resolved.messages.length,4);
  await session.post(`disputes/${id}/messages`,{body:'One more thing'},409);
  const reopened=(await session.post(`disputes/${id}/reopen`,{body:'The figure is still wrong.'})).data;
  assert.equal(reopened.ticket.status,'open');
  const withdrawn=(await session.post(`disputes/${id}/withdraw`,{})).data;
  assert.equal(withdrawn.ticket.status,'withdrawn');
  await session.post(`disputes/${id}/reopen`,{body:'Again'},409);
  assert.equal((await session.get('disputes')).data.items.length,1);
  assert.deepEqual((await stranger.get('disputes')).data.items,[]);

  // Reconsideration reopens the underlying rejected application.
  const path=await draftAndSubmit(session,{purpose:'Wedding expenses'});
  await admin.post('admin/'+path+'/decision',{action:'reject',note:'Proposed instalment is too high for current headroom.',reason_code:'affordability'});
  const ticket=(await session.post('disputes',{category:'application_reconsideration',subject:'Reconsider my application',
    description:'My circumstances changed and I would like a human review.',application_id:Number(path.split('/')[1])},201)).data;
  await admin.post(`admin/disputes/${ticket.ticket.id}/respond`,{status:'in_review',body:'Reviewing',reconsider:true},422);
  const done=(await admin.post(`admin/disputes/${ticket.ticket.id}/respond`,{status:'resolved',body:'Sent back to underwriting for a fresh review.',reconsider:true})).data;
  assert.equal(done.ticket.reconsidered,true);
  const app=(await session.get(path)).data;
  assert.equal(app.application.status,'under_review');
  assert.equal(app.application.escalated,true);
  await stranger.post('disputes',{category:'payment_issue',subject:'Not mine',description:'Trying a loan I do not own.',loan_id:1},404);
});

test('fairness monitor proves protected attributes are inert and records auditable runs',async()=>{
  const admin=await adminSession();
  const customer=(await registerCustomer('fairness-customer')).session;
  await customer.get('admin/fairness',403);
  await customer.post('admin/fairness/run',{},403);
  const run=(await admin.post('admin/fairness/run',{},201)).data;
  assert.equal(run.latest.consistent,true);
  const result=run.latest.result;
  assert.equal(result.max_score_difference,0);
  assert.equal(result.tests.length,3);
  assert.ok(result.tests.every(t=>t.identical&&t.variants.length===4));
  assert.ok(result.sensitivity.every(s=>s.changed));
  assert.ok(result.policy_checks.every(c=>c.passed));
  assert.ok(result.excluded.includes('religion')&&result.excluded.includes('caste'));
  assert.equal(Object.keys(result.tests[0].variants[0].products).length,8);
  const again=(await admin.post('admin/fairness/run',{},201)).data;
  assert.ok(again.history.length>=2);
  assert.ok(again.history[0].id>again.history[1].id);
  assert.ok(again.stats.policy.id>=1);
  assert.ok(Array.isArray(again.stats.policy_history));
  assert.ok(again.stats.human_review.total>=0);
});

test('academy serves bilingual lessons, keeps answers server-side and persists progress',async()=>{
  const {session}=await borrower('academy');
  const en=(await session.get('academy?lang=en')).data;
  const hi=(await session.get('academy?lang=hi')).data;
  assert.equal(en.items.length,11);
  assert.notEqual(en.items[0].title,hi.items[0].title);
  assert.equal(en.progress.completed,0);
  const slug=en.items[0].slug;
  const lesson=(await session.get(`academy/${slug}?lang=hi`)).data;
  assert.ok(lesson.choices.length>=2);
  assert.ok(!JSON.stringify(lesson).includes('explanation'));
  assert.ok(!('answer' in lesson));
  await session.get('academy/not-a-lesson',404);
  await session.get('academy?lang=fr',422);
  await session.post(`academy/${slug}/answer`,{choice:9},422);
  await session.post(`academy/${slug}/answer`,{choice:-1},422);
  let wrong;
  for(const choice of [0,1,2]){const r=(await session.post(`academy/${slug}/answer`,{choice,lang:'en'})).data;if(!r.correct){wrong=r;break;}}
  assert.ok(wrong.explanation.length>10);
  assert.equal(wrong.detail.completed,false);
  assert.equal((await session.get('academy')).data.progress.completed,0);
  const right=(await session.post(`academy/${slug}/answer`,{choice:wrong.correct_choice,lang:'hi'})).data;
  assert.equal(right.correct,true);
  assert.equal(right.detail.completed,true);
  assert.ok(right.detail.attempts>=2);
  const after=(await session.get('academy?lang=en')).data;
  assert.equal(after.progress.completed,1);
  assert.equal(after.items[0].completed,true);
  await client().get('academy',401);
});

test('rewards recognise learning, on-time payment and planning but never borrowing',async()=>{
  const {session,admin}=await borrower('rewards');
  const empty=(await session.get('rewards')).data;
  assert.equal(empty.points,0);
  assert.equal(empty.level,'Starter');
  assert.match(empty.notice,/never earn points for applying for, taking or increasing a loan/);
  const loan=await fundLoan(session,admin);
  assert.equal((await session.get('rewards')).data.points,0);
  const slug=(await session.get('academy')).data.items[0].slug;
  let r;
  for(const choice of [0,1,2,3]){r=(await session.post(`academy/${slug}/answer`,{choice})).data;if(r.correct)break;}
  const learned=(await session.get('rewards')).data;
  assert.equal(learned.points,10);
  assert.ok(learned.badges.find(b=>b.id==='first_lesson').awarded_at);
  assert.equal((await session.get('rewards')).data.points,10);
  const detail=(await session.get('loans/'+loan)).data;
  const due=detail.loan.next_due_date;
  await payment(session,loan,'reward-emi-1-'+loan,{kind:'emi',payment_date:due});
  assert.equal((await session.get('rewards')).data.points,15);
  await session.post('planning/stress',{income_drop_pct:10});
  await session.post('planning/scenarios',{kind:'stress',name:'Reward plan',input:{income_drop_pct:10}},201);
  const planned=(await session.get('rewards')).data;
  assert.equal(planned.points,20);
  assert.equal(planned.events.length,3);
  assert.ok(planned.events.every(e=>e.points>0&&e.kind!=='borrowing'));
  assert.ok(!planned.events.some(e=>/appl|borrow|disburs/i.test(e.note)));
});

test('PDF exports are valid, current and authorized',async()=>{
  const {session,admin}=await borrower('pdf');
  const loan=await fundLoan(session,admin);
  const decode=file=>{assert.equal(file.mime,'application/pdf');assert.ok(file.name.endsWith('.pdf'));return Buffer.from(file.content_base64,'base64').toString('latin1');};
  const check=(body,needle)=>{
    assert.ok(body.startsWith('%PDF-1.4'));assert.ok(body.trimEnd().endsWith('%%EOF'));
    const xref=Number(/startxref\n(\d+)/.exec(body)[1]);
    assert.ok(body.slice(xref).startsWith('xref'));
    const count=Number(/\/Size (\d+)/.exec(body)[1]);
    const offsets=[...body.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map(m=>Number(m[1]));
    assert.equal(offsets.length,count-1);
    offsets.forEach((o,i)=>assert.ok(body.slice(o).startsWith(`${i+1} 0 obj`),'xref offset '+(i+1)));
    assert.ok(body.includes(needle),'missing '+needle);
    assert.ok(body.includes('0.0667 0.0941 0.1529 rg')&&body.includes('0 0.8392 0.3098 rg'),'brand header and logo colours');
  };
  check(decode((await session.get('reports/pdf/health')).data),'Financial health report');
  check(decode((await session.get('reports/pdf/credit')).data),'Simulated credit assessment');
  const statement=decode((await session.get('reports/pdf/loan/'+loan)).data);
  check(statement,'Loan statement');
  assert.ok(statement.includes('INR 25,000.00'));
  assert.ok(statement.includes('Disbursement'));
  await session.get('reports/pdf/certificate/'+loan,409);
  const saved=(await session.post('planning/scenarios',{kind:'education',name:'PDF plan',input:{total_cost:100000000,study_years:2,repayment_months:84,expected_salary:5000000}},201)).data;
  check(decode((await session.get('reports/pdf/scenario/'+saved.id)).data),'Education loan projection');
  check(decode((await admin.get('admin/reports/pdf/portfolio')).data),'Portfolio report');
  check(decode((await admin.get('admin/reports/pdf/loan/'+loan)).data),'Loan statement');
  const stranger=(await registerCustomer('pdf-other')).session;
  await stranger.get('reports/pdf/loan/'+loan,404);
  await stranger.get('reports/pdf/scenario/'+saved.id,404);
  await session.get('admin/reports/pdf/portfolio',403);
  await client().get('reports/pdf/health',401);
  await session.get('reports/pdf/loan/abc',422);
});
