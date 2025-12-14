import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Run with: npm run test:e2e
 *
 * For zkFetch + Cartesi E2E tests, ensure:
 * 1. Cartesi rollup is running locally (nonodo or cartesi-machine)
 * 2. Local PostgreSQL is available
 * 3. Environment variables are configured
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Web server configuration for local development
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
  // Global timeout for each test
  timeout: 60000,
  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },
});
