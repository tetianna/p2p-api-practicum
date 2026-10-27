import { expect, test } from '@playwright/test';

import { expectSchema } from '../helpers/schema';

test.describe.serial('Partial receipt flow', () => {
  const runId = Date.now();
  const orderedValue = 95.1;
  const receivedValue = 71.3;

  let vendorId: string;
  let poId: string;
  let invoiceId: string;

  test('create vendor', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: `Partial Receipt Vendor ${runId}` },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Vendor');
    vendorId = body.id;
  });

  test('create purchase order with two lines', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/purchase-orders', {
      data: {
        vendor_id: vendorId,
        line_items: [
          { sku: 'LUM-2X4-8', quantity: 10, unit_price: 4.75 },
          { sku: 'CEM-30KG', quantity: 4, unit_price: 11.9 },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'PurchaseOrder');
    poId = body.id;
    expect(body.ordered_value).toBe(orderedValue);
  });

  test('submit purchase order', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/purchase-orders/${poId}/submit`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'PurchaseOrder');
    expect(body.status).toBe('submitted');
  });

  test('receive first line fully and part of the second', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/purchase-orders/${poId}/receive`, {
      data: {
        items: [
          { sku: 'LUM-2X4-8', quantity: 10 },
          { sku: 'CEM-30KG', quantity: 2 },
        ],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'PurchaseOrder');
    expect(body.status).toBe('submitted');
    expect(body.fully_received).toBe(false);
    expect(body.received_value).toBe(receivedValue);
  });

  test('invoice only what was received', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/invoices', {
      data: {
        po_id: poId,
        invoice_number: `INV-PARTIAL-${runId}`,
        line_items: [
          { sku: 'LUM-2X4-8', quantity: 10, unit_price: 4.75 },
          { sku: 'CEM-30KG', quantity: 2, unit_price: 11.9 },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Invoice');
    invoiceId = body.id;
    expect(body.total_amount).toBe(receivedValue);
  });

  test('match with partial_receipt true', { tag: '@e2e' }, async ({ request }) => {
    test.fail(
      true,
      'BUG: API returns partial_receipt false when only a later PO line is partly received (API.md rule partial_receipt_flag)',
    );
    const response = await request.post(`/invoices/${invoiceId}/match`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'MatchResult');
    expect(body.partial_receipt).toBe(true);
    expect(body.received_value).toBe(receivedValue);
    expect(body.ordered_value).toBe(orderedValue);
  });

  test('approve partial receipt invoice', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/invoices/${invoiceId}/approve`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'ApproveResult');
    expect(body.vendor_exposure).toBe(receivedValue);
  });

  test('exposure equals received value not ordered value', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.get(`/vendors/${vendorId}/exposure`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'VendorExposure');
    expect(body.open_ap_liability).toBe(receivedValue);
    expect(body.open_ap_liability).not.toBe(orderedValue);
    expect(body.approved_invoices).toEqual([invoiceId]);
  });
});
