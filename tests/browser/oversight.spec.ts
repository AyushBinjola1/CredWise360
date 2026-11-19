import {expect,test,type APIRequestContext,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {uniqueUser} from '../helpers.mjs';

async function write(request:APIRequestContext,path:string,data:object,method='POST'){
 const reply=await request.fetch('/api/'+path,{method,headers:{'X-CredWise-Action':'1'},data});
 const body=await reply.json();
 expect(reply.ok(),method+' '+path+' '+(body.error?.message||'')).toBeTruthy();
 return body.data;
}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),'overflow at '+page.url()).toBeFalsy();}
const profile={salary:8500000,essential:2400000,discretionary:550000,savings:1400000,existing_emi:200000,debt:1800000,reserves:11000000,credit_months:48,stability_months:44,utilization:20,on_time:44,missed:0,income_regularity:98};

test('borrower uses the safety scanner, wellbeing check, academy, rewards, support and PDF downloads',async({page,browser,baseURL})=>{
 const staff=await browser.newContext({baseURL,acceptDownloads:true});
 try{
  await write(page.request,'auth/register',uniqueUser('oversight-ui'));
  await write(page.request,'profile',profile,'PUT');
  await write(staff.request,'auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   await page.goto('/app/safety');
   await page.getByRole('button',{name:'Load an example offer'}).click();
   await page.getByRole('button',{name:'Scan this offer'}).click();
   await expect(page.getByRole('heading',{name:'High concern'})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Warning signs'})).toBeVisible();
   await expect(page.getByText('Flat-rate interest')).toBeVisible();
   await expect(page.getByRole('heading',{name:'Safe-borrowing checklist'})).toBeVisible();
   await expect(page.getByText(/do not establish that a lender is fraudulent/)).toBeVisible();
   await noOverflow(page);
   await page.goto('/app/distress');
   await expect(page.getByRole('heading',{name:'Financial wellbeing check'})).toBeVisible();
   await expect(page.getByText('never changes your score')).toBeVisible();
   await noOverflow(page);
  }
  // Academy in Hindi, a wrong answer then the right one, with progress surviving a reload.
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/app/academy');
  await page.getByRole('button',{name:'हिन्दी'}).click();
  await expect(page.getByRole('heading',{name:'वित्तीय साक्षरता अकादमी'})).toBeVisible();
  await page.getByRole('link',{name:/पाठ 1/}).first().click();
  await expect(page.locator('article[lang=hi]')).toBeVisible();
  const choices=page.getByRole('radio');
  const count=await choices.count();
  let done=false;
  for(let i=0;i<count&&!done;i++){
   await choices.nth(i).check();
   await page.getByRole('button',{name:'उत्तर जाँचें'}).click();
   const ok=page.getByRole('heading',{name:'सही उत्तर!'});
   await expect(page.getByRole('status').filter({hasText:/सही|अभी नहीं/})).toBeVisible();
   if(await ok.count())done=true;else await page.getByRole('button',{name:'फिर कोशिश करें'}).click();
  }
  expect(done).toBeTruthy();
  await page.goto('/app/academy');
  await expect(page.getByText('1 / 11 · 9%')).toBeVisible();
  await page.goto('/app/rewards');
  await expect(page.getByText('First lesson',{exact:true})).toBeVisible();
  await expect(page.getByText('+10')).toBeVisible();
  await expect(page.getByText(/never earn points for applying for/)).toBeVisible();
  await noOverflow(page);

  // Support ticket: customer raises it, administrator responds in a separate session, customer sees the answer.
  await page.goto('/app/disputes');
  await page.getByRole('button',{name:'New ticket'}).click();
  await page.getByLabel('Subject').fill('Wrong savings figure');
  await page.getByLabel('Describe the issue').fill('My emergency savings figure looks lower than my statement.');
  await page.getByRole('button',{name:'Submit ticket'}).click();
  await expect(page.getByRole('heading',{name:'Wrong savings figure'})).toBeVisible();
  const ticketUrl=page.url();
  const admin=await staff.newPage();
  await admin.goto('/admin/disputes');
  await admin.getByRole('link',{name:'#'+ticketUrl.split('/').pop()}).first().click();
  await admin.getByLabel('Response to the customer').fill('We checked and corrected the figure.');
  await admin.getByLabel('New status').selectOption('resolved');
  await admin.getByRole('button',{name:'Send response'}).click();
  await expect(admin.getByText('We checked and corrected the figure.').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Resolution')).toBeVisible();
  await expect(page.getByText('We checked and corrected the figure.').first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Reopen ticket'})).toBeVisible();

  // PDF downloads are real PDFs.
  await page.goto('/app/reports');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Financial health PDF'}).click()]);
  expect(download.suggestedFilename()).toBe('financial-health-report.pdf');
  const bytes=readFileSync(await download.path());
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('Financial health report');

  // Fairness monitor and distress watch for the administrator.
  await admin.goto('/admin/fairness');
  await admin.getByRole('button',{name:'Run fairness test'}).click();
  await expect(admin.getByRole('heading',{name:'Protected attributes did not change any outcome'})).toBeVisible();
  await admin.goto('/admin/distress');
  await expect(admin.getByRole('heading',{name:'Distress watch'})).toBeVisible();
 }finally{await staff.close();}
});
