import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/guide/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Keep Chromium memory bounded in the shared development container.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8801',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview:worker',
    url: 'http://127.0.0.1:8801/stay-k7m4',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
