import { defineConfig, devices } from '@playwright/test';

const PORT = Number.parseInt(process.env.E2E_FRONTEND_PORT || '8080', 10);
const SIGNALING_PORT = Number.parseInt(process.env.E2E_SIGNALING_PORT || '5598', 10);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        permissions: ['microphone', 'camera'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SIGNALING_SERVER_URL: `http://127.0.0.1:${SIGNALING_PORT}`,
      VITE_API_URL: process.env.VITE_API_URL || 'http://127.0.0.1:6650',
      VITE_PERSONAL_LINK_API_URL: process.env.VITE_PERSONAL_LINK_API_URL || 'http://127.0.0.1:6650',
    },
  },
});
