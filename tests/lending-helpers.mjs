import {client,registerCustomer} from './helpers.mjs';

const letters='ABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomPan=()=>'DEMO'+letters[Math.floor(Math.random()*24)]+String(Math.floor(Math.random()*10000)).padStart(4,'0')+letters[Math.floor(Math.random()*24)];
export const proof=kind=>({kind,name:'synthetic-evidence.txt',mime:'text/plain',
  content_base64:Buffer.from('CREDWISE-SYNTHETIC\n'+kind).toString('base64')});
export const goodProfile={salary:8500000,essential:2400000,discretionary:550000,savings:1400000,existing_emi:200000,
  debt:1800000,reserves:11000000,credit_months:48,stability_months:44,utilization:20,on_time:44,missed:0,income_regularity:98};

export async function adminSession() {
  const admin=client();
  await admin.post('auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  return admin;
}
export async function borrower(label,profile=goodProfile) {
  const {session,credentials,data}=await registerCustomer(label);
  const admin=await adminSession();
  await session.put('profile',profile);
  await session.post('kyc',{legal_name:credentials.name,address:'Synthetic Court 4',employment:'Salaried',pan:randomPan(),document:proof('Identity verification')},201);
  await admin.post('admin/kyc/'+data.user.id,{status:'verified',reason:'Reviewed the synthetic proof.'});
  return {session,admin,user:data.user};
}
export async function draftAndSubmit(session,terms={}) {
  const created=(await session.post('applications',{product_slug:'personal',purpose:'Household repair',principal:2500000,months:12,...terms},201)).data;
  const path='applications/'+created.application.id;
  const preview=(await session.post(path+'/preview',{})).data;
  await session.put(path,{documents:created.required_documents.map(proof)});
  await session.post(path+'/submit',{confirmed:true,preview_token:preview.application.preview_token});
  return path;
}
export async function fundLoan(session,admin,terms={}) {
  const path=await draftAndSubmit(session,terms);
  const approved=(await admin.post('admin/'+path+'/decision',{action:'approve',note:'Affordable and verified.'})).data;
  await session.post(path+'/accept',{confirmed:true,offer_version:approved.offer.version});
  return (await session.post(path+'/disburse',{})).data.application.loan_id;
}
export const payment=(session,loan,key,body,status=201)=>session.request('POST',`loans/${loan}/payments`,{body,status,headers:{'Idempotency-Key':key}});
export const addDays=(iso,days)=>new Date(Date.parse(iso+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
