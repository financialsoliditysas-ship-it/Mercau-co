import { merchantOrderPayout } from '@/lib/pilot-order-finance';

const money=(value:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
const percent=(value:number)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(value/100);

export default function RestaurantOrderPayout({finance,status}:{finance:unknown;status:string}) {
  const payout=merchantOrderPayout(finance);
  if(!payout)return <p className="pilot-payout-missing">Valor a recibir por productos: no disponible. Consulta a Mercáu para confirmar el importe.</p>;
  const inactive=status==='rejected'||status==='cancelled';
  return <section className={`pilot-order-payout${inactive?' is-inactive':''}`} aria-label="Valor neto de productos">
    <p className="pilot-payout-total"><span>{inactive?'Valor neto calculado de productos':'Valor a recibir por productos'}</span><strong>{money(payout.net)}</strong></p>
    <dl>
      {payout.subtotal!==null&&<div><dt>Productos, sin domicilio</dt><dd>{money(payout.subtotal)}</dd></div>}
      {payout.commission!==null&&<div><dt>Comisión Mercáu{payout.rateBps!==null?` (${percent(payout.rateBps)} %)` : ''}</dt><dd>−{money(payout.commission)}</dd></div>}
    </dl>
    <small>{inactive?'Pedido rechazado o cancelado. Este valor no indica un pago pendiente.':'No incluye el domicilio.'}</small>
  </section>;
}
