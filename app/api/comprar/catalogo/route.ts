import {NextRequest,NextResponse} from 'next/server';
import {accountUser} from '@/lib/account-server';
import {loadDirectoryBusiness} from '@/lib/airtable-directory';
import {publicCatalog} from '@/lib/business-catalog';
import {getSupabaseAdminClient} from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
type Input={businessId?:unknown;items?:unknown;customer?:unknown};
export async function POST(request:NextRequest){
  try{
    const user=await accountUser(request);
    const body=await request.json() as Input;
    if(typeof body.businessId!=='string'||!Array.isArray(body.items)||!body.customer||typeof body.customer!=='object')throw new Error('Revisa el pedido.');
    const business=await loadDirectoryBusiness(body.businessId);
    if(!business||!['ventas','ventas_plus'].includes(business.commercePlan||''))return NextResponse.json({error:'Este negocio no tiene compras habilitadas dentro de Mercáu.'},{status:409});
    const catalog=await publicCatalog(business.id);if(!catalog)throw new Error('El catálogo no está disponible.');
    const requested=(body.items as Array<Record<string,unknown>>).slice(0,40);if(!requested.length)throw new Error('Agrega al menos un producto.');
    const items=requested.map(item=>{
      const product=catalog.products.find(current=>current.id===item.productId&&current.available&&current.publicationType==='product');
      const quantity=Number(item.quantity);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>20)throw new Error('Uno de los productos ya no está disponible.');
      const variant=item.variantId?product.variants.find(current=>current.id===item.variantId&&current.available):undefined;
      if(product.variants.length&&!variant)throw new Error(`Selecciona una opción disponible para ${product.name}.`);
      const unitPrice=variant?.price??product.price;
      return {productId:product.id,name:product.name,quantity,variantId:variant?.id||null,variantLabel:variant?.label||'',unitPrice,total:unitPrice*quantity};
    });
    const customer=body.customer as Record<string,unknown>;
    const clean=(key:string,max:number)=>typeof customer[key]==='string'?String(customer[key]).trim().slice(0,max):'';
    const customerName=clean('name',120),customerPhone=clean('phone',30),municipality=clean('municipality',100),address=clean('address',300),notes=clean('notes',600);
    if(!customerName||!/^[0-9+ ()-]{7,30}$/.test(customerPhone)||!municipality||!address)throw new Error('Completa nombre, teléfono, municipio y dirección.');
    const id=crypto.randomUUID(),publicId=`MCU-C-${id.slice(0,8).toUpperCase()}`,subtotal=items.reduce((sum,item)=>sum+item.total,0);
    const {error}=await getSupabaseAdminClient().from('business_catalog_orders').insert({id,public_id:publicId,business_id:business.id,buyer_id:user.id,customer_name:customerName,customer_phone:customerPhone,delivery_municipality:municipality,delivery_address:address,customer_notes:notes,items,subtotal});
    if(error)throw new Error('No se pudo guardar el pedido.');
    return NextResponse.json({ok:true,publicId},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo crear el pedido.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
