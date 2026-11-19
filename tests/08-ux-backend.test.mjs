import {test} from 'node:test';
import assert from 'node:assert/strict';
import {client,registerCustomer} from './helpers.mjs';
import {adminSession,borrower,draftAndSubmit,fundLoan,payment} from './lending-helpers.mjs';

test('dashboard read model carries debt progress, transactions, verification status and alerts',async()=>{
  const {session,admin}=await borrower('dashboard');
  const empty=(await session.get('dashboard')).data;
  assert.equal(empty.kyc_status,'verified');
  assert.equal(empty.loans.principal,0);
  assert.deepEqual(empty.transactions,[]);
  const loan=await fundLoan(session,admin);
  const first=(await session.get('loans/'+loan)).data.schedule[0];
  await payment(session,loan,'ux-dash-'+loan,{kind:'emi',payment_date:first.due_date});
  const board=(await session.get('dashboard')).data;
  assert.equal(board.loans.principal,2500000);
  assert.equal(board.loans.outstanding,2500000-first.principal);
  assert.equal(board.transactions.length,2);
  assert.equal(board.transactions[0].kind,'emi');
  assert.match(board.transactions[0].reference,/^CW-T-\d+$/);
  assert.ok(board.alerts.length>=1&&board.alerts.length<=3);
  assert.ok(board.alerts.every(a=>a.title&&a.link!==undefined));
  assert.ok(board.unread>=board.alerts.length);
  const stranger=(await registerCustomer('dashboard-stranger')).session;
  const theirs=(await stranger.get('dashboard')).data;
  assert.equal(theirs.kyc_status,null);
  assert.deepEqual(theirs.transactions,[]);
});

test('application queue sorting is whitelisted, validated and stable',async()=>{
  const label='sorting'+Date.now().toString(36);
  const {session,admin}=await borrower(label);
  await draftAndSubmit(session,{principal:1000000});
  await draftAndSubmit(session,{principal:3000000});
  await draftAndSubmit(session,{principal:2000000});
  const amounts=async query=>(await admin.get('admin/applications?page_size=100&q='+encodeURIComponent('Synthetic '+label)+query)).data.items.map(i=>i.principal);
  const ascending=await amounts('&sort=amount&dir=asc'),descending=await amounts('&sort=amount&dir=desc');
  assert.deepEqual(ascending,[...ascending].sort((a,b)=>a-b));
  assert.deepEqual(descending,[...descending].sort((a,b)=>b-a));
  assert.deepEqual(ascending,[...descending].reverse());
  assert.equal(ascending.length,3);
  const names=(await admin.get('admin/applications?page_size=100&sort=applicant&dir=asc')).data.items.map(i=>i.applicant_name.toLowerCase());
  assert.deepEqual(names,[...names].sort());
  await admin.get('admin/applications?sort=principal;drop table users',422);
  await admin.get('admin/applications?sort=amount&dir=sideways',422);
  await session.get('applications?sort=amount&dir=desc');
  await session.get('applications?sort=password_hash',422);
});

test('audit trail is administrator-only, filterable, paginated and exportable',async()=>{
  const {session,admin,user}=await borrower('audit');
  await session.get('admin/audit',403);
  await client().get('admin/audit',401);
  const all=(await admin.get('admin/audit')).data;
  assert.ok(all.total>0&&all.items.length<=50&&all.page===1);
  assert.ok(all.items.every((row,i,rows)=>i===0||rows[i-1].id>row.id),'newest first');
  const kyc=(await admin.get('admin/audit?action=kyc.')).data;
  assert.ok(kyc.items.length>0&&kyc.items.every(r=>r.action.startsWith('kyc.')));
  const mine=(await admin.get('admin/audit?q='+encodeURIComponent(user.name))).data;
  assert.ok(mine.items.some(r=>r.subject_name===user.name||r.actor_name===user.name));
  const none=(await admin.get('admin/audit?q=zzzz-no-such-entry')).data;
  assert.deepEqual([none.total,none.items.length],[0,0]);
  const second=(await admin.get('admin/audit?page=2')).data;
  assert.equal(second.page,2);
  if(all.total>50)assert.ok(second.items[0].id<all.items.at(-1).id);
  await admin.get('admin/audit?page=0',422);
  await admin.get('admin/audit?page=abc',422);
  await admin.get('admin/audit?q='+'x'.repeat(101),422);
  const pdf=(await admin.get('admin/reports/pdf/audit')).data;
  assert.equal(pdf.mime,'application/pdf');
  assert.ok(Buffer.from(pdf.content_base64,'base64').toString('latin1').includes('Audit report'));
  await session.get('admin/reports/pdf/audit',403);
});

test('application summaries are generated for owners and administrators only',async()=>{
  const {session,admin}=await borrower('summary');
  const path=await draftAndSubmit(session);
  const id=path.split('/')[1];
  await admin.post('admin/'+path+'/decision',{action:'approve',note:'Affordable and verified.'});
  const text=file=>Buffer.from(file.content_base64,'base64').toString('latin1');
  const mine=(await session.get('reports/pdf/application/'+id)).data;
  assert.equal(mine.name,`application-${id}-summary.pdf`);
  const body=text(mine);
  assert.ok(body.startsWith('%PDF-1.4')&&body.includes('Application summary')&&body.includes('Offered terms'));
  assert.ok(!body.includes('Underwriting decisions'),'borrower copy omits reviewer notes');
  const staff=text((await admin.get('admin/reports/pdf/application/'+id)).data);
  assert.ok(staff.includes('Underwriting decisions'));
  const stranger=(await registerCustomer('summary-stranger')).session;
  await stranger.get('reports/pdf/application/'+id,404);
  await session.get('admin/reports/pdf/application/'+id,403);
  await session.get('reports/pdf/application/abc',422);
});

test('administrator totals include support and distress workload',async()=>{
  const admin=await adminSession();
  const {totals}=(await admin.get('admin/overview')).data;
  for(const key of ['disputes_open','distress_open','fraud_open','kyc_pending','queue','overdue_loans'])assert.equal(typeof totals[key],'number',key);
});

// These checks need an API started with DEMO_PROTECT=1 (the hosted demo sets it). They are skipped in the standard gate,
// which edits demonstration configuration on purpose. Run: DEMO_PROTECT_TEST=1 WEB_URL=... node --test tests/08-ux-backend.test.mjs
const protectedRun=process.env.DEMO_PROTECT_TEST==='1';
test('shared demonstration accounts cannot be locked out or reconfigured',{skip:!protectedRun&&'needs DEMO_PROTECT=1'},async()=>{
  const login=async email=>{const s=client();await s.post('auth/login',{email,password:'CredWiseDemo!360'});return s;};
  const guest=await login('borrower@credwise.test');
  for(const change of [{name:'Hacked'},{active:false,current_password:'CredWiseDemo!360'},{new_password:'Another-Strong-Pass-1!',current_password:'CredWiseDemo!360'}]){
    const r=await guest.request('PUT','settings',{body:change,status:403});assert.equal(r.error.code,'demo_protected');
  }
  await guest.put('settings',{preferences:{theme:'dark'}});
  const admin=await login('admin@credwise.test');
  assert.equal((await admin.request('PUT','admin/policy',{body:{note:'x',thresholds:{emi_cap_pct:39}},status:403})).error.code,'demo_protected');
  assert.equal((await admin.request('PUT','admin/products/personal',{body:{rate_bps:1300},status:403})).error.code,'demo_protected');
  const users=(await admin.get('admin/users?page_size=100')).data;
  const demo=users.items.find(u=>u.email==='borrower@credwise.test');
  assert.equal((await admin.request('POST','admin/users/'+demo.id,{body:{active:false},status:403})).error.code,'demo_protected');
  const mine=(await registerCustomer('free-user')).session;
  await mine.put('settings',{name:'Renamed Visitor'});   // visitors' own accounts stay fully editable
  assert.ok(await login('borrower@credwise.test'),'demo login still works');
});
