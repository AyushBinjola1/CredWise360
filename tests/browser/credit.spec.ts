import {test,expect} from '@playwright/test';
test('borrower credit factors and administrator policy load from separate sessions',async({page})=>{
 const access=async(email:string)=>page.request.post('/api/auth/login',{headers:{'X-CredWise-Action':'1'},data:{email,password:'CredWiseDemo!360'}});
 expect((await access('borrower@credwise.test')).status()).toBe(200);
 const assessment=(await (await page.request.get('/api/credit')).json()).data;
 await page.goto('/app/credit');
 await expect(page.getByRole('heading',{name:'Understand your credit'})).toBeVisible();
 await expect(page.locator('.scoreface strong')).toHaveText(String(assessment.score));
 await expect(page.locator('.factor')).toHaveCount(assessment.factors.length);
 await page.request.post('/api/auth/logout',{headers:{'X-CredWise-Action':'1'},data:{}});
 expect((await access('admin@credwise.test')).status()).toBe(200);
 await page.goto('/admin/policy');
 await expect(page.getByRole('heading',{name:'Scoring policy'})).toBeVisible();
 await expect(page.getByLabel('Reason for policy change')).toBeVisible();
 await page.goto('/admin/products');await expect(page.getByLabel('Annual interest (%)')).toBeVisible();
});

test('borrower receives a priced recommendation for the exact requested amount',async({page})=>{
 const headers={'X-CredWise-Action':'1'};
 expect((await page.request.post('/api/auth/login',{headers,data:{email:'borrower@credwise.test',password:'CredWiseDemo!360'}})).status()).toBe(200);
 await page.goto('/app/market');
 await page.getByLabel('Requested amount',{exact:true}).fill('50000');
 await page.getByLabel('Requested term',{exact:true}).fill('24');
 const reply=page.waitForResponse(r=>r.url().endsWith('/api/recommendations')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Find matches'}).click();
 const {data}=await (await reply).json();
 expect(data.items.length).toBeGreaterThan(0);
 expect(data.items[0].quote.principal).toBe(5000000);
 await expect(page.locator('.market-matches')).toContainText(data.items[0].product.name);
 await expect(page.locator('.market-matches')).toContainText(data.items[0].compatibility+'% match');
 await page.locator('.market-alternatives summary').click();
 await expect(page.locator('.market-alternatives a').first()).toBeVisible();
});
