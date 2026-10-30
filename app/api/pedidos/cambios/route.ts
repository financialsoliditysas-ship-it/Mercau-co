import { NextResponse } from 'next/server';
import { pilotUser, PilotError } from '@/lib/restaurant-pilot';
import { changeOrder } from '@/lib/order-changes';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  const headers={'Cache-Control':'no-store'};
  try {
    const user=await pilotUser(request),raw=await request.text();
    if(raw.length>10000)throw new PilotError('La propuesta es demasiado extensa.',413);
    let body;try{body=JSON.parse(raw);}catch{throw new PilotError('Solicitud inválida.');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new PilotError('Solicitud inválida.');
    return NextResponse.json(await changeOrder(user.id,body),{headers});
  }catch(error){return NextResponse.json({error:error instanceof PilotError?error.message:'No se pudo guardar la respuesta. Actualiza el pedido antes de reintentar.'},{status:error instanceof PilotError?error.status:503,headers});}
}
