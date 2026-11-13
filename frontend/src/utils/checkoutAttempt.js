const STORAGE_KEY = "skinora_checkout_attempt_v1";
let fallbackAttempt = null;

const createKey = () => `skn_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

export const getCheckoutAttemptKey = (payload) => {
  // Same order and same cart after a timeout -> reuse the same request ID.
  const fingerprint = JSON.stringify(payload);
  try {
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (existing?.fingerprint === fingerprint && existing?.key) return existing.key;
    const next = { fingerprint, key: createKey() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next.key;
  } catch {
    if (fallbackAttempt?.fingerprint === fingerprint) return fallbackAttempt.key;
    fallbackAttempt = { fingerprint, key: createKey() };
    return fallbackAttempt.key;
  }
};

export const clearCheckoutAttempt = () => {
  fallbackAttempt = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
};
