import { NextResponse } from 'next/server';
import { initializePilotPublication,publicationManager,publicationStatus,setPilotVisibility } from '@/lib/pilot-publication';
import { PilotError } from '@/lib/restaurant-pilot';
export const dynamic='force-dynamic';
export const maxDuration=90;
function fail(error:unknown) {return NextResponse.json({error:error instanceof PilotError?error.message:'No se pudo completar la publicación. Actualiza antes de reintentar.'},{status:error instanceof PilotError?error.status:503,headers:{'Cache-Control':'no-store'}});}
export async function GET(request:Request) {
  try {await publicationManager(request);return NextResponse.json(await publicationStatus(),{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(error);}
}
export async function POST(request:Request) {
  try {const user=await publicationManager(request);return NextResponse.json(await initializePilotPublication(user),{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(error);}
}
export async function PATCH(request:Request) {
  try {
    await publicationManager(request);const raw=await request.text();if(raw.length>1000)throw new PilotError('Solicitud demasiado grande.',413);
    const body=JSON.parse(raw);if(typeof body?.visible!=='boolean')throw new PilotError('Visibilidad inválida.');
    return NextResponse.json(await setPilotVisibility(body.visible),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return fail(error);}
}
