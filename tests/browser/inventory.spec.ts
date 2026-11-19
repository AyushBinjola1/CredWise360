import {expect,test,type APIRequestContext,type Page} from '@playwright/test';
import {uniqueUser} from '../helpers.mjs';

async function write(request:APIRequestContext,path:string,data:object,method='POST'){
 const reply=await request.fetch('/api/'+path,{method,headers:{'X-CredWise-Action':'1'},data});
 expect(reply.ok(),method+' '+path).toBeTruthy();
}
const customerRoutes=['','profile','credit','market','applications','loans','repayments','recovery','calculator','compare','safety','twin','debt','stress','education','distress','academy','rewards','disputes','notifications','reports','kyc','settings'];
const adminRoutes=['','applications','loans','repayments','disputes','distress','fairness','fraud','reports','policy','products','users','kyc','settings'];
const widths=[360,768,1440];

async function audit(page:Page,url:string,problems:string[]){
 const errors:string[]=[];
 const onError=(e:Error)=>errors.push('pageerror: '+e.message);
 const onConsole=(m:{type():string;text():string})=>{if(m.type()==='error')errors.push('console: '+m.text());};
 page.on('pageerror',onError);page.on('console',onConsole);
 const response=await page.goto(url);
 await page.waitForLoadState('networkidle');
 page.off('pageerror',onError);page.off('console',onConsole);
 if(!response||response.status()>=400)problems.push(url+' returned '+response?.status());
 for(const e of errors)problems.push(url+' '+e);
 const report=await page.evaluate(()=>{
  const visible=(el:Element)=>{const r=(el as HTMLElement).getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&!el.closest('dialog:not([open])')&&!el.closest('[hidden]');};
  const named=(el:Element)=>!!((el.getAttribute('aria-label')||'').trim()||el.getAttribute('aria-labelledby')||(el.textContent||'').trim()||el.getAttribute('title')||el.querySelector('img[alt]:not([alt=""])'));
  const controls=[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible).filter(el=>{const c=el as HTMLInputElement;return !(c.labels&&c.labels.length)&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!el.getAttribute('title');}).map(el=>el.outerHTML.slice(0,90));
  const buttons=[...document.querySelectorAll('button,a[href],[role=button]')].filter(visible).filter(el=>!named(el)).map(el=>el.outerHTML.slice(0,90));
  const images=[...document.querySelectorAll('img')].filter(visible).filter(el=>!el.hasAttribute('alt')).map(el=>el.outerHTML.slice(0,90));
  return {h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,overflow:document.documentElement.scrollWidth>window.innerWidth+1,controls,buttons,images,lang:document.documentElement.lang};
 });
 if(report.h1!==1)problems.push(url+' has '+report.h1+' h1 elements');
 if(report.main<1)problems.push(url+' has no main landmark');
 if(report.overflow)problems.push(url+' scrolls horizontally');
 if(!report.lang)problems.push(url+' has no document language');
 for(const c of report.controls)problems.push(url+' unlabeled control '+c);
 for(const b of report.buttons)problems.push(url+' unnamed button or link '+b);
 for(const i of report.images)problems.push(url+' image without alt '+i);
}
async function keyboard(page:Page,url:string,problems:string[]){
 await page.goto(url);
 await page.waitForLoadState('networkidle');
 const seen=new Set<string>();
 for(let i=0;i<6;i++){
  await page.keyboard.press('Tab');
  const info=await page.evaluate(()=>{const el=document.activeElement as HTMLElement|null;if(!el||el===document.body)return null;const s=getComputedStyle(el);
   return {id:el.tagName+':'+(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,30),indicator:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0||s.boxShadow!=='none'};});
  if(!info){problems.push(url+' Tab left focus on the page body');break;}
  seen.add(info.id);
  if(!info.indicator)problems.push(url+' focus is not visible on '+info.id);
 }
 if(seen.size<3)problems.push(url+' keyboard focus does not advance through controls');
}

test('every customer and administrator route renders without errors, overflow or unlabeled controls, and is keyboard reachable',async({page,browser,baseURL})=>{
 test.setTimeout(240000);
 const problems:string[]=[];
 const staff=await browser.newContext({baseURL});
 try{
  await write(page.request,'auth/register',uniqueUser('inventory'));
  await write(page.request,'profile',{salary:8500000,essential:2400000,discretionary:550000,savings:1400000,existing_emi:200000,debt:1800000,reserves:11000000,credit_months:48,stability_months:44,utilization:20,on_time:44,missed:0,income_regularity:98},'PUT');
  await write(staff.request,'auth/login',{email:'admin@credwise.test',password:'CredWiseDemo!360'});
  const admin=await staff.newPage();
  for(const width of widths){
   await page.setViewportSize({width,height:900});await admin.setViewportSize({width,height:900});
   for(const r of customerRoutes)await audit(page,'/app'+(r?'/'+r:''),problems);
   for(const r of adminRoutes)await audit(admin,'/admin'+(r?'/'+r:''),problems);
  }
  await page.setViewportSize({width:1440,height:900});
  for(const r of ['','safety','academy','disputes','loans'])await keyboard(page,'/app'+(r?'/'+r:''),problems);
  await admin.setViewportSize({width:1440,height:900});
  for(const r of ['','fairness','disputes'])await keyboard(admin,'/admin'+(r?'/'+r:''),problems);
  // Unknown routes and role boundaries behave.
  expect((await page.goto('/app/does-not-exist'))?.status()).toBe(404);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/app/);
 }finally{await staff.close();}
 expect(problems,problems.join('\n')).toEqual([]);
});
