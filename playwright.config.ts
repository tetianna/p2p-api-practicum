import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

dotenv.config();

const baseURL = process.env.API_BASE_URL ?? 'http://localhost:8002';
const port = new URL(baseURL).port || '80';

export default defineConfig({
  testDir: 'tests/api',
  fullyParallel: true,
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
  projects: [
    {
      name: 'api-setup',
      testMatch: /reset\.setup\.ts/,
    },
    {
      name: 'api',
      dependencies: ['api-setup'],
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
