// Browser-Tests. Start: npm run test:browser
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Für eine vorinstallierte Chromium-Version (z. B. in Cloud-Umgebungen) den Pfad über PW_CHROMIUM setzen
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /handy\.spec\.js/ },
    { name: 'handy', use: { ...devices['Pixel 7'] }, testMatch: /handy\.spec\.js/ },
  ],
  webServer: {
    command: 'node server/server.js',
    url: 'http://127.0.0.1:4173/api/status',
    env: { PORT: '4173', ANTHROPIC_API_KEY: '' },
    reuseExistingServer: !process.env.CI,
  },
});
