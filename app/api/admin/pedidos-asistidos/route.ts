import {NextResponse} from 'next/server';
import {createPilotOrder,pilotRestaurant,pilotUser,PilotError,reportPilotPayment} from '@/lib/restaurant-pilot';
import {getSupabaseAdminClient} from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
function authorized(request:Request){const password=process.env.ADMIN_METRICS_PASSWORD;return Boolean(password&&request.headers.get('x-admin-password')===password);}
function failure(error:unknown){const known=error instanceof PilotError;return NextResponse.json({ok:false,error:known?error.message:error instanceof Error?error.message:'No se pudo procesar el pedido.'},{status:known?error.status:500,headers:{'Cache-Control':'no-store'}});}

export async function GET(request:Request){
  if(!authorized(request))return NextResponse.json({ok:false,error:'No autorizado.'},{status:401});
  try{
    const selected=new URL(request.url).searchParams.get('restaurant');
    if(selected){const restaurant=await pilotRestaurant(selected,true,false);return NextResponse.json({ok:true,restaurant:{id:restaurant.id,name:restaurant.name,fee:restaurant.delivery_fee,enabled:restaurant.enabled,menu:restaurant.menu}},{headers:{'Cache-Control':'no-store'}});}
    const db=getSupabaseAdminClient(),result=await db.from('pilot_restaurants').select('id,name,directory_business_id,enabled,is_live').eq('enabled',true).eq('is_live',true).eq('directory_initialized',true).order('name');
    if(result.error)throw new Error('No se pudieron consultar los restaurantes aliados.');
    const ids=(result.data||[]).map(item=>item.directory_business_id).filter(Boolean),directory=ids.length?await db.from('directory_businesses').select('id,municipality').in('id',ids):{data:[],error:null};
    if(directory.error)throw new Error('No se pudo consultar el municipio de los restaurantes.');
    const municipalities=new Map((directory.data||[]).map(item=>[item.id,item.municipality||'Nechí']));
    return NextResponse.json({ok:true,restaurants:(result.data||[]).map(item=>({id:item.id,name:item.name,municipality:municipalities.get(item.directory_business_id)||'Nechí'}))},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}

export async function POST(request:Request){
  if(!authorized(request))return NextResponse.json({ok:false,error:'No autorizado.'},{status:401});
  try{
    const user=await pilotUser(request),body=await request.json(),restaurantId=String(body.restaurantId||'');
    if(!/^rec[A-Za-z0-9]{14}$/.test(restaurantId))throw new PilotError('Selecciona un restaurante aliado.');
    const result=await createPilotOrder(user.id,{...body,confirmed:true},restaurantId,{assisted:true});
    if(body.paymentMethod==='BREB_QR'&&typeof body.paymentReference==='string'&&body.paymentReference.trim())await reportPilotPayment(user.id,result.public_id,body.paymentReference,restaurantId);
    return NextResponse.json({ok:true,publicId:result.public_id,trackingUrl:`/seguimiento/${result.public_id}`,message:'Pedido asistido enviado al restaurante.'},{status:201});
  }catch(error){return failure(error);}
}
