import { MetadataRoute } from "next";
import { loadDirectoryBusinesses } from '@/lib/airtable-directory';
import { withPublicBusinessLinks } from '@/lib/business-public-links';
import { businessPublicUrl } from '@/lib/business-public-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.mercau.co";
  const now = new Date().toISOString();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/nosotros`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/negocios/registro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contacto`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
  try {
    const businesses = await withPublicBusinessLinks((await loadDirectoryBusinesses()).filter(business => !business.pilotRestaurant));
    pages.push(...businesses.map(business => ({ url: businessPublicUrl(business), changeFrequency: 'weekly' as const, priority: 0.7 })));
  } catch { /* Keep the basic sitemap available if the directory is temporarily unavailable. */ }
  return pages;
}
