import assert from 'node:assert/strict';
import {test} from 'node:test';
import {client,registerCustomer} from './helpers.mjs';

test('consent, financial evidence and profile changes produce explained, durable assessments',async()=>{
  const {session}=await registerCustomer('credit');
  const initial=(await session.get('credit')).data;
  assert.equal(initial.score,null);
  assert.equal(initial.human_review,true);
  assert.ok(initial.reason_codes.includes('insufficient_evidence'));
  const sample={salary:6000000,essential:2000000,discretionary:800000,savings:750000,existing_emi:400000,
    debt:7500000,reserves:3000000,rent:95,utilities:98,income_regularity:90};
  await session.put('profile',sample);
  assert.equal((await session.get('credit')).data.score,null);
  await session.put('profile',{consent:true});
  const alternative=(await session.get('credit')).data;
  assert.equal(alternative.strategy,'alternative');
  assert.ok(alternative.score>=300 && alternative.score<=900);
  assert.ok(alternative.capacity>0);
  assert.ok(alternative.factors.some(f=>f.key==='rent' && f.value===95));
  assert.equal(alternative.history.at(-1).score,alternative.score);
  assert.equal((await session.get('credit')).data.history.length,alternative.history.length);
  await session.put('profile',{on_time:24,missed:1,credit_months:36,utilization:55});
  const conventional=(await session.get('credit')).data;
  assert.equal(conventional.strategy,'conventional');
  await session.put('profile',{utilization:15});
  const improved=(await session.get('credit')).data;
  assert.ok(improved.score>conventional.score);
  assert.equal(improved.prior_score,conventional.score);
  assert.equal(improved.change,improved.score-conventional.score);
  assert.equal(improved.history.filter(row=>row.score===improved.score).length,1);
  await session.get('admin/policy',403);
});

test('policy changes validate weights, apply to live assessments and preserve the revision log',async()=>{
  const admin=client();
  await admin.post('auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  const {policy}= (await admin.get('admin/policy')).data;
  const invalid={note:'Invalid weight check',conventional_weights:{repayment:101}};
  await admin.put('admin/policy',invalid,422);
  const before=(await admin.get('admin/policy')).data;
  assert.equal(before.policy.id,policy.id);
  const consistent=(await admin.get('admin/policy/consistency')).data;
  assert.equal(consistent.consistent,true);
  assert.deepEqual(consistent.first,consistent.second);
  const previous=policy.thresholds.emi_cap_pct;
  const revised=previous===30?31:30;
  const borrower=await registerCustomer('policy');
  await borrower.session.put('profile',{salary:1000000,essential:100000,on_time:36,credit_months:60});
  const after=(await admin.put('admin/policy',{
    base_version:policy.id,note:'Verify affordability threshold on synthetic evidence',thresholds:{emi_cap_pct:revised}
  })).data;
  try {
    assert.ok(after.policy.id>policy.id);
    assert.equal(after.history[0].id,after.policy.id);
    assert.equal((await borrower.session.get('credit')).data.capacity,revised*10000);
    await admin.put('admin/policy',{base_version:policy.id,note:'Check conflicting edit',thresholds:{emi_cap_pct:previous}},409);
  } finally {
    await admin.put('admin/policy',{base_version:after.policy.id,note:'Restore original synthetic policy',thresholds:{emi_cap_pct:previous}});
  }
});
