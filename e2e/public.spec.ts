import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('public website', () => {
  test('home page explains the product and offers search', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find the right Islamic school for your family.');
    await expect(page.getByRole('button', { name: 'Find My School' }).first()).toBeVisible();
  });

  test('language switch changes language and direction (test 8)', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByRole('link', { name: 'العربية', exact: true }).first().click();
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await page.getByRole('link', { name: 'Bahasa Melayu', exact: true }).first().click();
    await expect(page).toHaveURL(/\/ms$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('skip link is the first tab stop and moves focus to the content', async ({ page }) => {
    await page.goto('/en/schools');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('search by place returns the same schools in all three languages (test 9)', async ({ page }) => {
    const counts: string[] = [];
    for (const [loc, q] of [['en', 'Islamic schools in Kuala Lumpur'], ['ar', 'مدارس إسلامية في كوالالمبور'], ['ms', 'sekolah Islam di Kuala Lumpur']] as const) {
      await page.goto(`/${loc}/schools?q=${encodeURIComponent(q)}`);
      await expect(page.getByRole('status').first()).toBeVisible();
      counts.push(await page.locator('main ul > li h3').count().then(String));
    }
    expect(new Set(counts).size).toBe(1);
    expect(Number(counts[0])).toBeGreaterThan(0);
  });

  test('filters live in the address bar and survive a reload', async ({ page }) => {
    await page.goto('/en/schools?country=malaysia&city=kuala-lumpur&quran=1');
    await expect(page.getByLabel('Quran programme')).toBeChecked();
    await page.reload();
    await expect(page.getByLabel('Quran programme')).toBeChecked();
    await expect(page.locator('main ul > li h3').first()).toBeVisible();
  });

  test('a school profile shows verification, fees and structured data', async ({ page }) => {
    await page.goto('/en/schools/malaysia/kuala-lumpur/al-noor-international-islamic-school');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Al-Noor');
    await expect(page.getByRole('heading', { name: 'Fees' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verification' })).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.map((x) => JSON.parse(x)['@type'])).toEqual(expect.arrayContaining(['School', 'BreadcrumbList']));
  });

  test('three schools can be compared side by side (test 10)', async ({ page }) => {
    await page.goto('/en/schools?country=malaysia');
    const buttons = page.getByRole('button', { name: /^\+?\s*Compare/ });
    for (let i = 0; i < 3; i++) await buttons.nth(i).click();
    await expect(page.getByText('3 schools selected')).toBeVisible();
    await page.getByRole('link', { name: 'Compare now' }).click();
    await expect(page).toHaveURL(/\/compare\?schools=/);
    await expect(page.locator('table thead th[scope="col"]')).toHaveCount(3);
  });

  test('matching explains every result (test 11)', async ({ page }) => {
    await page.goto('/en/match?city=kuala-lumpur&quran=1&boarding=1&gender=mixed&feeMax=16000');
    await expect(page.getByText(/Matches \d+ of your 4 preferences/).first()).toBeVisible();
    await expect(page.getByText('We do not rank schools by quality')).toBeVisible();
  });

  test('unknown addresses show a friendly 404 with a language attribute', async ({ page }) => {
    const res = await page.goto('/en/this-page-does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('API and health endpoints respond', async ({ request }) => {
    expect((await request.get('/api/health')).ok()).toBeTruthy();
    const j = await (await request.get('/api/v1/schools?limit=2')).json();
    expect(j.meta.total).toBeGreaterThan(0);
    expect(JSON.stringify(j)).not.toContain('verification_notes');
  });
});

test.describe('accessibility (axe, including colour contrast)', () => {
  for (const path of ['/en', '/ar', '/ms', '/en/schools', '/ar/schools/malaysia/kuala-lumpur', '/en/schools/malaysia/kuala-lumpur/al-noor-international-islamic-school',
    '/en/match?city=kuala-lumpur&quran=1', '/en/login', '/en/register', '/en/claim', '/en/about', '/en/privacy', '/en/contact']) {
    test(`no violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`)).toEqual([]);
    });
  }
});
