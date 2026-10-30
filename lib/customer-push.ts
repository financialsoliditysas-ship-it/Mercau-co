import webpush from 'web-push';
import { configureWebPush } from './business-push';
import { getSupabaseAdminClient } from './supabase-admin';
import { orderChangesEnabled } from './order-changes-config';

export function validCustomerSubscription(value: unknown) {
  const body=value as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}}|null;
  if(!body||typeof body.endpoint!=='string'||body.endpoint.length>2000) return null;
  let url: URL;
  try { url=new URL(body.endpoint); } catch { return null; }
  const host=url.hostname;
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||
    !(['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com','web.push.apple.com'].includes(host)
    ||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com'))) return null;
  const p256dh=body.keys?.p256dh,auth=body.keys?.auth;
  if(typeof p256dh!=='string'||typeof auth!=='string'||!/^[-_a-zA-Z0-9]+$/.test(p256dh)||!/^[-_a-zA-Z0-9]+$/.test(auth)
    ||Buffer.from(p256dh,'base64url').length!==65||Buffer.from(auth,'base64url').length!==16) return null;
  return {endpoint:body.endpoint,p256dh,auth};
}

export async function sendCustomerChangePush(userId: string, publicId: string, proposalId: string) {
  if(!orderChangesEnabled()||!configureWebPush())return {sent:0,unavailable:true};
  const db=getSupabaseAdminClient();
  const subscriptions=await db.from('customer_push_subscriptions').select('endpoint,p256dh,auth')
    .eq('user_id',userId).is('disabled_at',null).limit(5);
  if(subscriptions.error)return {sent:0,unavailable:true};
  const payload=JSON.stringify({kind:'CUSTOMER_ORDER_CHANGE',title:'Tu pedido necesita una respuesta',
    body:'El negocio te propone un cambio. Toca para revisarlo en Mercáu.',
    icon:'/logo-mercau.png',badge:'/logo-mercau.png',tag:`mercau-change-${proposalId}`,
    url:`/comprar/pedidos?pedido=${encodeURIComponent(publicId)}`,orderId:publicId});
  let sent=0;
  await Promise.all((subscriptions.data||[]).map(async sub=>{
    try {
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:300,urgency:'high',timeout:5000});
      sent++;
    } catch(error) {
      const status=error&&typeof error==='object'&&'statusCode' in error?Number(error.statusCode):0;
      if(status===404||status===410)await db.from('customer_push_subscriptions').update({disabled_at:new Date().toISOString()}).eq('endpoint',sub.endpoint).eq('user_id',userId);
    }
  }));
  return {sent};
}
