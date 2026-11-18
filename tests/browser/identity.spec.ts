import {expect, test} from '@playwright/test';
import {uniqueUser} from '../helpers.mjs';

for (const width of [390, 1440]) {
  test(`a new borrower can save a budget and sign back in at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    const credentials = uniqueUser('browser');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\/?$/);
    await page.getByRole('link', {name: 'Create an account'}).click();
    await page.getByLabel('Full name').fill(credentials.name);
    await page.getByLabel('Email address').fill(credentials.email);
    await page.getByLabel(/^Password/).fill(credentials.password);
    await page.getByRole('button', {name: 'Create account', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Your workspace is ready'})).toBeVisible();
    await expect(page.locator('output')).toHaveText(/\S{12,}/);
    await page.getByRole('link', {name: 'Open my workspace'}).click();
    await expect(page.getByRole('heading', {name: 'Hello, Synthetic.'})).toBeVisible();

    await page.getByRole('link', {name: 'View financial profile'}).click();
    await expect(page.getByRole('heading', {name: 'Financial profile', exact: true})).toBeVisible();
    await page.getByLabel('Monthly salary').fill('62500.25');
    await page.getByRole('button', {name: 'Save changes'}).click();
    await expect(page.getByRole('status')).toHaveText('Income & work saved.');
    await page.getByRole('button', {name: 'Monthly budget'}).click();
    await page.getByLabel('Essential expenses').fill('17000.25');
    await page.getByLabel('Discretionary expenses').fill('5500');
    await page.getByLabel('Existing monthly instalments').fill('2500');
    await page.getByRole('button', {name: 'Save changes'}).click();
    await expect(page.getByRole('status')).toHaveText('Monthly budget saved.');
    await page.reload();
    await expect(page.getByLabel('Monthly salary')).toHaveValue('62500.25');

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByText('₹37,500', {exact: true})).toBeVisible();
    expect((await page.request.get('/api/admin/users')).status()).toBe(403);
    if (width < 768) await page.getByRole('button', {name: 'Open navigation'}).click();
    await page.getByRole('button', {name: 'Sign out'}).click();
    await expect(page).toHaveURL(/\/login\/?$/);
    await page.goto('/app/profile');
    await expect(page).toHaveURL(/\/login\/?$/);
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);

    await page.getByLabel('Email address').fill(credentials.email);
    await page.getByLabel(/^Password/).fill(credentials.password);
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Hello, Synthetic.'})).toBeVisible();
    await expect(page.getByText('₹37,500', {exact: true})).toBeVisible();
    expect(errors).toEqual([]);
  });
}
