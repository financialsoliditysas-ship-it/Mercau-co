import { NextResponse } from 'next/server';
import { CatalogError } from './business-catalog';
export async function catalogBody(request:Request,max=12000) {
  const raw=await request.text();
  if(raw.length>max)throw new CatalogError('La solicitud es demasiado grande.',413);
  try {
    const body=JSON.parse(raw);
    if(!body || typeof body!=='object' || Array.isArray(body))throw new Error();
    return body as Record<string,unknown>;
  }catch{throw new CatalogError('Datos inválidos.');}
}
export function catalogFailure(error:unknown) {
  return NextResponse.json({error:error instanceof CatalogError ? error.message : 'No se pudo completar la operación. Intenta nuevamente.'},{status:error instanceof CatalogError ? error.status : 503,headers:{'Cache-Control':'no-store'}});
}
export function catalogVersion(value:unknown) {
  if(!Number.isSafeInteger(value) || Number(value)<1)throw new CatalogError('Recarga el producto antes de guardar.');
  return Number(value);
}
