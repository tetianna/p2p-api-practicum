import { expect, test } from '@playwright/test';

import { expectSchema } from '../helpers/schema';

test.describe.serial('Over-invoice protection flow', () => {
  const runId = Date.now();
  const lineQty = 10;
  const unitPrice = 4.75;
  const invoiceTotal = lineQty * unitPrice;

  let vendorId: string;
  let poId: string;
  let invoiceId: string;

  test('create vendor', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/vendors', {
      data: { name: `Over Invoice Vendor ${runId}` },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Vendor');
    vendorId = body.id;
  });

  test('create purchase order', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/purchase-orders', {
      data: {
        vendor_id: vendorId,
        line_items: [{ sku: 'LUM-2X4-8', quantity: lineQty, unit_price: unitPrice }],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'PurchaseOrder');
    poId = body.id;
  });

  test('submit and receive everything', { tag: '@e2e' }, async ({ request }) => {
    const submitResponse = await request.post(`/purchase-orders/${poId}/submit`);
    expect(submitResponse.status()).toBe(200);
    const submitted = await submitResponse.json();
    await expectSchema(request, submitted, 'PurchaseOrder');

    const receiveResponse = await request.post(`/purchase-orders/${poId}/receive`, {
      data: { items: [{ sku: 'LUM-2X4-8', quantity: lineQty }] },
    });
    expect(receiveResponse.status()).toBe(200);
    const received = await receiveResponse.json();
    await expectSchema(request, received, 'PurchaseOrder');
    expect(received.fully_received).toBe(true);
  });

  test('reject invoice for one unit more than received', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/invoices', {
      data: {
        po_id: poId,
        invoice_number: `INV-OVER-${runId}`,
        line_items: [{ sku: 'LUM-2X4-8', quantity: lineQty + 1, unit_price: unitPrice }],
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    await expectSchema(request, body, 'Error');
    expect(body.rule).toBe('overpayment_protection');
  });

  test('exposure is zero after over-invoice rejection', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.get(`/vendors/${vendorId}/exposure`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'VendorExposure');
    expect(body.open_ap_liability).toBe(0);
    expect(body.approved_invoices).toEqual([]);
  });

  test('accept correct invoice', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post('/invoices', {
      data: {
        po_id: poId,
        invoice_number: `INV-OK-${runId}`,
        line_items: [{ sku: 'LUM-2X4-8', quantity: lineQty, unit_price: unitPrice }],
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    await expectSchema(request, body, 'Invoice');
    invoiceId = body.id;
    expect(body.total_amount).toBe(invoiceTotal);
  });

  test('match correct invoice', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/invoices/${invoiceId}/match`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'MatchResult');
    expect(body.matched).toBe(true);
  });

  test('approve correct invoice', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.post(`/invoices/${invoiceId}/approve`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'ApproveResult');
    expect(body.vendor_exposure).toBe(invoiceTotal);
  });

  test('exposure reflects approved invoice', { tag: '@e2e' }, async ({ request }) => {
    const response = await request.get(`/vendors/${vendorId}/exposure`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expectSchema(request, body, 'VendorExposure');
    expect(body.open_ap_liability).toBe(invoiceTotal);
    expect(body.approved_invoices).toEqual([invoiceId]);
  });
});
