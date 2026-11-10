import {NextRequest,NextResponse} from 'next/server';
import {accountUser} from '@/lib/account-server';
import {loadDirectoryBusiness} from '@/lib/airtable-directory';
import {publicCatalog} from '@/lib/business-catalog';
import {getSupabaseAdminClient} from '@/lib/supabase-admin';
import {newCommerceOrderToken,notifyCommerceOrder} from '@/lib/commerce-order-action';
import {validatePhoto} from '@/lib/business-photo';

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
    const payment=body as Input&{paymentMethod?:unknown;paymentReference?:unknown;paymentProof?:unknown;paymentRequestId?:unknown},paymentMethod=String(payment.paymentMethod||''),paymentReference=String(payment.paymentReference||'').trim().slice(0,120);
    if(!['BANCOLOMBIA','NEQUI','BRE_B'].includes(paymentMethod)||paymentReference.length<4)throw new Error('Selecciona el medio y escribe la referencia de la transferencia.');
    const db=getSupabaseAdminClient(),configured=await db.from('business_catalog_payment_methods').select('method,account_holder,destination,detail').eq('business_id',business.id).eq('method',paymentMethod).eq('enabled',true).maybeSingle();if(configured.error||!configured.data)throw new Error('El medio de pago ya no está disponible.');
    let proof;try{proof=validatePhoto({kind:'photo',requestId:payment.paymentRequestId,file:payment.paymentProof});}catch{throw new Error('Adjunta un comprobante de pago válido.');}
    const id=crypto.randomUUID(),publicId=`MCU-C-${id.slice(0,8).toUpperCase()}`,subtotal=items.reduce((sum,item)=>sum+item.total,0),access=newCommerceOrderToken(),commissionRate=business.commercePlan==='ventas_plus'?500:800,proofPath=`${business.id}/${id}/${proof.filename}`;
    const saved=await db.storage.from('commerce-payment-proofs').upload(proofPath,Buffer.from(proof.file,'base64'),{contentType:proof.contentType,upsert:false});if(saved.error)throw new Error('No se pudo guardar el comprobante. Intenta nuevamente.');
    const {error}=await db.from('business_catalog_orders').insert({id,public_id:publicId,business_id:business.id,buyer_id:user.id,customer_name:customerName,customer_phone:customerPhone,delivery_municipality:municipality,delivery_address:address,customer_notes:notes,items,subtotal,action_token_hash:access.hash,action_expires_at:access.expiresAt,payment_method:paymentMethod,payment_status:'reported',payment_reference:paymentReference,payment_proof_path:proofPath,payment_reported_at:new Date().toISOString(),payment_recipient:configured.data,commission_rate_bps:commissionRate,commission_amount:Math.round(subtotal*commissionRate/10000)});
    if(error){await db.storage.from('commerce-payment-proofs').remove([proofPath]);throw new Error('No se pudo guardar el pedido.');}
    await db.from('business_catalog_order_history').insert({order_id:id,status:'payment_reported',actor_type:'buyer',actor_reference:user.id});
    const whatsapp=await notifyCommerceOrder({id,publicId,businessName:business.name,phone:business.whatsapp,token:access.token});
    return NextResponse.json({ok:true,publicId,whatsapp},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo crear el pedido.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
