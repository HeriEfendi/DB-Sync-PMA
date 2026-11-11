/**
 * Cookie parsing & merging utilities for PMA sessions
 */

export const updateCookieHeader = (currentCookieHeader, responseHeaders) => {
  if (!responseHeaders) return currentCookieHeader || '';

  let setCookieHeaders = [];
  if (typeof responseHeaders.getSetCookie === 'function') {
    setCookieHeaders = responseHeaders.getSetCookie();
  } else {
    const raw = responseHeaders.get('set-cookie');
    if (raw) {
      setCookieHeaders = raw.split(/,\s*(?=[A-Za-z0-9_%\-]+=[^;]+)/);
    }
  }

  const currentMap = new Map();
  if (currentCookieHeader) {
    currentCookieHeader.split(';').forEach((pair) => {
      const [k, v] = pair.split('=').map((s) => s.trim());
      if (k && v) currentMap.set(k, v);
    });
  }

  for (const headerStr of setCookieHeaders) {
    const firstPair = headerStr.split(';')[0].trim();
    const eqIdx = firstPair.indexOf('=');
    if (eqIdx > 0) {
      const k = firstPair.slice(0, eqIdx).trim();
      const v = firstPair.slice(eqIdx + 1).trim();
      if (k && v) currentMap.set(k, v);
    }
  }

  const merged = [];
  currentMap.forEach((v, k) => merged.push(`${k}=${v}`));
  return merged.join('; ');
};

