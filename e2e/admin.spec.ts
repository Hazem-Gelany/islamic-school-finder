import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (a Super Admin or Data Manager) to run the admin tests');

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email!); await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test.describe.serial('admin: the founder can run the directory without a developer', () => {
  const name = `E2E School ${Date.now()}`;
  let schoolUrl = '';

  test('sign in and see live statistics', async ({ page }) => {
    await login(page);
    await expect(page.getByText('Total schools')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
  });

  test('create a school (test 1) and publish it', async ({ page }) => {
    await login(page);
    await page.goto('/admin/schools/new');
    await page.getByLabel(/School name \(EN\)/).fill(name);
    await page.getByRole('button', { name: /Location/ }).click();
    await page.getByLabel('Country').selectOption({ label: 'Malaysia' });
    await page.getByLabel('City').selectOption({ label: 'Kuala Lumpur' });
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('School published.')).toBeVisible();
    schoolUrl = page.url();
  });

  test('edit fees and see the change in the audit trail (tests 2 and 7)', async ({ page }) => {
    await login(page);
    await page.goto(schoolUrl);
    await page.getByRole('button', { name: /Fees/ }).click();
    await page.getByLabel('Currency (3-letter code)').fill('MYR');
    await page.getByRole('button', { name: 'Add fee' }).click();
    await page.getByLabel('Amount').fill('9200');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Change history' })).toBeVisible();
    await expect(page.getByText(/school_fees/).first()).toBeVisible();
  });

  test('it is searchable in the admin table and public search (test 9)', async ({ page }) => {
    await login(page);
    await page.goto(`/admin/schools?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('link', { name })).toBeVisible();
    await page.goto(`/en/schools?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('archiving removes it from public search but keeps the record (test 5)', async ({ page }) => {
    await login(page);
    await page.goto(`/admin/schools?q=${encodeURIComponent(name)}`);
    await page.getByRole('row', { name: new RegExp(name) }).getByText('Actions').click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText(/updated/)).toBeVisible();
    await page.goto(`/en/schools?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('heading', { name })).toHaveCount(0);
    await page.goto(`/admin/schools?q=${encodeURIComponent(name)}&status=archived`);
    await expect(page.getByRole('link', { name })).toBeVisible();
  });

  test('CSV template and export download', async ({ page }) => {
    await login(page);
    for (const path of ['/admin/import/template', '/admin/export']) {
      const res = await page.request.get(path);
      expect(res.ok()).toBeTruthy();
      expect(res.headers()['content-type']).toContain('text/csv');
    }
  });
});
