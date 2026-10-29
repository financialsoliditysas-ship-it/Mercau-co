import { MapPin, Wallet } from 'lucide-react';

type ReviewLine={lineId:string;name:string;unitPrice:number;quantity:number;note:string;
  options:{id:string;groupName:string;name:string;priceDelta:number}[]};
type Props={businessName:string;lines:ReviewLine[];subtotal:number;fee:number;customer:{name:string;phone:string;address:string;neighborhood:string;instructions:string};
  paymentMethod:'CASH'|'BREB_QR';hasPoint:boolean;live:boolean;busy:boolean;canConfirm:boolean;onConfirm:()=>void;onEdit:()=>void};
const money=(value:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);

export default function OrderReviewPresentation({businessName,lines,subtotal,fee,customer,paymentMethod,hasPoint,live,busy,canConfirm,onConfirm,onEdit}:Props){
  return <div className="order-review-presentation">
    <h3>Revisa tu pedido</h3>
    <section className="order-review-products" aria-label="Productos y total"><p className="order-review-business">{businessName}</p><h4>Resumen del pedido</h4>
      {lines.map(line=><div key={line.lineId} className="order-review-line"><p><strong>{line.quantity} x {line.name}</strong><strong>{money(line.unitPrice*line.quantity)}</strong></p>
        {line.options.map(choice=><p key={choice.id} className="pilot-line-detail">{choice.groupName}: {choice.name}{choice.priceDelta>0&&<> <strong>+{money(choice.priceDelta)} c/u</strong></>}</p>)}{line.note&&<p className="pilot-line-detail">Observación: {line.note}</p>}
      </div>)}
      <dl className="order-review-totals"><div><dt>Productos</dt><dd>{money(subtotal)}</dd></div><div><dt>Domicilio</dt><dd>{money(fee)}</dd></div><div><dt>{live?'Total a pagar':'Total de prueba'}</dt><dd>{money(subtotal+fee)}</dd></div></dl>
    </section>
    <section className="order-review-delivery" aria-label="Dirección y destinatario"><h4><MapPin size={18} aria-hidden="true"/>Entrega</h4><p>{customer.address}, {customer.neighborhood}</p><p>{customer.instructions}</p><p>{customer.name} · {customer.phone}</p>{hasPoint&&<p className="order-review-point">Ubicación exacta agregada</p>}</section>
    <section className="order-review-payment" aria-label="Pago seleccionado"><h4><Wallet size={18} aria-hidden="true"/>Pago contra entrega</h4><p>{paymentMethod==='BREB_QR'?'Transferencia Bre-B al recibir. El domiciliario te mostrará el QR.':'Efectivo al recibir'}</p></section>
    <p className="order-review-condition">Al confirmar, enviaremos tu pedido al negocio para que lo acepte.</p>
    <div className="order-review-actions"><button disabled={!canConfirm||busy} className="pilot-primary" onClick={onConfirm}>{busy?'Guardando...':live?'Confirmar pedido':'Confirmar pedido de prueba'}</button><button disabled={busy} onClick={onEdit}>Editar datos</button></div>
  </div>;
}
