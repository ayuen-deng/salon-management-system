import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptDocument } from './printable-receipt';
import { ReceiptSnapshot } from '../models/receipt.repository';

const receipt: ReceiptSnapshot = {
  id: 'payment-1',
  receipt_no: 'REC-1001',
  visit_id: 'visit-1',
  ticket_code: 'A01',
  customer_first_name: 'Aisha',
  issued_at: '2026-11-04T06:15:00.000Z',
  salon_name: 'Mzuri Unisex Salon',
  location_name: 'Mbarara',
  receipt_address: '',
  receipt_phone: '',
  receipt_footer: 'Thank you for visiting.',
  fiscal_disclaimer_enabled: true,
  lines: [{ service_name: 'Haircut', variant_name: 'Wash and trim', final_price_ugx: 45000 }],
  payments: [{ method: 'momo', amount_ugx: 45000, provider_reference: 'MTN-1001' }],
  subtotal_ugx: 45000,
  total_discount_ugx: 0,
  total_final_ugx: 45000,
  payment_method: 'momo',
  payment_status: 'confirmed',
  provider_reference: 'MTN-1001',
  print_count: 1,
  is_duplicate: false,
};

function markup(overrides: Partial<ReceiptSnapshot> = {}, duplicate = false) {
  return renderToStaticMarkup(React.createElement(ReceiptDocument, {
    receipt: { ...receipt, ...overrides },
    duplicate,
    reprintedAt: duplicate ? '2026-11-04T07:00:00.000Z' : undefined,
  }));
}

describe('receipt document', () => {
  it('renders a compact original with first name, issue time, payment details, footer and disclaimer', () => {
    const html = markup();
    expect(html).toContain('Mzuri Unisex Salon');
    expect(html).toContain('Aisha');
    expect(html).toContain('REC-1001');
    expect(html).toContain('Date &amp; time:');
    expect(html).toContain('Haircut');
    expect(html).toContain('Wash and trim');
    expect(html).toContain('UGX 45,000');
    expect(html).toContain('Mobile Money reference:');
    expect(html).toContain('MTN-1001');
    expect(html).toContain('This is not a fiscal tax receipt.');
    expect(html).toContain('Thank you for visiting.');
    expect(html).not.toContain('Tel:');
    expect(html).not.toContain('Philips');
    expect(html).not.toContain('Audited');
  });

  it('keeps the issue timestamp and adds a duplicate stamp and reprint timestamp', () => {
    const html = markup({ customer_first_name: 'Michael Philips' }, true);
    expect(html).toContain('DUPLICATE');
    expect(html).toContain('Reprinted:');
    expect(html).toContain('Michael');
    expect(html).not.toContain('Philips');
    expect(html).toContain('04 Nov 2026 09:15 (EAT)');
    expect(html).toContain('04 Nov 2026, 10:00 (EAT)');
  });

  it.each([
    ['void', 'VOID'],
    ['refunded', 'REFUNDED'],
  ] as const)('shows %s status on the receipt', (payment_status, label) => {
    expect(markup({ payment_status })).toContain(label);
  });
});
