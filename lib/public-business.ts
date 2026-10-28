import { cache } from 'react';
import { loadDirectoryBusinesses } from './airtable-directory';
import { canonicalBusinessSlug, publicLinkBusinessId, withPublicBusinessLinks } from './business-public-links';
import { validBusinessSlug } from './business-public-url';

export const loadPublicBusiness = cache(async (reference: string) => {
  if (!reference || reference.length > 150) return null;
  const directory = await loadDirectoryBusinesses();
  const businesses = await withPublicBusinessLinks(directory);
  const byId = businesses.find(b => b.id === reference);
  if (byId) return byId;
  const slug = reference.toLowerCase();
  if (!validBusinessSlug(slug)) return null;
  const bySlug = businesses.find(b => b.publicSlug === slug);
  if (bySlug) return bySlug;
  const businessId = await publicLinkBusinessId(slug);
  const business = businesses.find(b => b.id === businessId);
  if (!business) return null;
  return { ...business, publicSlug: business.publicSlug || await canonicalBusinessSlug(business.id) };
});
