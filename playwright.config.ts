import { defineConfig, devices } from '@playwright/test';

/** End-to-end tests run against a deployed or locally started site that has the demo seed data loaded (supabase/seed.sql).
 *    E2E_BASE_URL=https://staging.example.com npx playwright test
 *  Admin and claim tests need real accounts and are skipped unless these are set: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_USER_EMAIL, E2E_USER_PASSWORD. */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /public\.spec\.ts/ }],
  webServer: process.env.E2E_START_SERVER ? { command: 'npm run start', url: 'http://localhost:3000/api/health', reuseExistingServer: true, timeout: 120_000 } : undefined,
});
