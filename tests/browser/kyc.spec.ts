import {test,expect} from '@playwright/test';
import {uniqueUser} from '../helpers.mjs';
test('customer and administrator complete a synthetic document review in the browser',async({browser,baseURL})=>{
 const borrower=await browser.newContext({baseURL}),staff=await browser.newContext({baseURL});
 try{
  const identity=uniqueUser('kyc-ui'),headers={'X-CredWise-Action':'1'};
  expect((await borrower.request.post('/api/auth/register',{headers,data:identity})).status()).toBe(201);
  expect((await staff.request.post('/api/auth/login',{headers,data:{email:'admin@credwise.test',password:'CredWiseDemo!360'}})).status()).toBe(200);
  const page=await borrower.newPage();await page.goto('/app/kyc');
  await page.getByRole('button',{name:'Fill example'}).click();await page.getByLabel('Synthetic full name').fill(identity.name);
  await page.getByRole('button',{name:'Submit for review'}).click();
  await expect(page.getByText('Your synthetic record was submitted for review.')).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download document'}).click();
  expect((await download).suggestedFilename()).toBe('synthetic-verification.txt');
  const review=await staff.newPage();await review.goto('/admin/kyc');
  await review.getByRole('button').filter({hasText:identity.email}).click();
  await review.getByLabel('Decision',{exact:true}).selectOption('verified');
  await review.getByRole('button',{name:'Record decision'}).click();
  await expect.poll(async()=>(await (await borrower.request.get('/api/kyc')).json()).data.kyc.status).toBe('verified');
  await page.reload();await expect(page.getByText('Verified',{exact:true})).toBeVisible();
 }finally{await borrower.close();await staff.close();}
});
