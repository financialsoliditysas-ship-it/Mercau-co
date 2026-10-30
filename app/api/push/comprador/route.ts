import { NextResponse } from 'next/server';
import { pilotUser, PilotError } from '@/lib/restaurant-pilot';
import { orderChangesEnabled } from '@/lib/order-changes-config';
import { getWebPushPublicKey } from '@/lib/business-push';
import { validCustomerSubscription } from '@/lib/customer-push';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
async function handle(request:Request) {
  try {
    const user=await pilotUser(request);
    if(!orderChangesEnabled())return NextResponse.json({available:false},{headers});
    if(request.method==='GET')return NextResponse.json({available:!!getWebPushPublicKey()&&!!process.env.WEB_PUSH_PRIVATE_KEY,publicKey:getWebPushPublicKey()},{headers});
    const raw=await request.text();if(raw.length>4000)throw new PilotError('Solicitud demasiado extensa.',413);
    let body;try{body=JSON.parse(raw);}catch{throw new PilotError('Solicitud inválida.');}
    const db=getSupabaseAdminClient();
    if(request.method==='DELETE') {
      if(typeof body?.endpoint!=='string'||body.endpoint.length>2000)throw new PilotError('Dispositivo inválido.');
      const result=await db.from('customer_push_subscriptions').update({disabled_at:new Date().toISOString()}).eq('user_id',user.id).eq('endpoint',body.endpoint);
      if(result.error)throw new PilotError('No se pudo desactivar el aviso.',503);
    }else if(body?.action==='status') {
      if(typeof body.endpoint!=='string'||body.endpoint.length>2000)throw new PilotError('Dispositivo inválido.');
      const result=await db.from('customer_push_subscriptions').select('endpoint').eq('user_id',user.id).eq('endpoint',body.endpoint).is('disabled_at',null).maybeSingle();
      if(result.error)throw new PilotError('No se pudo comprobar este dispositivo.',503);
      return NextResponse.json({subscribed:!!result.data},{headers});
    }else{
      const subscription=validCustomerSubscription(body);if(!subscription)throw new PilotError('Este dispositivo no tiene una suscripción válida.');
      const result=await db.from('customer_push_subscriptions').upsert({...subscription,user_id:user.id,disabled_at:null,last_seen_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(result.error)throw new PilotError('No se pudo activar este dispositivo.',503);
    }
    return NextResponse.json({ok:true},{headers});
  }catch(error){return NextResponse.json({error:error instanceof PilotError?error.message:'No se pudo configurar el aviso.'},{status:error instanceof PilotError?error.status:503,headers});}
}
export const GET=handle, POST=handle, DELETE=handle;
