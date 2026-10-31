export const dishCartKey = 'mercau:dish-cart:v1';
export type DishCart = { restaurantId: string; restaurantName: string; menuPath: string };
export function savedDishCarts(store: Storage): string[] {
  const ids: string[] = [];
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index), match = key?.match(/^mercau:catalog-cart:(rec[A-Za-z0-9]{14}):v1$/);
    if (!match) continue;
    try { const lines = JSON.parse(store.getItem(key!) || '[]'); if (Array.isArray(lines) && lines.length) ids.push(match[1]); } catch { /* Ignore invalid legacy drafts. */ }
  }
  return ids;
}
export function uncertainDishOrder(store: Storage, restaurantId: string) {
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index);
    if (key?.startsWith('mercau:order-intent:') && key.endsWith(`:${restaurantId}`) && store.getItem(key)) return true;
  }
  return false;
}
