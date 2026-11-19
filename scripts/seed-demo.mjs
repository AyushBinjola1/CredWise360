// Seeds a realistic demonstration portfolio by driving the public REST workflows of a running CredWise stack.
// Usage: WEB_URL=http://127.0.0.1:3000 node scripts/seed-demo.mjs   (requires DEMO_MODE=1 on the API)
import {client} from '../tests/helpers.mjs';

const PASSWORD = 'CredWiseDemo!360';
const proof = kind => ({kind, name: 'synthetic-evidence.txt', mime: 'text/plain',
  content_base64: Buffer.from('CREDWISE-SYNTHETIC\n' + kind).toString('base64')});

async function signIn(email, name, profile, pan) {
  const session = client();
  let existing = true;
  try { await session.post('auth/login', {email, password: PASSWORD}); } catch { existing = false; }
  if (existing) return {session, created: false};
  const registered = client();
  const {data} = await registered.post('auth/register', {email, name, password: PASSWORD}, 201);
  await registered.put('profile', profile);
  await registered.post('kyc', {legal_name: name, address: 'Synthetic Residency, Example Nagar', employment: profile.employment,
    pan, document: proof('Identity verification')}, 201);
  await admin.post('admin/kyc/' + data.user.id, {status: 'verified', reason: 'Reviewed the synthetic demonstration document.'});
  return {session: registered, created: true};
}
async function apply(session, terms, {submit = true} = {}) {
  const created = (await session.post('applications', terms, 201)).data;
  const path = 'applications/' + created.application.id;
  await session.put(path, {documents: created.required_documents.map(proof)});
  const preview = (await session.post(path + '/preview', {})).data;
  if (submit) await session.post(path + '/submit', {confirmed: true, preview_token: preview.application.preview_token});
  return path;
}
const admin = client();
await admin.post('auth/login', {email: 'admin@credwise.test', password: PASSWORD});
const pay = (session, loan, key, body) => session.request('POST', `loans/${loan}/payments`, {body, status: 201, headers: {'Idempotency-Key': key}});

// The demo borrower already exists in demo mode. Give the account a funded, partly repaid loan and an application in underwriting.
const aarav = client();
await aarav.post('auth/login', {email: 'borrower@credwise.test', password: PASSWORD});
const existing = (await aarav.get('applications')).data;
if (existing.total > 0) {
  console.log('Demonstration data already present. No changes made.');
  process.exit(0);
}
const path = await apply(aarav, {product_slug: 'personal', purpose: 'Home renovation and furnishing', principal: 10000000, months: 24});
const approved = (await admin.post('admin/' + path + '/decision', {action: 'approve', note: 'Verified identity, income and healthy repayment headroom.'})).data;
await aarav.post(path + '/accept', {confirmed: true, offer_version: approved.offer.version});
const loan = (await aarav.post(path + '/disburse', {})).data.application.loan_id;
for (const n of [1, 2]) await pay(aarav, loan, `seed-aarav-emi-${n}-${loan}`, {kind: 'emi'});
await apply(aarav, {product_slug: 'education', purpose: 'Executive education course fees', principal: 20000000, months: 36});

// Diya: strong profile, a rejected request with a recovery roadmap, and a live application.
const diya = await signIn('diya.nair@credwise.test', 'Diya Nair', {salary: 4200000, essential: 2200000, discretionary: 600000,
  savings: 200000, existing_emi: 900000, debt: 3200000, reserves: 1200000, credit_months: 30, stability_months: 20, utilization: 72,
  on_time: 20, missed: 4, income_regularity: 85, employment: 'Salaried'}, 'DEMOD2301N');
if (diya.created) {
  const rejected = await apply(diya.session, {product_slug: 'personal', purpose: 'Wedding expenses', principal: 80000000, months: 24});
  await admin.post('admin/' + rejected + '/decision', {action: 'reject', note: 'The proposed instalment exceeds current monthly capacity.', reason_code: 'affordability'});
  await apply(diya.session, {product_slug: 'emergency', purpose: 'Medical expenses', principal: 3000000, months: 12});
}

// Rohan: thin credit file assessed from alternative evidence, with a pending application.
const rohan = await signIn('rohan.iyer@credwise.test', 'Rohan Iyer', {salary: 3200000, essential: 1300000, discretionary: 400000,
  savings: 350000, existing_emi: 0, debt: 0, reserves: 1500000, credit_months: 0, stability_months: 14, utilization: 0,
  on_time: 0, missed: 0, income_regularity: 92, rent: 100, utilities: 95, consent: true, employment: 'Self-employed'}, 'DEMOR9150K');
if (rohan.created) await apply(rohan.session, {product_slug: 'microfinance', purpose: 'Working capital for a tailoring shop', principal: 5000000, months: 12});

console.log('Demonstration data created. Sign in as borrower@credwise.test, diya.nair@credwise.test, rohan.iyer@credwise.test or admin@credwise.test.');
