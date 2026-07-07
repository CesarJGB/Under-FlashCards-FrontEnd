// frontend/src/lib/safeLocalStorage.js
const inMemoryFallback = new Map();

function isQuotaExceeded(e) {
  return e && (e.code === 22 || e.code === 1014 ||
    e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

export function getJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[safeLocalStorage] Error parsing ${key}, removing corrupted cache`);
    try { localStorage.removeItem(key); } catch (e) {}
    return inMemoryFallback.get(key) || null;
  }
}

export function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Keep in-memory copy in sync as a fallback
    inMemoryFallback.set(key, value);
    return true;
  } catch (err) {
    if (isQuotaExceeded(err) || err instanceof DOMException) {
      console.warn(`[safeLocalStorage] Quota exceeded for ${key}, using memory fallback`);
      inMemoryFallback.set(key, value);
      return false;
    }
    console.error(`[safeLocalStorage] Error setting ${key}:`, err);
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch (err) { /* ignore */ }
  try { inMemoryFallback.delete(key); } catch (err) { /* ignore */ }
}
