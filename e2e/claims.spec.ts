import { expect, test } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL, adminPass = process.env.E2E_ADMIN_PASSWORD, userEmail = process.env.E2E_USER_EMAIL, userPass = process.env.E2E_USER_PASSWORD;
test.skip(!adminEmail || !adminPass || !userEmail || !userPass, 'Needs E2E_ADMIN_* (Super Admin) and E2E_USER_* (a confirmed ordinary account that does not yet manage the school)');

test('a school representative claims a school, is approved, and edits through the portal', async ({ browser }) => {
  const slug = 'cahaya-islamic-school';
  const user = await (await browser.newContext()).newPage(), admin = await (await browser.newContext()).newPage();

  await user.goto('/en/login'); await user.getByLabel('Email').fill(userEmail!); await user.getByLabel('Password').fill(userPass!); await user.getByRole('button', { name: 'Log in' }).click();
  await user.goto(`/en/schools/malaysia/petaling-jaya/${slug}/claim`);
  await user.getByLabel('Your role at the school').fill('Principal');
  await user.getByRole('button', { name: 'Send claim' }).click();
  await expect(user.getByText('Waiting for review')).toBeVisible();

  await admin.goto('/admin/login'); await admin.getByLabel('Email').fill(adminEmail!); await admin.getByLabel('Password').fill(adminPass!); await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.goto('/admin/claims');
  const card = admin.getByRole('listitem').filter({ hasText: userEmail! }).first();
  admin.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText('Claim approved')).toBeVisible();

  await user.goto('/portal');
  await user.getByRole('link', { name: 'Edit profile' }).first().click();
  await user.getByRole('button', { name: /Contact/ }).click();
  await user.getByLabel('Phone').fill('+60 3 5555 0101');
  await user.getByRole('button', { name: 'Save changes' }).click();
  await expect(user.getByText('Saved. Your changes are published.')).toBeVisible();

  await user.getByRole('button', { name: /Basic information/ }).click();
  await user.getByLabel(/Description \(EN\)/).fill('A new description that needs review.');
  await user.getByRole('button', { name: 'Save changes' }).click();
  await expect(user.getByText(/sent for review/)).toBeVisible();

  await admin.goto('/admin/changes');
  await expect(admin.getByText('Description (EN)')).toBeVisible();
  admin.once('dialog', (d) => d.accept());
  await admin.getByRole('button', { name: 'Approve and publish' }).first().click();
  await expect(admin.getByText('Changes approved and published.')).toBeVisible();
});
