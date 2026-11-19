import { expect, test, type Page } from '@playwright/test';
import { randomInt } from 'node:crypto';
import { uniqueUser } from '../helpers.mjs';

test('a borrower and underwriter complete a draft, rejection, recovery, acceptance and disbursement', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const borrower = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const staff = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const headers = { 'X-CredWise-Action': '1' }, errors: string[] = [];
  try {
    const identity = uniqueUser('origination-ui');
    const created = await borrower.request.post('/api/auth/register', { headers, data: identity });
    expect(created.status()).toBe(201);
    const uid = (await created.json()).data.user.id;
    expect((await staff.request.post('/api/auth/login', { headers, data: { email: 'admin@credwise.test', password: 'CredWiseDemo!360' } })).status()).toBe(200);
    expect((await borrower.request.put('/api/profile', { headers, data: { employment: 'Salaried', salary: 15000000, essential: 3500000, discretionary: 1200000,
      savings: 2000000, existing_emi: 0, on_time: 50, missed: 0, credit_months: 80, utilization: 10, income_regularity: 97, stability_months: 60, reserves: 15000000 } })).status()).toBe(200);
    const letter = () => String.fromCharCode(65 + randomInt(26));
    const pan = 'DEMO' + letter() + String(randomInt(10000)).padStart(4,'0') + letter();
    expect((await borrower.request.post('/api/kyc', { headers, data: { legal_name: identity.name, address: '7 Fictional Street, Demo District', employment: 'Salaried', pan,
      document: { name: 'synthetic-id.txt', mime: 'text/plain', content_base64: Buffer.from('CREDWISE-SYNTHETIC\nDemo identity.').toString('base64') } } })).status()).toBe(201);
    expect((await staff.request.post('/api/admin/kyc/' + uid, { headers, data: { status: 'verified', reason: 'Reviewed synthetic record.' } })).status()).toBe(200);

    const page = await borrower.newPage(), reviewer = await staff.newPage();
    for (const tab of [page, reviewer]) tab.on('pageerror', error => errors.push(error.message));
    await page.goto('/app/applications/new?product=personal');
    await page.getByLabel('Loan purpose').fill('Replace household tools for a personal purchase');
    await page.getByLabel('Requested principal (₹)').fill('25000');
    await page.getByLabel('Requested term (months)').fill('12');
    await page.getByRole('button', { name: 'Save draft and continue' }).click();
    await expect(page.getByRole('heading', { name: 'Financial evidence' })).toBeVisible();
    const detailPath = new URL(page.url()).pathname;
    expect(detailPath).toMatch(/^\/app\/applications\/\d+$/);
    await page.reload();
    await page.getByRole('button', { name: 'Run eligibility preview' }).click();
    await expect(page.getByRole('heading', { name: 'Repayment illustration' })).toBeVisible();
    await page.getByText('Monthly amortization schedule', { exact: true }).click();
    await expect(page.locator('.orig-details tbody tr')).toHaveCount(12);
    await page.getByRole('button', { name: 'Continue to documents' }).click();
    await page.getByRole('button', { name: 'Use example for Synthetic income statement' }).click();
    await expect(page.getByRole('button', { name: 'Download Synthetic income statement' })).toBeVisible();
    await page.getByRole('button', { name: 'Use example for Synthetic identity proof' }).click();
    await page.getByRole('button', { name: 'Review application' }).click();
    await page.getByRole('checkbox', { name: /I reviewed the repayment costs/ }).check();
    const response = page.waitForResponse(r => r.url().endsWith('/submit') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Submit application' }).click();
    const submitted = (await (await response).json()).data.application;
    expect(submitted.tracking_id).toMatch(/^CW-/);
    await expect(page.locator('.pageheading .orig-badge')).toHaveText('Under review');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

    await reviewer.goto('/admin/applications');
    await reviewer.getByLabel('Search applications').fill(submitted.tracking_id);
    await reviewer.getByRole('button', { name: 'Apply filters' }).click();
    await reviewer.getByRole('link', { name: 'Open '+submitted.tracking_id }).click();
    const download = reviewer.waitForEvent('download');
    await reviewer.getByRole('button', { name: 'Download Synthetic income statement' }).click();
    expect((await download).suggestedFilename()).toMatch(/synthetic-income-statement/);
    async function decide(tab: Page, action: string, note: string) {
      await tab.getByRole('combobox', { name: 'Decision', exact: true }).selectOption(action);
      await tab.getByLabel('Decision note').fill(note);
      await tab.getByRole('button', { name: 'Review decision' }).click();
      const result = tab.waitForResponse(r => r.url().endsWith('/decision') && r.request().method() === 'POST');
      await tab.getByRole('button', { name: 'Confirm decision' }).click();
      expect((await result).status()).toBe(200);
    }
    await decide(reviewer, 'reject', 'Clarify the monthly income evidence before another review.');
    await page.goto('/app/recovery');
    await expect(page.getByRole('heading', { name: 'Understand the decision' })).toBeVisible();
    await expect(page.getByText('Clarify the monthly income evidence before another review.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request reassessment' })).toBeDisabled();
    expect((await borrower.request.put('/api/profile', { headers, data: { salary: 15500000 } })).status()).toBe(200);
    await page.reload();
    const reassessed = page.waitForResponse(r => r.url().endsWith('/reassess') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Request reassessment' }).click();
    expect((await reassessed).status()).toBe(200);
    await reviewer.reload();
    await decide(reviewer, 'approve', 'Verified the updated synthetic evidence and repayment budget.');
    await page.goto(detailPath);
    const acceptance = page.getByRole('button', { name: 'Accept simulated terms' });
    await expect(acceptance).toBeDisabled();
    await page.getByRole('checkbox', { name: /I accept the simulated terms/ }).check();
    await acceptance.click();
    await page.getByRole('button', { name: 'Simulate disbursement' }).click();
    const loan = page.getByRole('link', { name: 'Open loan account' });
    await expect(loan).toHaveAttribute('href', /\/app\/loans\/\d+$/);
    await expect(page.locator('.pageheading .orig-badge')).toHaveText('Active loan');
    expect(errors).toEqual([]);
  } finally { await borrower.close(); await staff.close(); }
});
