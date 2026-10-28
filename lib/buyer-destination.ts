import { directoryMunicipalities, type DirectoryMunicipality } from '@/data/directory';
export const buyerDestinationKey = 'mercau.buyer.destination.v1';
export type BuyerDestination = { municipality: DirectoryMunicipality; source: 'manual' };
export function parseBuyerDestination(value: string | null): BuyerDestination | null {
  try {
    const data = JSON.parse(value || 'null');
    return data && data.source === 'manual' && directoryMunicipalities.includes(data.municipality)
      ? {municipality:data.municipality,source:'manual'} : null;
  } catch { return null; }
}
