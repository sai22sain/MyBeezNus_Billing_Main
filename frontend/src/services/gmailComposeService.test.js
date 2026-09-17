import {
  buildGmailWebComposeUrl,
  buildInvoiceEmailBody,
  buildInvoiceEmailSubject,
} from './gmailComposeService';

describe('Gmail invoice content', () => {
  const bill = {
    billNumber: 'BILL-00011',
    createdAt: '2026-09-17T10:00:00.000Z',
    finalAmount: 1144,
  };
  const customer = { name: 'fwg re', email: 'fwg@example.com' };

  test('creates a branded subject and receipt-style body from saved bill data', () => {
    expect(buildInvoiceEmailSubject(bill)).toBe('Your Bill from MyBeezNus • BILL-00011');

    expect(buildInvoiceEmailBody(bill, customer)).toContain('MYBEEZNUS\nBilling');
    expect(buildInvoiceEmailBody(bill, customer)).toContain('Hello fwg re,');
    expect(buildInvoiceEmailBody(bill, customer)).toContain('Bill Number    BILL-00011');
    expect(buildInvoiceEmailBody(bill, customer)).toContain('Total Amount   ₹1144.00');
  });

  test('URL-encodes the recipient, subject, body, and currency', () => {
    const url = buildGmailWebComposeUrl({
      to: customer.email,
      subject: buildInvoiceEmailSubject(bill),
      body: buildInvoiceEmailBody(bill, customer),
    });

    expect(url).toContain('to=fwg%40example.com');
    expect(url).toContain('su=Your%20Bill%20from%20MyBeezNus%20%E2%80%A2%20BILL-00011');
    expect(url).toContain('%E2%82%B91144.00');
  });
});
