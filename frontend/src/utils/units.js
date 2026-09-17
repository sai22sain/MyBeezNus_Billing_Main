export const UNIT_DEFINITIONS = [
  { code: 'PCS', value: 'pcs', aliases: ['pc', 'piece', 'pieces'] },
  { code: 'BOX', value: 'box', aliases: ['boxes'] },
  { code: 'PKT', value: 'pkt', aliases: ['packet', 'packets'] },
  { code: 'BTL', value: 'btl', aliases: ['bottle', 'bottles'] },
  { code: 'CAN', value: 'can', aliases: ['cans'] },
  { code: 'BAG', value: 'bag', aliases: ['bags'] },
  { code: 'SET', value: 'set', aliases: ['sets'] },
  { code: 'PAIR', value: 'pair', aliases: ['pairs'] },
  { code: 'DOZ', value: 'dz', aliases: ['dozen'] },
  { code: 'KGS', value: 'kg', aliases: ['kgs', 'kilogram', 'kilograms'] },
  { code: 'GMS', value: 'g', aliases: ['gm', 'gms', 'gram', 'grams'] },
  { code: 'MGS', value: 'mg', aliases: ['mgs', 'milligram', 'milligrams'] },
  { code: 'TON', value: 'ton', aliases: ['tons', 'tonne', 'tonnes'] },
  { code: 'LTR', value: 'l', aliases: ['lt', 'ltr', 'litre', 'litres', 'liter', 'liters'] },
  { code: 'MLT', value: 'ml', aliases: ['millilitre', 'millilitres', 'milliliter', 'milliliters'] },
  { code: 'MTR', value: 'm', aliases: ['meter', 'meters', 'metre', 'metres'] },
  { code: 'CMS', value: 'cm', aliases: ['cms', 'centimeter', 'centimeters', 'centimetre', 'centimetres'] },
  { code: 'FTS', value: 'ft', aliases: ['feet', 'foot'] },
  { code: 'IN', value: 'in', aliases: ['inch', 'inches'] },
  { code: 'KME', value: 'km', aliases: ['kms', 'kilometer', 'kilometers', 'kilometre', 'kilometres'] },
  { code: 'SQM', value: 'sq m', aliases: ['sqm', 'square meter', 'square metre'] },
  { code: 'SQFT', value: 'sq ft', aliases: ['sqft', 'square foot', 'square feet'] },
  { code: 'HR', value: 'hr', aliases: ['hrs', 'hour', 'hours'] },
  { code: 'DAY', value: 'day', aliases: ['days'] },
].map(unit => ({ ...unit, label: `${unit.code} - ${unit.value}` }));

export const DEFAULT_UNIT = 'pcs';

export const findUnit = value => {
  const normalized = String(value || '').trim().toLowerCase();
  return UNIT_DEFINITIONS.find(unit => unit.value.toLowerCase() === normalized || unit.code.toLowerCase() === normalized || unit.aliases.includes(normalized));
};

export const normalizeUnit = value => findUnit(value)?.value || String(value || '').trim() || DEFAULT_UNIT;

export const getUnitLabel = value => findUnit(value)?.label || String(value || '').trim() || 'PCS - pcs';

export const unitSupportsDecimal = value => !['PCS', 'BOX', 'PKT', 'BTL', 'CAN', 'BAG', 'SET', 'PAIR', 'DOZ'].includes(findUnit(value)?.code);
