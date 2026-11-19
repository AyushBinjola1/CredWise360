import {expect,test,type APIRequestContext,type Page} from '@playwright/test';
import {uniqueUser} from '../helpers.mjs';

async function write(request:APIRequestContext,path:string,data:object,method='POST'){
 const reply=await request.fetch('/api/'+path,{method,headers:{'X-CredWise-Action':'1'},data});
 expect(reply.ok(),method+' '+path).toBeTruthy();
}
const visible=(page:Page,selector:string)=>page.locator(selector).evaluateAll(els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none';}).length);
async function setTheme(page:Page,theme:'light'|'dark'){await page.evaluate(t=>{localStorage.setItem('cw-theme',t);document.documentElement.dataset.theme=t;},theme);}

test('brand assets are valid vectors with transparent backgrounds and accessible titles',async({request})=>{
 for(const name of ['icon','wordmark','logo']){
  for(const mode of ['light','dark']){
   const reply=await request.get(`/brand/${name}-${mode}.svg`);
   expect(reply.status()).toBe(200);
   expect(reply.headers()['content-type']).toContain('image/svg+xml');
   const svg=await reply.text();
   expect(svg).toContain('viewBox=');
   expect(svg).toContain('<title>CredWise 360</title>');
   expect(svg).not.toMatch(/<rect[^>]*fill="#(?:FAF9F6|FFFFFF|111827)"[^>]*width="100%"/i);   // no background plate
   expect(svg).not.toContain('<image');                                                         // pure vector, no embedded bitmap
   expect(svg.length).toBeLessThan(12000);
   expect(svg.toLowerCase()).toContain(mode==='light'?'#008638':'#00d64f');
  }
 }
});

test('logo follows the active theme, keeps its size and never shifts the layout',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>{
  (window as unknown as {shifts:string[]}).shifts=[];
  new PerformanceObserver(list=>{for(const entry of list.getEntries() as unknown as {hadRecentInput:boolean;sources?:{node?:Node}[]}[]){
   if(entry.hadRecentInput)continue;
   for(const source of entry.sources||[]){const node=source.node as Element|undefined;if(node&&node.closest&&node.closest('.brand,.logo'))(window as unknown as {shifts:string[]}).shifts.push(node.className||node.tagName);}
  }}).observe({type:'layout-shift',buffered:true});
 });
 await page.goto('/');
 await page.waitForLoadState('networkidle');
 const header=page.locator('.public-header .bar .brand');
 await expect(header.locator('.brand-full img.logo-light')).toBeVisible();
 await expect(header.locator('.brand-full img.logo-dark')).toBeHidden();
 expect(await visible(page,'.public-header .bar .brand img')).toBe(1);
 for(const img of await page.locator('.public-header .bar .brand img').all()){
  expect(await img.getAttribute('width')).not.toBeNull();
  expect(await img.getAttribute('height')).not.toBeNull();
  expect(await img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBeTruthy();
 }
 const before=await header.boundingBox();
 await setTheme(page,'dark');
 await expect(header.locator('.brand-full img.logo-dark')).toBeVisible();
 await expect(header.locator('.brand-full img.logo-light')).toBeHidden();
 const after=await header.boundingBox();
 expect(after).toEqual(before);                                   // same box in both themes
 expect(await page.evaluate(()=>(window as unknown as {shifts:string[]}).shifts)).toEqual([]);
 expect(after!.height).toBeGreaterThanOrEqual(30);
 // The footer uses the full logo too.
 await expect(page.locator('footer .brand img.logo-dark')).toBeVisible();
});

test('compact layouts show the icon alone and wide layouts show the full logo',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('.public-header .bar .brand-compact img.logo-light')).toBeVisible();
 await expect(page.locator('.public-header .bar .brand-full img.logo-light')).toBeHidden();
 const compact=await page.locator('.public-header .bar .brand-compact img.logo-light').boundingBox();
 expect(compact!.width/compact!.height).toBeCloseTo(230.97/250.97,1);   // icon proportions preserved
 await page.setViewportSize({width:1440,height:900});
 await expect(page.locator('.public-header .bar .brand-full img.logo-light')).toBeVisible();
 await expect(page.locator('.public-header .bar .brand-compact')).toBeHidden();
 const full=await page.locator('.public-header .bar .brand-full img.logo-light').boundingBox();
 expect(full!.width/full!.height).toBeCloseTo(638.98/136.48,1);          // full-logo proportions preserved
});

test('brand appears in the workspace, mobile navigation, sign-in, error page and loading screen',async({page})=>{
 await write(page.request,'auth/register',uniqueUser('brand-ui'));
 await page.setViewportSize({width:1440,height:900});
 // Hold the profile request so the loading state is on screen: it shows the animated icon.
 await page.route('**/api/profile',async route=>{await new Promise(done=>setTimeout(done,1500));await route.continue();});
 await page.goto('/app');
 await expect(page.locator('.loading .logo-pulse img.logo-light')).toBeVisible();
 await page.unroute('**/api/profile');
 await expect(page.locator('.side .brand img.logo-light')).toBeVisible();
 await setTheme(page,'dark');
 await expect(page.locator('.side .brand img.logo-dark')).toBeVisible();
 await setTheme(page,'light');
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('.topbar .topbar-brand img.logo-light')).toBeVisible();
 await page.getByLabel('Open navigation').click();
 await expect(page.locator('dialog.navdialog .brand img.logo-light')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.context().clearCookies();
 await page.goto('/login');
 await expect(page.locator('.authbar .brand img.logo-light')).toBeVisible();
 const missing=await page.goto('/this-page-does-not-exist');
 expect(missing?.status()).toBe(404);
 await expect(page.locator('main .brand img.logo-light')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();
});

test('favicons, app icons, manifest and social preview are published',async({page,request})=>{
 await page.goto('/');
 const links=await page.locator('head link[rel~="icon"],head link[rel="apple-touch-icon"]').evaluateAll(els=>els.map(e=>({rel:e.getAttribute('rel'),href:e.getAttribute('href')||'',type:e.getAttribute('type')})));
 expect(links.some(l=>l.type==='image/svg+xml')).toBeTruthy();
 expect(links.some(l=>l.href.startsWith('/favicon.ico'))).toBeTruthy();
 expect(links.some(l=>l.rel==='apple-touch-icon')).toBeTruthy();
 for(const l of links){expect((await request.get(l.href)).status(),l.href).toBe(200);}
 const ico=await (await request.get('/favicon.ico')).body();
 expect([...ico.subarray(0,4)]).toEqual([0,0,1,0]);              // valid ICO header
 expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(3);          // 16, 32 and 48 px images
 const manifest=await (await request.get('/manifest.webmanifest')).json();
 const sizes=manifest.icons.map((i:{sizes:string})=>i.sizes);
 expect(sizes).toContain('192x192');expect(sizes).toContain('512x512');
 for(const icon of manifest.icons){
  const reply=await request.get(icon.src);expect(reply.status(),icon.src).toBe(200);
  const png=await reply.body();expect(png.subarray(1,4).toString()).toBe('PNG');
  const [w]=icon.sizes.split('x').map(Number);expect(png.readUInt32BE(16)).toBe(w);
 }
 const og=await page.locator('meta[property="og:image"]').getAttribute('content');
 expect(og).toMatch(/^https?:\/\/.+\/brand\/og-image\.png$/);
 expect(await page.locator('meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image');
 expect(await page.locator('meta[property="og:image:width"]').getAttribute('content')).toBe('1200');
 const image=await (await request.get('/brand/og-image.png')).body();
 expect(image.readUInt32BE(16)).toBe(1200);expect(image.readUInt32BE(20)).toBe(630);
 const themes=await page.locator('meta[name="theme-color"]').evaluateAll(els=>els.map(e=>e.getAttribute('content')));
 expect(themes).toEqual(['#FAF9F6','#111827']);
});
