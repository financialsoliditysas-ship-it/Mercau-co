import { getSupabaseAdminClient } from './supabase-admin';
import type { DeliveryOrder } from './delivery-types';

// Read the recorded allocation; do not recompute commissions or change payment rules.
export async function prepareDispatchFinance(order: DeliveryOrder): Promise<DeliveryOrder> {
  const db = getSupabaseAdminClient();
  const linked = await db.from('pilot_food_orders').select('id')
    .eq('delivery_order_id', order.id).maybeSingle();
  if (linked.error) throw new Error('No se pudo comprobar el pedido asociado. No se solicitó domiciliario.');
  if (!linked.data) {
    if (order.commerce_items?.length) throw new Error('El envío comercial no tiene un pedido asociado. Revisa el despacho.');
    return order;
  }
  const payment = await db.from('order_financial_snapshots')
    .select('payment_method,payment_status,product_subtotal,delivery_fee,customer_total,merchant_net')
    .eq('food_order_id', linked.data.id).single();
  if (payment.error || !payment.data) throw new Error('No se pudieron comprobar los valores del pedido. No se solicitó domiciliario.');
  const p = payment.data;
  const values = [p.product_subtotal, p.delivery_fee, p.customer_total, p.merchant_net];
  if (values.some(value => value === null || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0)
    || Number(p.merchant_net) > Number(p.product_subtotal)
    || Number(p.customer_total) !== Number(p.product_subtotal) + Number(p.delivery_fee)
    || Number(order.commerce_subtotal) !== Number(p.product_subtotal)
    || Number(order.delivery_fee) !== Number(p.delivery_fee)
    || !['CASH','BREB_QR'].includes(p.payment_method)
    || !['PENDING','CONFIRMED'].includes(p.payment_status)) {
    throw new Error('Los valores o el pago del pedido requieren revisión. No se solicitó domiciliario.');
  }
  const prepaid = p.payment_method === 'BREB_QR' && p.payment_status === 'CONFIRMED';
  const transfer = p.payment_method === 'BREB_QR' && !prepaid;
  const result = await db.from('delivery_orders').update({
    commerce_payment_method: p.payment_method, commerce_payment_status: p.payment_status,
    pickup_instructions: prepaid
      ? `Recoger pedido confirmado. Entregar al negocio COP ${p.merchant_net}. Pago del cliente confirmado por Mercáu.`
      : transfer
        ? `Recoger pedido confirmado. Entregar al negocio COP ${p.merchant_net}. Cobro al cliente mediante transferencia Bre-B.`
        : `Recoger pedido confirmado. Entregar al negocio COP ${p.merchant_net}. Cobro al cliente en efectivo.`,
    notes: prepaid
      ? `PAGO CONFIRMADO. No cobrar al cliente. Productos: COP ${p.product_subtotal}. Domicilio: COP ${p.delivery_fee}. Total pagado: COP ${p.customer_total}.`
      : transfer
        ? `COBRO CONTRA ENTREGA POR TRANSFERENCIA BRE-B. Mostrar al cliente el QR de Mercáu: https://www.mercau.co/pagos/mercau-breb.jpeg. Verificar destinatario Financial Solidity S.A.S. Total a cobrar: COP ${p.customer_total}.`
        : `Efectivo contra entrega. Productos: COP ${p.product_subtotal}. Domicilio: COP ${p.delivery_fee}. Total a cobrar: COP ${p.customer_total}.`
  }).eq('id', order.id).select('*').single();
  if (result.error || !result.data) throw new Error('No se guardaron las instrucciones de cobro. No se solicitó domiciliario.');
  return result.data as DeliveryOrder;
}
