export const DEFAULT_INVOICE_TEMPLATE = 'classic';
export const DEFAULT_INVOICE_ACCENT = '#C89B3C';

export const INVOICE_TEMPLATES = [
  { id: 'classic', name: 'MyBeezNus Classic', description: 'The familiar MyBeezNus bill layout.', icon: 'fa-receipt' },
  { id: 'modern', name: 'Modern', description: 'Whitespace-led SaaS invoice.', icon: 'fa-layer-group' },
  { id: 'professional', name: 'Professional', description: 'Structured corporate presentation.', icon: 'fa-building' },
  { id: 'compact', name: 'Compact', description: 'Dense and readable for long bills.', icon: 'fa-compress-alt' },
  { id: 'premium', name: 'Premium', description: 'Refined branding with quiet detail.', icon: 'fa-gem' },
  { id: 'minimal', name: 'Minimal', description: 'Lightweight, elegant and calm.', icon: 'fa-minus' },
  { id: 'service', name: 'Service', description: 'Built for appointments and services.', icon: 'fa-concierge-bell' },
];

export const INVOICE_ACCENT_PRESETS = [
  { name: 'MyBeezNus Honey', value: '#C89B3C' },
  { name: 'Midnight Navy', value: '#253267' },
  { name: 'Royal Blue', value: '#2563EB' },
  { name: 'Teal', value: '#0F766E' },
  { name: 'Emerald', value: '#218553' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Burgundy', value: '#9F1239' },
  { name: 'Slate', value: '#475569' },
  { name: 'Orange', value: '#C2410C' },
];

const isHexColor = value => /^#[0-9A-F]{6}$/i.test(String(value || '').trim());

export const normalizeInvoiceTemplate = value =>
  INVOICE_TEMPLATES.some(template => template.id === value) ? value : DEFAULT_INVOICE_TEMPLATE;

export const normalizeInvoiceAccent = value =>
  isHexColor(value) ? String(value).trim().toUpperCase() : DEFAULT_INVOICE_ACCENT;

export const getAccentTextColor = accent => {
  const hex = normalizeInvoiceAccent(accent).slice(1);
  const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (0.299 * channels[0]) + (0.587 * channels[1]) + (0.114 * channels[2]);
  return luminance > 160 ? '#172033' : '#FFFFFF';
};
