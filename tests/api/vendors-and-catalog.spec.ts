import { expect, test } from '@playwright/test';

import { expectSchema } from './helpers/schema';

const SEED_CATALOG: Record<string, { description: string; unit_price: number }> = {
  'LUM-2X4-8': { description: '2x4 stud, 8 ft', unit_price: 4.75 },
  'PLY-12-4X8': { description: 'Plywood sheet, 1/2 in, 4x8 ft', unit_price: 22.4 },
  'CEM-30KG': { description: 'Cement bag, 30 kg', unit_price: 11.9 },
  'REB-10MM-6': { description: 'Rebar, 10 mm, 6 m', unit_price: 18.25 },
  'SCR-DECK-1LB': { description: 'Deck screws, 1 lb box', unit_price: 9.99 },
};

function centsRounded(value: number): boolean {
  return Math.round(value * 100) === value * 100;
}

test(
  'VND-GET-01 GET /vendors returns Vendor array',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.get('/vendors');
    expect(response.status()).toBe(200);
    const vendors: unknown = await response.json();
    expect(Array.isArray(vendors)).toBe(true);
    for (const vendor of vendors as unknown[]) {
      await expectSchema(request, vendor, 'Vendor');
    }
  },
);

test(
  'VND-GET-02 GET /vendors includes seed vendors',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.get('/vendors');
    expect(response.status()).toBe(200);
    const vendors = (await response.json()) as Array<{
      id: string;
      name: string;
      active: boolean;
    }>;
    const maple = vendors.find((v) => v.id === 'vnd-001');
    const quarry = vendors.find((v) => v.id === 'vnd-002');
    expect(maple).toEqual({
      id: 'vnd-001',
      name: 'Maple Ridge Supply',
      active: true,
    });
    expect(quarry).toEqual({
      id: 'vnd-002',
      name: 'Old Quarry Materials',
      active: false,
    });
  },
);

test(
  'VND-GET-03 POST /vendors then GET /vendors lists created vendor',
  { tag: '@api' },
  async ({ request }) => {
    const createResponse = await request.post('/vendors', {
      data: { name: 'Cedar Point Hardware' },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    await expectSchema(request, created, 'Vendor');

    const listResponse = await request.get('/vendors');
    expect(listResponse.status()).toBe(200);
    const vendors = (await listResponse.json()) as Array<{ id: string; name: string }>;
    const found = vendors.find((v) => v.id === created.id);
    expect(found).toEqual({ id: created.id, name: 'Cedar Point Hardware', active: true });
  },
);

test(
  'VND-POST-01 POST /vendors creates vendor with default active',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: 'Cedar Point Hardware' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Vendor');
    expect(body.id).toMatch(/^vnd-/);
    expect(body.name).toBe('Cedar Point Hardware');
    expect(body.active).toBe(true);
  },
);

test(
  'VND-POST-02 POST /vendors creates inactive vendor',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: 'Inactive Supplier', active: false },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Vendor');
    expect(body.name).toBe('Inactive Supplier');
    expect(body.active).toBe(false);
  },
);

test(
  'VND-POST-03 POST /vendors accepts explicit active true',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: 'Explicit Active Co', active: true },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Vendor');
    expect(body.active).toBe(true);
  },
);

test(
  'VND-POST-04 POST /vendors accepts single-character name',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: 'A' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Vendor');
    expect(body.name).toBe('A');
  },
);

test(
  'VND-POST-05 POST /vendors rejects missing name',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', { data: {} });
    expect(response.status()).toBe(400);
    const body = await response.json();
    await expectSchema(request, body, 'Error');
    expect(body.rule).toBe('validation_error');
    expect(String(body.detail).toLowerCase()).toContain('name');
  },
);

test(
  'VND-POST-06 POST /vendors rejects empty name',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', { data: { name: '' } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    await expectSchema(request, body, 'Error');
    expect(body.rule).toBe('validation_error');
  },
);

test(
  'VND-POST-07 POST /vendors rejects non-string name',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', { data: { name: 123 } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    await expectSchema(request, body, 'Error');
    expect(body.rule).toBe('validation_error');
  },
);

test(
  'VND-POST-08 POST /vendors rejects non-boolean active',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: 'Valid Name', active: 'yes' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    await expectSchema(request, body, 'Error');
    expect(body.rule).toBe('validation_error');
  },
);

test(
  'VND-POST-09 POST /vendors rejects invalid JSON body',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/vendors', {
      data: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    await expectSchema(request, body, 'Error');
    expect(body.rule).toBe('validation_error');
    expect(String(body.detail).toLowerCase()).toMatch(/json/);
  },
);

test(
  'SKU-GET-01 GET /skus returns Sku array',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.get('/skus');
    expect(response.status()).toBe(200);
    const skus: unknown = await response.json();
    expect(Array.isArray(skus)).toBe(true);
    for (const sku of skus as unknown[]) {
      await expectSchema(request, sku, 'Sku');
    }
  },
);

test(
  'SKU-GET-02 GET /skus returns five catalog prices in cents',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.get('/skus');
    expect(response.status()).toBe(200);
    const skus = (await response.json()) as Array<{ unit_price: number }>;
    expect(skus).toHaveLength(5);
    for (const row of skus) {
      expect(centsRounded(row.unit_price)).toBe(true);
    }
  },
);

test(
  'SKU-GET-03 GET /skus matches seed catalog',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.get('/skus');
    expect(response.status()).toBe(200);
    const skus = (await response.json()) as Array<{
      sku: string;
      description: string;
      unit_price: number;
    }>;
    expect(skus).toHaveLength(Object.keys(SEED_CATALOG).length);
    for (const [sku, expected] of Object.entries(SEED_CATALOG)) {
      const row = skus.find((item) => item.sku === sku);
      expect(row).toEqual({ sku, ...expected });
    }
  },
);
