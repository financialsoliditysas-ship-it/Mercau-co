import { NextRequest,NextResponse } from 'next/server';
import { catalogBucket,catalogOwner,catalogProduct,ownerProduct,setCatalogImage,CatalogError } from '@/lib/business-catalog';
import { catalogBody,catalogFailure,catalogVersion } from '@/lib/catalog-http';
import { validProductId } from '@/lib/catalog-validation';
import { validatePhoto } from '@/lib/business-photo';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:{businessId:string;productId:string}}) {
  try {
    await catalogOwner(request,params.businessId);
    if(!validProductId(params.productId))throw new CatalogError('Producto inválido.');
    const body=await catalogBody(request,2900000);
    const version=catalogVersion(body.version);
    let upload;
    try{upload=validatePhoto({...body,kind:'photo'});}catch(error){throw new CatalogError(error instanceof Error?error.message:'Revisa la imagen.');}
    const current=await catalogProduct(params.businessId,params.productId);
    const path=`${params.businessId}/${params.productId}/${upload.filename}`;
    if(current.image_path===path)return NextResponse.json({product:await ownerProduct(current)},{headers:{'Cache-Control':'no-store'}});
    if(current.version!==version)throw new CatalogError('El producto cambió. Recarga antes de guardar su foto.',409);
    const storage=getSupabaseAdminClient().storage.from(catalogBucket);
    const bytes=Buffer.from(upload.file,'base64');
    const {error}=await storage.upload(path,bytes,{contentType:upload.contentType,upsert:false});
    if(error) {
      // A timed-out upload may already exist. Only accept the exact original bytes.
      const existing=await storage.download(path);
      if(existing.error || !existing.data || !Buffer.from(await existing.data.arrayBuffer()).equals(bytes))throw new CatalogError('No se pudo subir la foto. Conserva el archivo e intenta nuevamente.',503);
    }
    return NextResponse.json({product:await setCatalogImage(params.businessId,params.productId,version,path)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return catalogFailure(error);}
}
