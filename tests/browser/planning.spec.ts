import {expect,test,type APIRequestContext,type Page} from '@playwright/test';
import {uniqueUser} from '../helpers.mjs';

async function write(request:APIRequestContext,path:string,data:object,method='POST'){
 const reply=await request.fetch('/api/'+path,{method,headers:{'X-CredWise-Action':'1'},data});
 const body=await reply.json();
 expect(reply.ok(),method+' '+path+' '+(body.error?.message||'')).toBeTruthy();
 return body.data;
}
async function noOverflow(page:Page){
 const wide=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 expect(wide,'horizontal overflow at '+page.url()).toBeFalsy();
}

test('borrower runs the twin, stress test, debt navigator and education planner, then admin reviews the portfolio',async({page,browser,baseURL})=>{
 const staff=await browser.newContext({baseURL});
 try{
  await write(page.request,'auth/register',uniqueUser('planning-ui'));
  await write(page.request,'profile',{salary:8500000,essential:2400000,discretionary:550000,savings:1400000,existing_emi:200000,debt:1800000,reserves:11000000,credit_months:48,stability_months:44,utilization:40,on_time:44,missed:0,income_regularity:98},'PUT');
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   await page.goto('/app/twin');
   await page.getByRole('button',{name:/Lower credit utilization/}).click();
   await expect(page.getByText('What moved the score')).toBeVisible();
   await expect(page.getByRole('columnheader',{name:'Scenario'})).toBeVisible();
   await noOverflow(page);

   await page.goto('/app/stress');
   await page.getByRole('button',{name:/Job loss/}).click();
   await expect(page.getByRole('heading',{name:/reserves/i}).first()).toBeVisible();
   await expect(page.getByText('Reserves over time')).toBeVisible();
   await noOverflow(page);

   await page.goto('/app/debt');
   await page.getByRole('button',{name:'Add another debt'}).click();
   await page.getByLabel('Name',{exact:true}).fill('Store card');
   await page.getByLabel('Balance (₹)').fill('50000');
   await page.getByLabel('Annual rate (%)').fill('36');
   await page.getByLabel('Minimum payment (₹)').fill('2000');
   await page.getByLabel('Total monthly amount for debt (₹)').fill('4000');
   await page.getByRole('button',{name:'Compare strategies'}).click();
   await expect(page.getByText('Debt-free in')).toBeVisible();
   await expect(page.getByText('Payoff order')).toBeVisible();
   await noOverflow(page);

   await page.goto('/app/education');
   await page.getByRole('button',{name:'Project my loan'}).click();
   await expect(page.getByText('Repayment outlook')).toBeVisible();
   await expect(page.getByText('Compare repayment periods')).toBeVisible();
   await noOverflow(page);
  }
  await page.getByLabel('Scenario name').fill('Browser plan');
  await page.getByRole('button',{name:'Save scenario'}).click();
  await expect(page.getByText('Saved to your scenarios.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Browser plan')).toBeVisible();

  await page.goto('/app/notifications');
  await expect(page.getByRole('heading',{name:'Notifications'})).toBeVisible();
  await page.goto('/app/reports');
  await expect(page.getByRole('heading',{name:'My reports'})).toBeVisible();

  await write(staff.request,'auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  const admin=await staff.newPage();
  await admin.setViewportSize({width:1440,height:900});
  for(const [path,heading] of [['/admin','Executive overview'],['/admin/fraud','Fraud review'],['/admin/reports','Portfolio reports']]){
   await admin.goto(path);
   await expect(admin.getByRole('heading',{name:heading})).toBeVisible();
  }
  await admin.goto('/admin');
  await expect(admin.getByText('Approval rate')).toBeVisible();
  await expect(admin.getByText('Open fraud cases')).toBeVisible();
  await admin.setViewportSize({width:390,height:844});
  await admin.goto('/admin/reports');
  await noOverflow(admin);
 }finally{await staff.close();}
});
