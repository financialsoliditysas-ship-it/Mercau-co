import { NextResponse } from 'next/server';
import { createBusinessOrderConfig,listBusinessOrderConfigs,listPendingBusinessOrderConfigs,updateBusinessOrderConfig } from '@/lib/admin-business-orders';
import { createUnclaimedBusiness } from '@/lib/admin-unclaimed-business';
export const dynamic='force-dynamic';
function authorized(request:Request){const password=process.env.ADMIN_METRICS_PASSWORD;return Boolean(password&&request.headers.get('x-admin-password')===password);}
export async function GET(request:Request){
  if(!authorized(request))return NextResponse.json({ok:false,error:'No autorizado.'},{status:401});
  try{const [businesses,pending]=await Promise.all([listBusinessOrderConfigs(),listPendingBusinessOrderConfigs()]);return NextResponse.json({ok:true,businesses,pending});}
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
    const result=await createUnclaimedBusiness(body,new URL(request.url).origin);
    return NextResponse.json({ok:true,business:result},{status:201});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'No se pudo crear la ficha.'},{status:400});}
}
