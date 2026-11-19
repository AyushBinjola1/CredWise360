import {expect,test,type APIRequestContext} from '@playwright/test';
import {uniqueUser} from '../helpers.mjs';

async function write(request:APIRequestContext,path:string,data:object,method='POST'){
 const reply=await request.fetch('/api/'+path,{method,headers:{'X-CredWise-Action':'1'},data});
 const body=await reply.json();
 expect(reply.ok(),method+' '+path+' '+(body.error?.message||'')).toBeTruthy();
 return body.data;
}

test('borrower recovers a lost receipt, settles the loan and downloads its closure certificate',async({page,browser,baseURL})=>{
 const staff=await browser.newContext({baseURL});
 try{
  const customer=uniqueUser('servicing-ui');
  const account=await write(page.request,'auth/register',customer);
  await write(staff.request,'auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  await write(page.request,'profile',{salary:8200000,essential:2100000,discretionary:600000,existing_emi:150000,savings:900000,reserves:10000000,credit_months:30,on_time:28,stability_months:24,income_regularity:98},'PUT');
  const evidence={name:'demo-evidence.txt',mime:'text/plain',content_base64:Buffer.from('CREDWISE-SYNTHETIC financial lifecycle').toString('base64')};
  await write(page.request,'kyc',{legal_name:customer.name,address:'Example Campus Lane',employment:'Salaried',pan:'DEMOS1043W',document:evidence});
  await write(staff.request,'admin/kyc/'+account.user.id,{status:'verified',reason:'Synthetic proof reviewed.'});
  const draft=await write(page.request,'applications',{product_slug:'emergency',principal:1200000,months:6,purpose:'Emergency expense'});
  const path='applications/'+draft.application.id;
  await write(page.request,path,{documents:draft.required_documents.map((kind:string)=>({kind,...evidence}))},'PUT');
  const preview=await write(page.request,path+'/preview',{});
  await write(page.request,path+'/submit',{confirmed:true,preview_token:preview.application.preview_token});
  const approval=await write(staff.request,'admin/'+path+'/decision',{action:'approve',note:'Reviewed verified identity, purpose and affordable synthetic terms.'});
  await write(page.request,path+'/accept',{confirmed:true,offer_version:approval.offer.version});
  const funded=await write(page.request,path+'/disburse',{});
  const id=funded.application.loan_id,loanPath='loans/'+id;
  const read=async(r:string)=>(await (await page.request.get('/api/'+r)).json()).data;
  const before=await read(loanPath);
  const profile=await read('profile');
  expect(profile.profile.existing_emi).toBe(150000);
  expect(profile.effective_profile.existing_emi).toBe(150000+before.loan.emi);
  expect(profile.portfolio.debt).toBe(1200000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/app/loans/'+id);
  await page.getByLabel('Simulated payment date').fill(before.loan.next_due_date);
  await page.getByRole('button',{name:'Review payment'}).click();
  await expect(page.getByRole('button',{name:'Confirm payment'})).toBeVisible();
  await page.route('**/api/'+loanPath+'/payments',async route=>{
   const posted=await route.fetch();expect(posted.status()).toBe(201);await route.abort('failed');
  },{times:1});
  await page.getByRole('button',{name:'Confirm payment'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Check payment result'}).click();
  await expect(page.getByRole('status')).toContainText('Payment recorded');
  const after=await read(loanPath);
  expect(after.transactions.filter((row:{kind:string})=>row.kind==='emi')).toHaveLength(1);
  expect(after.loan.outstanding).toBeLessThan(before.loan.outstanding);
  await page.getByLabel('Payment type').selectOption('foreclosure');
  await page.getByLabel('Simulated payment date').fill(before.loan.next_due_date);
  await page.getByRole('button',{name:'Review payment'}).click();
  await page.getByRole('button',{name:'Confirm payment'}).click();
  await page.getByRole('link',{name:'View closure certificate'}).click();
  const certificate=await read(loanPath+'/certificate');
  await expect(page.getByRole('heading',{name:certificate.title})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download certificate'}).click();
  expect((await download).suggestedFilename()).toBe(certificate.reference+'.html');
  expect((await read(path)).application.status).toBe('closed');
  const finalProfile=await read('profile');
  expect(finalProfile.portfolio.debt).toBe(0);expect(finalProfile.effective_profile.existing_emi).toBe(150000);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await staff.close();}
});
