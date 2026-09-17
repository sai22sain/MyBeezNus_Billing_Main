import {
  DEFAULT_INVOICE_ACCENT,
  DEFAULT_INVOICE_TEMPLATE,
  INVOICE_TEMPLATES,
  getAccentTextColor,
  normalizeInvoiceAccent,
  normalizeInvoiceTemplate,
} from './invoiceTemplates';

test('keeps the complete invoice template registry available', () => {
  expect(INVOICE_TEMPLATES.map(template => template.id)).toEqual([
    'classic', 'modern', 'professional', 'compact', 'premium', 'minimal', 'service',
  ]);
});

test('falls back safely for unknown template and accent values', () => {
  expect(normalizeInvoiceTemplate('unknown')).toBe(DEFAULT_INVOICE_TEMPLATE);
  expect(normalizeInvoiceAccent('red')).toBe(DEFAULT_INVOICE_ACCENT);
  expect(normalizeInvoiceAccent('#abc')).toBe(DEFAULT_INVOICE_ACCENT);
  expect(normalizeInvoiceAccent('#12abEF')).toBe('#12ABEF');
});

test('chooses readable text for light and dark accents', () => {
  expect(getAccentTextColor('#FFFFFF')).toBe('#172033');
  expect(getAccentTextColor('#253267')).toBe('#FFFFFF');
});
