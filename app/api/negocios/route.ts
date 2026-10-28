import { NextResponse } from "next/server";
import { loadDirectoryBusinesses } from "@/lib/airtable-directory";
import { catalogBusinessAvailability } from '@/lib/catalog-availability';
import { withPublicBusinessLinks } from '@/lib/business-public-links';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const businesses = await withPublicBusinessLinks(await loadDirectoryBusinesses());
    const catalogs=await catalogBusinessAvailability(businesses.map(business=>business.id));
    return NextResponse.json({ businesses:businesses.map(business=>{const catalog=catalogs.get(business.id);return {...business,hasCatalog:Boolean(catalog?.count),catalogItemCount:catalog?.count || 0,commercialSearchTerms:catalog?.searchTerms || []};}) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el directorio desde Airtable.",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 503 }
    );
  }
}
