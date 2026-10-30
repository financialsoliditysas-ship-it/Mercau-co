// Browser-only receipt references. Contains no address, token, price or other personal data.
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const requestKeyPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function orderIntentStore(): Store | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}
export function readOrderIntent(store: Store | null, scope: string, fallback = ''): string {
  let saved: string | null = null;
  try { saved = store?.getItem(scope) || null; } catch { /* Continue with the in-memory reference. */ }
  return requestKeyPattern.test(fallback) ? fallback : saved && requestKeyPattern.test(saved) ? saved : '';
}
export function pendingOrderIntent(store: Store | null, scope: string, fallback: string, uuid: () => string): string {
  const key = readOrderIntent(store,scope,fallback) || uuid();
  try { store?.setItem(scope, key); } catch { /* Server-side repeat protection still applies. */ }
  return key;
}

export function clearOrderIntent(store: Store | null, scope: string) {
  try { store?.removeItem(scope); } catch { /* No personal data is retained here. */ }
}
