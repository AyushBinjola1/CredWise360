import {test,expect} from '@playwright/test';
test('public information pages, FAQ disclosure and sign-in navigation',async({page})=>{
 const paths=['about','how-it-works','features','resources','faq','privacy','terms','simulation'];
 for(const path of paths){
  const response=await page.goto('/'+path);expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
 }
 await page.goto('/faq');
 await page.getByText('What does the score represent?',{exact:true}).click();
 await expect(page.getByText(/The 300–900 simulated score/)).toBeVisible();
 await page.getByRole('link',{name:'Open the demo'}).click();
 await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
});
