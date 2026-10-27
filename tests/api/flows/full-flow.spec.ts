import { expect, test } from '@playwright/test';

import { expectSchema } from '../helpers/schema';

test.describe.serial('Full purchase-to-pay flow', () => {
  const runId = Date.now();
  let vendorId: string;
  let poId: string;
  let invoiceId: string;
  let invoiceTotal: number;

  test('create vendor', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: `Full Flow Vendor ${runId}` },
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
          { sku: 'LUM-2X4-8', description: '2x4 stud, 8 ft', quantity: 10, unit_price: 4.75 },
          { sku: 'CEM-30KG', quantity: 4, unit_price: 11.9 },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'PurchaseOrder');
    poId = body.id;
    expect(body.status).toBe('draft');
    expect(body.ordered_value).toBe(95.1);
    invoiceTotal = body.ordered_value;
  });

  test('submit purchase order', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/purchase-orders/${poId}/submit`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'PurchaseOrder');
    expect(body.status).toBe('submitted');
  });

  test('receive all lines', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/purchase-orders/${poId}/receive`, {
      data: {
        items: [
          { sku: 'LUM-2X4-8', quantity: 10 },
          { sku: 'CEM-30KG', quantity: 4 },
        ],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'PurchaseOrder');
    expect(body.fully_received).toBe(true);
    expect(body.received_value).toBe(95.1);
    expect(body.status).toBe('closed');
  });

  test('invoice for everything received', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/invoices', {
      data: {
        po_id: poId,
        invoice_number: `INV-FULL-${runId}`,
        line_items: [
          { sku: 'LUM-2X4-8', quantity: 10, unit_price: 4.75 },
          { sku: 'CEM-30KG', quantity: 4, unit_price: 11.9 },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Invoice');
    invoiceId = body.id;
    expect(body.total_amount).toBe(invoiceTotal);
  });

  test('match with partial_receipt false', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/invoices/${invoiceId}/match`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'MatchResult');
    expect(body.partial_receipt).toBe(false);
    expect(body.invoice_total).toBe(invoiceTotal);
  });

  test('approve with balanced ledger', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/invoices/${invoiceId}/approve`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'ApproveResult');
    expect(body.gl_entry.balanced).toBe(true);
    expect(body.gl_entry.debits).toEqual([
      { account: '5000 Materials Expense', amount: invoiceTotal },
    ]);
    expect(body.gl_entry.credits).toEqual([
      { account: '2000 Accounts Payable', amount: invoiceTotal },
    ]);
    expect(body.vendor_exposure).toBe(invoiceTotal);
  });

  test('exposure equals invoice total', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.get(`/vendors/${vendorId}/exposure`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'VendorExposure');
    expect(body.vendor_id).toBe(vendorId);
    expect(body.open_ap_liability).toBe(invoiceTotal);
    expect(body.approved_invoices).toEqual([invoiceId]);
  });
});
