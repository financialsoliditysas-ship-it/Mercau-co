import { cache } from 'react';
import { loadDirectoryBusiness, loadDirectoryBusinesses } from './airtable-directory';
import { canonicalBusinessSlug, publicLinkBusinessId, withPublicBusinessLinks } from './business-public-links';
import { validBusinessSlug } from './business-public-url';

export const loadPublicBusiness = cache(async (reference: string) => {
  if (!reference || reference.length > 150) return null;
  const byReference = await loadDirectoryBusiness(reference);
  if (byReference) return (await withPublicBusinessLinks([byReference]))[0];
  const directory = await loadDirectoryBusinesses();
  const businesses = await withPublicBusinessLinks(directory);
  const byId = businesses.find(b => b.id === reference);
  if (byId) return byId;
  const slug = reference.toLowerCase();
  if (!validBusinessSlug(slug)) return null;
  const bySlug = businesses.find(b => b.publicSlug === slug);
  if (bySlug) return bySlug;
  const businessId = await publicLinkBusinessId(slug);
  const business = businessId ? await loadDirectoryBusiness(businessId) : null;
  if (!business) return null;
  return { ...business, publicSlug: business.publicSlug || await canonicalBusinessSlug(business.id) };
});
