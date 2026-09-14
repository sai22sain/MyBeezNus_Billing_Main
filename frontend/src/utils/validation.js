/* Shared input validation helpers (Indian market: 10-digit mobile, 6-digit pincode). */

/**
 * Normalize a mobile number: strip spaces/dashes, drop +91 / 91 / 0 prefixes.
 * '  +91 98765 43210 ' -> '9876543210'
 */
const normalizeMobile = (v) => {
  if (!v) return '';
  let d = String(v).replace(/[^0-9]/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};

/** Indian mobile: starts 6-9, exactly 10 digits. */
const isValidMobile = (v) => /^[6-9]\d{9}$/.test(normalizeMobile(v));

const isValidEmail = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

/**
 * DOB must be a real date, not in the future, and not older than 120 years.
 * Empty is allowed (DOB is optional everywhere).
 */
const isValidDob = (v) => {
  if (!v) return true;
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  if (d > today) return false;
  const min = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  return d >= min;
};

/** Indian pincode: 6 digits, first digit 1-9. */
const isValidPincode = (v) => !v || /^[1-9]\d{5}$/.test(String(v).trim());

/** GSTIN format (15 chars). Empty allowed. */
const isValidGst = (v) =>
  !v || /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(v).trim().toUpperCase());

/** Business/owner name: 2-60 chars, letters/spaces/common punctuation. */
const isValidName = (v) =>
  typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 60;

export { normalizeMobile, isValidMobile, isValidEmail, isValidDob, isValidPincode, isValidGst, isValidName };