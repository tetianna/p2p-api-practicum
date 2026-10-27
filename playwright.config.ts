import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

dotenv.config();

const baseURL = process.env.API_BASE_URL ?? 'http://localhost:8002';
const port = new URL(baseURL).port || '80';

export default defineConfig({
  testDir: 'tests',
  // Serial e2e flows share state per file; keep file order predictable in the Test UI.
  fullyParallel: false,
  use: {
    baseURL,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm start',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: port,
    },
  },
  // List `api` first: the Playwright VS Code extension only enables the first project
  // by default. When api-setup was first, the Testing tree showed only reset.setup.ts.
  projects: [
    {
      name: 'api',
      dependencies: ['api-setup'],
      testMatch: /.*\.spec\.ts/,
    },
    {
      name: 'api-setup',
      testMatch: /reset\.setup\.ts/,
    },
  ],
});
