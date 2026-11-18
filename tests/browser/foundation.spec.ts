import {test,expect} from '@playwright/test';
test('public landing, responsive layout, real image and persistent theme',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await expect(page.locator('.hero-photo img')).toBeVisible();
 expect(await page.locator('.hero-photo img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBeTruthy();
 await page.getByRole('button',{name:'Use dark theme'}).click();
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Use light theme'}).click();
 for(const width of [360,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:860});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
 expect(errors).toEqual([]);
});
