import type { DirectoryBusiness } from '@/data/directory';
import { isFoodBusiness } from './catalog-validation';

export type BuyerBusiness = DirectoryBusiness & { commercialKind?: 'menu' | 'catalog' | 'services' };
export function compareDirectoryPresentation(a: BuyerBusiness, b: BuyerBusiness) {
  return Number(Boolean(b.hasCatalog)) - Number(Boolean(a.hasCatalog))
    || Number(Boolean(b.photoUrl)) - Number(Boolean(a.photoUrl));
}
export type QuickCategory = '' | 'tiendas' | 'mercados' | 'farmacias' | 'servicios';
export const quickCategoryNames = { tiendas:'Tiendas',mercados:'Mercados',farmacias:'Farmacias',servicios:'Servicios' };
export function commercialLabel(business: BuyerBusiness) {
  if (!business.hasCatalog) return null;
  if (business.commercialKind === 'services') return 'Ver servicios';
  if (business.commercialKind === 'menu' || (!business.commercialKind && isFoodBusiness(business.category))) return 'Ver menú';
  return 'Ver catálogo';
}
export function matchesQuickCategory(business: BuyerBusiness, filter: QuickCategory) {
  if (!filter) return true;
  const activity = [business.subcategory, ...(business.tags || [])].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (filter === 'mercados') return /mercado|granero|abarrotes/.test(activity);
  if (filter === 'farmacias') return /farmacia|drogueria/.test(activity);
  if (filter === 'servicios') return business.category === 'Profesionales y servicios';
  return business.category === 'Tiendas y comercio' && !/mercado|granero|abarrotes/.test(activity);
}
