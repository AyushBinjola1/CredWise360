import {test} from 'node:test';
import assert from 'node:assert/strict';
import {client,registerCustomer} from './helpers.mjs';

function proof(kind) {
  return {kind,name:'synthetic-evidence.txt',mime:'text/plain',
    content_base64:Buffer.from('CREDWISE-SYNTHETIC\n'+kind).toString('base64')};
}
async function verified(label) {
  const {session,credentials,data}=await registerCustomer(label);
  const admin=client();
  await admin.post('auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  await session.put('profile',{salary:8500000,essential:2400000,discretionary:550000,savings:1400000,
    existing_emi:200000,debt:1800000,reserves:11000000,credit_months:48,stability_months:44,
    utilization:15,on_time:44,missed:0,income_regularity:98});
  await session.post('kyc',{legal_name:credentials.name,address:'Synthetic Court 4',employment:'Salaried',
    pan:'DEMOX1127Z',document:proof('Identity verification')},201);
  await admin.post('admin/kyc/'+data.user.id,{status:'verified',reason:'Reviewed the synthetic proof.'});
  return {session,admin};
}
async function submitCase(session,terms={}) {
  const result=(await session.post('applications',{product_slug:'personal',purpose:'Household repair',principal:2500000,months:12,...terms},201)).data;
  const path='applications/'+result.application.id;
  await session.post(path+'/accept',{confirmed:true,offer_version:1},409);
  const preview=(await session.post(path+'/preview',{})).data;
  assert.ok(preview.assessment.quote.schedule.length>0);
  const token=preview.application.preview_token;
  await session.post(path+'/submit',{confirmed:true,preview_token:token},422);
  await session.put(path,{documents:result.required_documents.map(proof)});
  await session.post(path+'/submit',{confirmed:true,preview_token:'invalid'},409);
  const data=(await session.post(path+'/submit',{confirmed:true,preview_token:token})).data;
  assert.equal(data.application.status,'under_review');
  assert.ok(data.timeline.some(x=>x.status==='submitted'));
  assert.match(data.application.tracking_id,/^CW-/);
  return {path,data};
}

test('draft, synthetic evidence, underwriting, frozen acceptance and duplicate funding',async()=>{
  const {session,admin}=await verified('origination');
  const {path,data}=await submitCase(session);
  const stranger=(await registerCustomer('otherborrower')).session;
  await stranger.get(path,404);
  await stranger.get(path+'/documents/'+data.documents[0].id,404);
  await session.get('admin/'+path,403);
  const file=(await admin.get('admin/'+path+'/documents/'+data.documents[0].id)).data;
  assert.ok(Buffer.from(file.content_base64,'base64').toString().startsWith('CREDWISE-SYNTHETIC'));
  await admin.post('admin/'+path+'/decision',{action:'request_information',note:'Confirm the purpose of the household repair.'});
  await session.put(path,{purpose:'Household repair to the kitchen'});
  const refreshed=(await session.post(path+'/preview',{})).data;
  await session.post(path+'/resubmit',{confirmed:true,preview_token:refreshed.application.preview_token});
  const approved=(await admin.post('admin/'+path+'/decision',{action:'approve',note:'Confirmed identity, cost and monthly headroom.'})).data;
  assert.equal(approved.application.status,'approved');
  assert.equal(approved.offer.quote.principal,2500000);
  await session.post(path+'/accept',{confirmed:true,offer_version:approved.offer.version+1},409);
  await session.post(path+'/accept',{confirmed:true,offer_version:approved.offer.version});
  const funded=await Promise.all([session.post(path+'/disburse',{}),session.post(path+'/disburse',{})]);
  assert.equal(funded[0].data.application.status,'active');
  assert.ok(Number.isInteger(funded[0].data.application.loan_id));
  assert.equal(funded[0].data.application.loan_id,funded[1].data.application.loan_id);
  assert.equal(funded[1].data.timeline.filter(x=>x.status==='disbursed').length,1);
  assert.equal((await session.get(path)).data.offer.quote.emi,approved.offer.quote.emi);
});

test('explainable rejection, profile-based reassessment, escalation and human reconsideration',async()=>{
  const {session,admin}=await verified('reconsider');
  const {path,data}=await submitCase(session);
  const decision='admin/'+path+'/decision';
  const reject={action:'reject',reason_code:'documentation',note:'The synthetic budget evidence requires confirmation.'};
  const rejected=(await admin.post(decision,reject)).data;
  assert.ok(rejected.recovery.reasons.includes(reject.note));
  assert.ok(rejected.recovery.reason_codes.includes('documentation'));
  assert.ok(rejected.recovery.milestones.length>0);
  await session.post(path+'/reassess',{},409);
  await session.put('profile',{reserves:14000000});
  assert.equal((await session.get(path)).data.recovery.reassessment_eligible,true);
  await session.post(path+'/reassess',{});
  await admin.post(decision,{action:'escalate',note:'Second underwriting review requested.'});
  const queue=(await admin.get('admin/applications?priority=escalated&q='+data.application.tracking_id)).data;
  assert.equal(queue.total,1);
  await admin.post(decision,reject);
  const reconsidered=(await session.post(path+'/appeal',{note:'Please review the revised synthetic evidence with me.'})).data;
  assert.equal(reconsidered.application.status,'under_review');
  assert.equal(reconsidered.application.escalated,true);
  await session.post(path+'/withdraw',{});
  await admin.post(decision,{action:'approve',note:'Cannot approve a withdrawn case.'},409);
});

test('two individually affordable offers cannot consume the same repayment headroom',async()=>{
  const {session,admin}=await verified('capacity-lock');
  const paths=[];
  for (let i=0;i<2;i++) {
    const {path}=await submitCase(session,{principal:15000000,months:6});
    const approved=(await admin.post('admin/'+path+'/decision',{action:'approve',note:'Reviewed current monthly capacity.'})).data;
    await session.post(path+'/accept',{confirmed:true,offer_version:approved.offer.version});
    paths.push(path);
  }
  const responses=await Promise.all(paths.map(path=>session.post(path+'/disburse',{})));
  assert.deepEqual(responses.map(response=>response.data.application.status).sort(),['active','under_review']);
  const reviewed=responses.find(response=>response.data.application.status==='under_review').data;
  assert.equal(reviewed.application.loan_id,null);
  assert.ok(reviewed.timeline.some(event=>event.action==='funding_review'));
});
