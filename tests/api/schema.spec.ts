import { expect, test } from '@playwright/test';

import { expectSchema } from './helpers/schema';

test(
  'GET /vendors — every vendor matches Vendor schema',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.get('/vendors');
    expect(response.status()).toBe(200);
    const vendors: unknown = await response.json();
    expect(Array.isArray(vendors)).toBe(true);
    for (const vendor of vendors) {
      await expectSchema(request, vendor, 'Vendor');
    }
  },
);

test(
  'Vendor without active fails schema check',
  { tag: '@api' },
  async ({ request }) => {
    await expect(
      expectSchema(request, { id: 'vnd-x', name: 'Missing Active' }, 'Vendor'),
    ).rejects.toThrow();
  },
);

test('unknown schema name fails schema check', { tag: '@api' }, async ({ request }) => {
  await expect(
    expectSchema(request, { status: 'ok' }, 'NotARealSchema'),
  ).rejects.toThrow(/OpenAPI schema not found/);
});
