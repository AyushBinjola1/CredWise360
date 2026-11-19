import {test} from 'node:test';
import assert from 'node:assert/strict';
import {client,registerCustomer} from './helpers.mjs';

const letters='ABCDEFGHJKLMNPQRSTUVWXYZ';
const randomPan=()=>'DEMO'+letters[Math.floor(Math.random()*24)]+String(Math.floor(Math.random()*10000)).padStart(4,'0')+letters[Math.floor(Math.random()*24)];
const proof=kind=>({kind,name:'synthetic-evidence.txt',mime:'text/plain',
  content_base64:Buffer.from('CREDWISE-SYNTHETIC\n'+kind).toString('base64')});
async function borrower(label,pan=randomPan()) {
  const {session,credentials,data}=await registerCustomer(label);
  const admin=client();
  await admin.post('auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  await session.put('profile',{salary:8500000,essential:2400000,discretionary:550000,savings:1400000,
    existing_emi:200000,debt:1800000,reserves:11000000,credit_months:48,stability_months:44,
    utilization:35,on_time:44,missed:0,income_regularity:98});
  await session.post('kyc',{legal_name:credentials.name,address:'Synthetic Court 4',employment:'Salaried',pan,document:proof('Identity verification')},201);
  await admin.post('admin/kyc/'+data.user.id,{status:'verified',reason:'Reviewed the synthetic proof.'});
  return {session,admin,user:data.user};
}
async function fundLoan(session,admin) {
  const created=(await session.post('applications',{product_slug:'personal',purpose:'Household repair',principal:2500000,months:12},201)).data;
  const path='applications/'+created.application.id;
  const preview=(await session.post(path+'/preview',{})).data;
  await session.put(path,{documents:created.required_documents.map(proof)});
  await session.post(path+'/submit',{confirmed:true,preview_token:preview.application.preview_token});
  const approved=(await admin.post('admin/'+path+'/decision',{action:'approve',note:'Affordable and verified.'})).data;
  await session.post(path+'/accept',{confirmed:true,offer_version:approved.offer.version});
  return (await session.post(path+'/disburse',{})).data.application.loan_id;
}

test('digital twin clones the profile, explains changes and leaves records untouched',async()=>{
  const {session}=await borrower('twin');
  const before=(await session.get('profile')).data;
  const presets=(await session.get('planning/presets')).data.items;
  assert.ok(presets.length>=5);
  const result=(await session.post('planning/twin',{preset:'reduce_utilization'})).data;
  assert.ok(result.scenario.score>=result.baseline.score);
  assert.equal(result.delta.score,result.scenario.score-result.baseline.score);
  assert.ok(result.factors.some(f=>f.name==='Credit utilization'&&f.after>f.before));
  const worse=(await session.post('planning/twin',{preset:'miss_payment'})).data;
  assert.ok(worse.scenario.score<worse.baseline.score);
  const custom=(await session.post('planning/twin',{changes:{reserves:30000000}})).data;
  assert.ok(custom.scenario.capacity>=custom.baseline.capacity);
  assert.deepEqual((await session.get('profile')).data.profile,before.profile);
  await session.post('planning/twin',{},422);
  await session.post('planning/twin',{changes:{gender:'x'}},422);
  await session.post('planning/twin',{preset:'unknown'},422);
});

test('stress, debt and education planners reconcile and persist saved scenarios',async()=>{
  const {session}=await borrower('planner');
  const calm=(await session.post('planning/stress',{income_drop_pct:0})).data;
  assert.equal(calm.level,'stable');
  const hard=(await session.post('planning/stress',{income_drop_pct:100,duration_months:24})).data;
  assert.equal(hard.level,'critical');
  assert.ok(hard.depleted_in_month>=1&&hard.depleted_in_month<=24);
  assert.equal(hard.stressed.surplus,-(hard.stressed.essential+hard.stressed.optional+hard.stressed.emi));
  await session.post('planning/stress',{income_drop_pct:101},422);

  const debts=[{name:'Card',balance:5000000,minimum:200000,rate_bps:3600},{name:'Phone',balance:1200000,minimum:60000,rate_bps:1200}];
  const avalanche=(await session.post('planning/debt',{strategy:'avalanche',monthly_budget:400000,extra_debts:debts})).data;
  const snowball=(await session.post('planning/debt',{strategy:'snowball',monthly_budget:400000,extra_debts:debts})).data;
  assert.ok(avalanche.total_interest<=snowball.total_interest);
  assert.ok(avalanche.total_interest<avalanche.baseline.total_interest);
  assert.ok(avalanche.months<avalanche.baseline.months);
  assert.equal(avalanche.series.at(-1).balance,0);
  const stuck=(await session.post('planning/debt',{strategy:'avalanche',monthly_budget:400000,extra_debts:[{...debts[0],minimum:150000}]})).data;
  assert.equal(stuck.baseline.finished,false);
  assert.equal(stuck.baseline.months,null);
  await session.post('planning/debt',{strategy:'avalanche',monthly_budget:100000,extra_debts:debts},422);
  await session.post('planning/debt',{strategy:'avalanche',monthly_budget:400000},422);

  const plan={total_cost:200000000,family_contribution:50000000,scholarship:25000000,study_years:4,grace_months:6,
    repayment_months:84,expected_salary:6000000};
  const edu=(await session.post('planning/education',plan)).data;
  assert.equal(edu.loan_principal,125000000);
  assert.equal(edu.tranches.reduce((sum,t)=>sum+t.amount,0),edu.loan_principal);
  assert.equal(edu.repayment_start_balance,edu.loan_principal+edu.interest_accrued);
  assert.ok(edu.emi>0&&['comfortable','stretched','risky'].includes(edu.verdict));
  const paying=(await session.post('planning/education',{...plan,pay_interest_during_study:true})).data;
  assert.equal(paying.interest_accrued,0);
  assert.ok(paying.emi<edu.emi);
  await session.post('planning/education',{...plan,family_contribution:200000000},422);

  const saved=(await session.post('planning/scenarios',{kind:'education',name:'Masters plan',input:plan},201)).data;
  const listed=(await session.get('planning/scenarios')).data.items;
  assert.equal(listed[0].id,saved.id);
  assert.equal(listed[0].result.emi,edu.emi);
  const other=(await registerCustomer('plannerother')).session;
  assert.deepEqual((await other.get('planning/scenarios')).data.items,[]);
  await session.post('planning/scenarios',{kind:'bogus',name:'x',input:plan},404);
});

test('funded loans feed the debt navigator, notifications, reminders, reports and dashboards',async()=>{
  const {session,admin}=await borrower('lifecycle');
  const loanId=await fundLoan(session,admin);
  const context=(await session.get('planning/context')).data;
  assert.equal(context.debts.length,1);
  assert.equal(context.debts[0].balance,2500000);
  const plan=(await session.post('planning/debt',{strategy:'avalanche',monthly_budget:context.debts[0].minimum+100000})).data;
  assert.equal(plan.debts[0].balance,2500000);
  assert.ok(plan.months<=12);

  const inbox=(await session.get('notifications')).data;
  assert.ok(inbox.items.some(n=>n.title==='Your loan application was approved'));
  assert.ok(inbox.items.some(n=>n.title==='Your loan is now active'&&n.link.startsWith('/app/applications/')));
  assert.ok(inbox.unread>=2);
  const again=(await session.get('notifications')).data;
  assert.equal(again.items.length,inbox.items.length);
  await session.post('notifications/read',{});
  assert.equal((await session.get('notifications')).data.unread,0);

  const dashboard=(await session.get('dashboard')).data;
  assert.equal(dashboard.loans.active,1);
  assert.equal(dashboard.loans.outstanding,2500000);
  assert.ok(dashboard.next_payment.amount>0);
  const report=(await session.get('reports')).data;
  assert.equal(report.loans[0].id,loanId);
  assert.ok(report.payments.some(p=>p.kind==='disbursement'));
  await session.get('admin/reports',403);

  const portfolio=(await admin.get('admin/reports')).data;
  assert.ok(portfolio.totals.loans_active>=1);
  assert.ok(portfolio.totals.disbursed>=2500000);
  assert.equal(portfolio.by_product.length,8);
  const rows=portfolio.by_status.reduce((sum,r)=>sum+r.count,0);
  assert.equal(rows,portfolio.totals.submitted_total+(portfolio.by_status.find(r=>r.status==='draft')?.count??0));
  assert.equal((await admin.get('admin/overview')).data.totals.customers,portfolio.totals.customers);
  await admin.get('reports',403);
});

test('fraud rules flag a shared synthetic identity and record investigator decisions',async()=>{
  const pan=randomPan();
  const first=await borrower('fraudone',pan);
  const second=await borrower('fraudtwo',pan);
  const cases=(await second.admin.get('admin/fraud')).data.items;
  const matches=cases.filter(c=>c.rule==='shared_synthetic_identity'&&c.subject===pan);
  assert.deepEqual(matches.map(c=>c.user_id).sort(),[first.user.id,second.user.id].sort());
  assert.ok(matches.every(c=>c.severity==='high'&&c.status==='open'));
  await first.session.get('admin/fraud',403);
  const target=matches[0];
  await second.admin.post('admin/fraud/'+target.id,{status:'cleared',note:''},422);
  const cleared=(await second.admin.post('admin/fraud/'+target.id,{status:'cleared',note:'Siblings sharing a synthetic test document.'})).data;
  assert.equal(cleared.status,'cleared');
  const rescan=(await second.admin.get('admin/fraud')).data.items.find(c=>c.id===target.id);
  assert.equal(rescan.status,'cleared');
  assert.equal((await second.admin.get('admin/fraud?status=cleared')).data.items.every(c=>c.status==='cleared'),true);
  await second.admin.get('admin/fraud?status=bogus',422);
});
