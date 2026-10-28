export const businessSiteUrl = 'https://www.mercau.co';
type BusinessLink = { id: string; publicSlug?: string };
export function businessSlugBase(name: string) {
  const value = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '') || 'negocio';
  return /^rec[a-z0-9]{14}$/.test(value) ? `negocio-${value}` : value;
}
export function validBusinessSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
export function businessPath(business: BusinessLink) {
  return `/negocios/${encodeURIComponent(validBusinessSlug(business.publicSlug) ? business.publicSlug : business.id)}`;
}
export function businessCatalogPath(business: BusinessLink) { return `${businessPath(business)}/catalogo`; }
export function businessPublicUrl(business: BusinessLink) { return `${businessSiteUrl}${businessPath(business)}`; }
export function businessShareMessage(business: BusinessLink & { name: string }) {
  return `${business.name}\nConoce nuestro negocio en Mercáu:\n${businessPublicUrl(business)}`;
}
