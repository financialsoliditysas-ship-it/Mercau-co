import { NextRequest,NextResponse } from 'next/server';
import { catalogOwner,updateCatalogProduct,CatalogError } from '@/lib/business-catalog';
import { catalogBody,catalogFailure,catalogVersion } from '@/lib/catalog-http';
import { catalogFields,validProductId } from '@/lib/catalog-validation';
import { catalogSubcategories } from '@/lib/catalog-templates';
export const dynamic='force-dynamic';
export async function PATCH(request:NextRequest,{params}:{params:{businessId:string;productId:string}}) {
  try {
    const business=await catalogOwner(request,params.businessId);
    if(!validProductId(params.productId))throw new CatalogError('Producto inválido.');
    const body=await catalogBody(request);
    let fields;
    try{fields=catalogFields(body.fields);}catch(error){throw new CatalogError(error instanceof Error?error.message:'Revisa el producto.');}
    const allowed=[business.category,...(business.secondaryCategories||[])];
    if(fields.category&&!allowed.includes(fields.category))throw new CatalogError('La categoría no está habilitada para este negocio.');
    if(fields.subcategory&&!catalogSubcategories(fields.category||business.category).includes(fields.subcategory))throw new CatalogError('La subcategoría no pertenece a la categoría elegida.');
    return NextResponse.json({product:await updateCatalogProduct(params.businessId,params.productId,catalogVersion(body.version),fields)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return catalogFailure(error);}
}
