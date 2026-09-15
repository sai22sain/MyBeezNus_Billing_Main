import { supabase } from '../supabase';

/**
 * Thin wrapper around the MyBeezNus backend API.
 * Attaches the user's Supabase access token (Bearer) so backend routes can
 * verify identity. Targets are reserved for high-risk/privileged operations
 * that must NOT run with the anon key in the browser:
 *   - atomic bill/customer number generation
 *   - Excel report export
 *   - Razorpay webhook subscription writes
 */
const API_URL = process.env.REACT_APP_API_URL ?? '';

// A deployed site can never reach a localhost API (it would point at the
// *visitor's* machine), so skip instantly instead of wasting a failing
// request. Local dev (page served from localhost) still attempts normally.
const isLocal = (url) => /\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
const BACKEND_AVAILABLE =
  !isLocal(API_URL) || isLocal(window.location.origin);

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
};

/**
 * Call a backend endpoint. Returns `null` (instead of throwing) when the
 * backend is unreachable or unconfigured, so callers can fall back to the
 * existing client-side behavior.
 */
const callBackend = async (method, path, payload) => {
  const token = await getAccessToken();
  if (!token || !BACKEND_AVAILABLE) return null;

  const url = `${API_URL}${path}`;
  const opts = {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };

  if (payload) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(payload);
  }

  try {
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    return type.includes('application/json') ? res.json() : res.blob();
  } catch {
    return null;
  }
};

export const backendAPI = {
  nextBillNumber: (prefix) => callBackend('POST', '/api/numbers/next-bill', { prefix }),
  nextCustomerNumber: (prefix) => callBackend('POST', '/api/numbers/next-customer', { prefix }),
  exportRevenue: (startDate, endDate) =>
    callBackend('GET', `/api/reports/export?startDate=${startDate}&endDate=${endDate}`),
  deleteAccount: () => callBackend('DELETE', '/api/account'),
};

export default backendAPI;