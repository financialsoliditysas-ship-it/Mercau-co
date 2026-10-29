export type CustomerOrder = {
  public_id: string; restaurant_name?: string; business_id?: string;
  status: string; created_at: string; address: string;
  lines: { name: string; unitPrice: number; quantity: number; selections?:{groupName:string;choices:{name:string;priceDelta:number}[]}[];note?:string }[];
  subtotal: number; delivery_fee: number;
  delivery_mode?: 'MERCAU'|'OWN';
  delivery: { status: string } | null;
};
export const customerOrderSteps = ['Solicitud recibida', 'En preparación', 'Listo para recoger',
  'Mensajero asignado', 'Recogido', 'En camino', 'Entregado'];

export function customerOrderProgress(order: Pick<CustomerOrder, 'status' | 'delivery'>) {
  const delivery = order.delivery?.status;
  if (order.status === 'rejected') return { index: -1, label: 'El negocio no aceptó el pedido', issue: true };
  if (delivery === 'cancelled') return { index: -1, label: 'Envío cancelado', issue: true };
  if (delivery === 'failed') return { index: -1, label: 'La entrega requiere revisión', issue: true };
  const deliveryRanks: Record<string, number> = { assigned: 3, picked_up: 4, in_transit: 5, delivered: 6 };
  if (delivery && deliveryRanks[delivery] !== undefined) {
    const index = deliveryRanks[delivery];
    return { index, label: customerOrderSteps[index], issue: false };
  }
  if (delivery === 'integration_error') return { index: 2, label: 'Pedido listo; despacho en revisión', issue: true };
  const ownRanks:Record<string,number>={out_for_delivery:5,delivered:6};
  if(ownRanks[order.status]!==undefined){const index=ownRanks[order.status];return {index,label:customerOrderSteps[index],issue:false};}
  const index = order.status === 'ready' ? 2 : order.status === 'accepted' ? 1 : 0;
  return { index, label: customerOrderSteps[index], issue: false };
}
