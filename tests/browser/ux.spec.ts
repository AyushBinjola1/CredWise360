import {expect,test,type APIRequestContext,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {uniqueUser} from '../helpers.mjs';

async function write(request:APIRequestContext,path:string,data:object,method='POST'){
 const reply=await request.fetch('/api/'+path,{method,headers:{'X-CredWise-Action':'1'},data});
 expect(reply.ok(),method+' '+path+' '+(await reply.text()).slice(0,120)).toBeTruthy();
 return (await reply.json()).data;
}
const profile={salary:8500000,essential:2400000,discretionary:550000,savings:1400000,existing_emi:200000,debt:1800000,reserves:3000000,credit_months:48,stability_months:44,utilization:20,on_time:44,missed:0,income_regularity:98,goal:'Build reserves',goal_amount:9000000};
const noOverflow=(page:Page)=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
async function signedInBorrower(page:Page){
 await write(page.request,'auth/register',uniqueUser('ux-ui'));
 await write(page.request,'profile',profile,'PUT');
}

test('theme follows the operating system until chosen, with no flash',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.addInitScript(()=>{(window as unknown as {first:string}).first='';document.addEventListener('DOMContentLoaded',()=>{(window as unknown as {first:string}).first=document.documentElement.dataset.theme||'';});});
 await page.goto('/');
 expect(await page.evaluate(()=>(window as unknown as {first:string}).first)).toBe('dark');   // already dark when the DOM was parsed
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Use light theme'}).click();
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');                   // an explicit choice wins over the system
 await page.emulateMedia({colorScheme:'light'});
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('landing page presents the product, stays honest and fits every width in both themes',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
 for(const id of ['product','twin','debt','education','safety','principles','guide','learn','faq'])await expect(page.locator('#'+id)).toBeAttached();
 await expect(page.getByText('An educational simulation',{exact:true})).toBeVisible();
 const text=await page.locator('main').innerText();
 for(const forbidden of [/testimonial/i,/\d+ ?(\+|k|m)? (customers|users|borrowers)/i,/award[- ]winning/i,/regulated by/i,/licensed by/i,/rbi/i])expect(text).not.toMatch(forbidden);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>{localStorage.setItem('cw-theme',t);document.documentElement.dataset.theme=t;},theme);
  for(const name of ['dashboard','twin','debt','education','safety','academy']){
   const img=page.locator(`img.shot-${theme}[src*="${name}-${theme}"]`);
   await img.scrollIntoViewIfNeeded();
   await expect(img).toBeVisible();
   expect(await img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0),name+' '+theme).toBeTruthy();
   await expect(page.locator(`img.shot-${theme==='light'?'dark':'light'}[src*="${name}-"]`)).toBeHidden();
  }
  for(const width of [320,375,414,640,768,1024,1440,1920,2560]){await page.setViewportSize({width,height:900});expect(await noOverflow(page),`${theme} ${width}`).toBeTruthy();}
 }
 const first=page.locator('.faq details').first();
 await first.locator('summary').focus();
 await page.keyboard.press('Enter');
 await expect(first).toHaveAttribute('open','');
 await page.keyboard.press('Enter');
 await expect(first).not.toHaveAttribute('open','');
});

test('customer dashboard shows the borrower’s own data, goals and next steps',async({page})=>{
 await signedInBorrower(page);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/app');
 await expect(page.getByRole('heading',{name:/^Hello,/})).toBeVisible();
 await expect(page.getByRole('img',{name:/Financial health score: \d+ out of 100/})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Recommended next steps'})).toBeVisible();
 await expect(page.getByText(/Savings cover 1\.[12] months/)).toBeVisible();                     // the rule reads the profile: under three months of cover is a prompt
 await expect(page.getByText('33%',{exact:true})).toBeVisible();                              // 30,000 of the 90,000 goal
 await expect(page.getByText('You have no active loans, so there is no debt to clear.')).toBeVisible();
 for(const label of ['Outstanding debt','Next EMI','Room for a new EMI','Applications'])await expect(page.locator('.kpi-label',{hasText:label})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await noOverflow(page)).toBeTruthy();
 const kpis=await page.locator('.kpi').evaluateAll(els=>els.slice(0,2).map(e=>Math.round(e.getBoundingClientRect().top)));
 expect(kpis[0]).toBe(kpis[1]);                                                               // two KPI cards per row on a phone
});

test('sidebar collapses, groups fold and the account menu is keyboard accessible',async({page})=>{
 await signedInBorrower(page);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/app');
 const workspace=page.locator('.workspace');
 await page.getByRole('button',{name:'Collapse sidebar'}).click();
 await expect(workspace).toHaveAttribute('data-collapsed','true');
 await expect(page.locator('.side .navlabel').first()).toBeHidden();
 await expect(page.locator('.side nav a[title="My loans"]')).toBeVisible();                   // icon-only links keep their names
 await expect(page.locator('.side nav a[aria-label="My loans"]')).toHaveCount(1);
 await page.reload();
 await expect(workspace).toHaveAttribute('data-collapsed','true');                           // the choice persists
 await page.getByRole('button',{name:'Expand sidebar'}).click();
 await expect(workspace).toHaveAttribute('data-collapsed','false');

 const planning=page.getByRole('button',{name:'Planning'});
 await expect(planning).toHaveAttribute('aria-expanded','true');
 await planning.click();
 await expect(planning).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('.side nav').getByRole('link',{name:'Debt freedom'})).toBeHidden();
 await planning.click();
 await expect(page.locator('.side nav').getByRole('link',{name:'Debt freedom'})).toBeVisible();

 const trigger=page.getByRole('button',{name:'Account menu'});
 await trigger.focus();await page.keyboard.press('Enter');
 await expect(trigger).toHaveAttribute('aria-expanded','true');
 await expect(page.getByRole('menuitem',{name:'Account settings'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(trigger).toHaveAttribute('aria-expanded','false');
 await expect(trigger).toBeFocused();
 await page.goto('/app/loans');
 await expect(page.locator('.crumb [aria-current=page]')).toHaveText('My loans');
 await trigger.click();
 await page.getByRole('menuitem',{name:'Sign out'}).click();
 await expect(page).toHaveURL(/\/login\/?$/);
});

test('administrator queue sorts on the server and data tables become cards on phones',async({page,browser,baseURL})=>{
 const staff=await browser.newContext({baseURL});
 try{
  await write(staff.request,'auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  const admin=await staff.newPage();
  await admin.setViewportSize({width:1440,height:900});
  await admin.goto('/admin/applications');
  const amount=admin.getByRole('button',{name:/^Amount/});
  const sorted=admin.waitForRequest(r=>r.url().includes('sort=amount')&&r.url().includes('dir=asc'));
  await amount.click();
  await sorted;
  await expect(admin.locator('th',{has:amount})).toHaveAttribute('aria-sort','ascending');
  await amount.click();
  await expect(admin.locator('th',{has:amount})).toHaveAttribute('aria-sort','descending');
  await admin.setViewportSize({width:390,height:844});
  const table=admin.locator('table.datatable').first();
  await expect(table).toHaveClass(/as-cards/);
  await expect(table.locator('tbody td').first()).toHaveAttribute('data-label',/\S/);
  expect(await noOverflow(admin)).toBeTruthy();
  await admin.goto('/admin/audit');
  await expect(admin.getByRole('heading',{name:'Audit trail'})).toBeVisible();
  await expect(admin.getByRole('button',{name:'Audit report PDF'})).toBeVisible();
  await expect(admin.locator('table.datatable tbody tr').first()).toBeVisible();
  await staff.close();
 }finally{await staff.close().catch(()=>{});}
});

test('key pages pass automated WCAG checks in both themes',async({page,browser,baseURL})=>{
 test.setTimeout(180000);
 const failures:string[]=[];
 const scan=async(p:Page,url:string,theme:string)=>{
  await p.evaluate(t=>{localStorage.setItem('cw-theme',t);document.documentElement.dataset.theme=t;},theme);
  await p.goto(url);await p.waitForLoadState('networkidle');
  const result=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  for(const v of result.violations)if(v.impact==='critical'||v.impact==='serious')failures.push(`${theme} ${url} ${v.id} ${v.nodes[0]?.target?.join(' ')}`);
 };
 await page.goto('/');
 for(const theme of ['light','dark'])for(const url of ['/','/login','/calculator','/products'])await scan(page,url,theme);
 await signedInBorrower(page);
 for(const theme of ['light','dark'])for(const url of ['/app','/app/twin','/app/safety','/app/academy','/app/rewards','/app/distress','/app/settings'])await scan(page,url,theme);
 const staff=await browser.newContext({baseURL});
 await write(staff.request,'auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
 const admin=await staff.newPage();
 await admin.goto('/admin');
 for(const theme of ['light','dark'])for(const url of ['/admin','/admin/applications','/admin/audit','/admin/fairness','/admin/disputes'])await scan(admin,url,theme);
 await staff.close();
 expect(failures,failures.join('\n')).toEqual([]);
});
