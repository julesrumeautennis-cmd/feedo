import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4381',
    viewport: {width: 1440, height: 900},
    trace: 'retain-on-failure',
    launchOptions: { ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {}),
      args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] },
  },
  webServer: {command: 'npm run preview -- --host 127.0.0.1 --port 4381 --strictPort',
    url:'http://127.0.0.1:4381', reuseExistingServer: false, timeout: 40000 },
});
