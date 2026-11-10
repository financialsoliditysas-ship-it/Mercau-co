import { NextResponse } from 'next/server';
import { createBusinessOrderConfig,listBusinessOrderConfigs,listPendingBusinessOrderConfigs,updateBusinessOrderConfig } from '@/lib/admin-business-orders';
import { createUnclaimedBusiness } from '@/lib/admin-unclaimed-business';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { loadDirectoryBusinesses } from '@/lib/airtable-directory';
import { randomBytes } from 'crypto';
import type { User } from '@supabase/supabase-js';
export const dynamic='force-dynamic';
function authorized(request:Request){const password=process.env.ADMIN_METRICS_PASSWORD;return Boolean(password&&request.headers.get('x-admin-password')===password);}
export async function GET(request:Request){
  if(!authorized(request))return NextResponse.json({ok:false,error:'No autorizado.'},{status:401});
  try{
    const db=getSupabaseAdminClient();
    const [businesses,pending,directory,owners]=await Promise.all([listBusinessOrderConfigs(),listPendingBusinessOrderConfigs(),loadDirectoryBusinesses(),db.from('business_admins').select('business_id,owner_name,status').eq('status','Activo')]);
    if(owners.error)throw new Error('No se pudieron consultar los propietarios.');
    const ownerByBusiness=new Map((owners.data||[]).map(row=>[row.business_id,row.owner_name||'Cuenta asignada']));
    return NextResponse.json({ok:true,businesses,pending,directory:directory.map(item=>({id:item.id,name:item.name,municipality:item.municipality,owner:ownerByBusiness.get(item.id)||''})).sort((a,b)=>a.name.localeCompare(b.name,'es'))});
  }
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'No se pudieron cargar los negocios.'},{status:500});}
}
export async function PATCH(request:Request){
  if(!authorized(request))return NextResponse.json({ok:false,error:'No autorizado.'},{status:401});
  try{const body=await request.json();await updateBusinessOrderConfig(String(body.id||''),body);return NextResponse.json({ok:true});}
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'No se pudo guardar.'},{status:400});}
}
export async function POST(request:Request){
  if(!authorized(request))return NextResponse.json({ok:false,error:'No autorizado.'},{status:401});
  try{
    const body=await request.json();
    if(body.action==='prepare_orders')return NextResponse.json({ok:true,result:await createBusinessOrderConfig(String(body.businessId||''))},{status:201});
    if(body.action==='assign_owner'){
      const businessId=String(body.businessId||''),email=String(body.email||'').trim().toLowerCase(),ownerName=String(body.ownerName||'').trim().slice(0,100),replaceExisting=body.replaceExisting===true;
      if(!/^rec[A-Za-z0-9]{14}$/.test(businessId)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Selecciona una ficha e ingresa un correo válido.');
      const db=getSupabaseAdminClient(),business=await db.from('directory_businesses').select('id,name,whatsapp').eq('id',businessId).maybeSingle();
      if(business.error||!business.data)throw new Error('La ficha seleccionada no existe en Supabase.');
      let targetUser:User|undefined;
      for(let page=1;page<=20&&!targetUser;page++){
        const users=await db.auth.admin.listUsers({page,perPage:1000});
        if(users.error)throw new Error('No se pudo consultar la cuenta del propietario.');
        targetUser=users.data.users.find(user=>user.email?.toLowerCase()===email);
        if(users.data.users.length<1000)break;
      }
      if(!targetUser)throw new Error('Ese correo todavía no tiene una cuenta en Mercáu. Primero debe registrarse y confirmar el correo.');
      if(!targetUser.email_confirmed_at)throw new Error('La cuenta existe, pero todavía no ha confirmado el correo.');
      const active=await db.from('business_admins').select('user_id,owner_name').eq('business_id',businessId).eq('status','Activo');
      if(active.error)throw new Error('No se pudo comprobar el propietario actual.');
      const others=(active.data||[]).filter(row=>row.user_id!==targetUser?.id);
      if(others.length&&!replaceExisting)throw new Error(`La ficha ya está asignada a ${others[0].owner_name||'otra cuenta'}. Marca la confirmación para trasladarla.`);
      if(others.length){const disabled=await db.from('business_admins').update({status:'Inactivo'}).eq('business_id',businessId).eq('status','Activo').neq('user_id',targetUser.id);if(disabled.error)throw new Error('No se pudo desactivar el acceso anterior.');}
      const metadata=targetUser.user_metadata||{},resolvedName=ownerName||String(metadata.name||'').trim()||email.split('@')[0];
      const saved=await db.from('business_admins').upsert({user_id:targetUser.id,business_id:businessId,business_name:business.data.name,owner_name:resolvedName,owner_whatsapp:business.data.whatsapp||'',private_token:randomBytes(24).toString('base64url'),status:'Activo'},{onConflict:'user_id,business_id'});
      if(saved.error)throw new Error('No se pudo asignar la ficha.');
      return NextResponse.json({ok:true,business:{id:businessId,name:business.data.name},owner:{name:resolvedName,email}});
    }
    const result=await createUnclaimedBusiness(body,new URL(request.url).origin);
    return NextResponse.json({ok:true,business:result},{status:201});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'No se pudo crear la ficha.'},{status:400});}
}
