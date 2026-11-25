// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 7000
  },
  fullyParallel: false,
  workers: 1, // Deterministic sequential runs to protect test isolation
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/test-results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 }
      }
    },
    {
      name: 'chromium-mobile',
      use: { 
        ...devices['Pixel 7'],
        viewport: { width: 393, height: 851 },
        isMobile: true
      }
    }
  ],
  webServer: {
    command: 'node server/index.js',
    url: 'http://localhost:3001/api/categories',
    reuseExistingServer: false,
    timeout: 20000,
    env: {
      NODE_ENV: 'test',
      ALLOW_TEST_AUTH: 'true',
      AI_ENABLED: 'true',
      LLM_PROVIDER: 'mock',
      LLM_MODEL: 'mock-fixture-v1',
      USER_PER_MIN_LIMIT: '50',
      USER_DAILY_LIMIT: '100',
      GLOBAL_DAILY_CAP: '500',
      LOG_HMAC_SECRET: 'playwright-ci-test-salt-value'
    }
  }
});
