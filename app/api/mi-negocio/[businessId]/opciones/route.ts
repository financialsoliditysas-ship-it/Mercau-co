import { NextRequest,NextResponse } from 'next/server';
import { catalogOwner,CatalogError } from '@/lib/business-catalog';
import { createSharedGroup,listSharedGroups,setSharedGroupLink,updateSharedGroup } from '@/lib/catalog-shared-options';
import { validProductId } from '@/lib/catalog-validation';

function failure(error:unknown) {
  return NextResponse.json({error:error instanceof Error?error.message:'No se pudo completar la operación.'},{status:error instanceof CatalogError?error.status:400});
}

export async function GET(request:NextRequest,{params}:{params:{businessId:string}}) {
  try{await catalogOwner(request,params.businessId);return NextResponse.json({groups:await listSharedGroups(params.businessId)});}catch(error){return failure(error);}
}
export async function POST(request:NextRequest,{params}:{params:{businessId:string}}) {
  try{
    await catalogOwner(request,params.businessId);const body=await request.json();
    if(body.action==='link') {
      if(!validProductId(body.productId)||!validProductId(body.groupId)||typeof body.linked!=='boolean')throw new CatalogError('Revisa el producto y el grupo seleccionado.');
      return NextResponse.json({groups:await setSharedGroupLink(params.businessId,body.productId,body.groupId,body.linked)});
    }
    return NextResponse.json({group:await createSharedGroup(params.businessId,body.group)});
  }catch(error){return failure(error);}
}
export async function PATCH(request:NextRequest,{params}:{params:{businessId:string}}) {
  try{
    await catalogOwner(request,params.businessId);const body=await request.json();
    if(!validProductId(body.id)||!Number.isInteger(body.version))throw new CatalogError('Actualiza la biblioteca e intenta nuevamente.');
    return NextResponse.json({groups:await updateSharedGroup(params.businessId,body.id,body.version,body.group)});
  }catch(error){return failure(error);}
}
