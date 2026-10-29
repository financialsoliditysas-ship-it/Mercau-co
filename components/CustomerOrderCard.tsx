import { customerOrderProgress, customerOrderSteps, type CustomerOrder } from '@/lib/customer-order-status';
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
export default function CustomerOrderCard({ order, visual=false }: { order: CustomerOrder;visual?:boolean }) {
  const progress = customerOrderProgress(order);
  const label = visual && order.status==='rejected' ? 'El negocio no pudo aceptar tu pedido' : progress.label;
  return <article className={visual?'customer-order customer-order-visual':'customer-order'} aria-label={`Pedido ${order.public_id}`}>
    <header><div><h2>{order.restaurant_name || `Pedido ${order.public_id}`}</h2><p>{order.public_id} · {new Date(order.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p></div>
      <strong className="customer-order-state">{label}</strong></header>
    {order.status==='pending' && !order.delivery && <p><strong>Esperando al negocio.</strong> Recibimos tu solicitud. Falta que el negocio la acepte.</p>}
    {order.status==='accepted' && !order.delivery && <p>El negocio aceptó tu pedido y está preparándolo.</p>}
    {progress.issue && <p>Tu pedido presenta una novedad. Revisa el detalle o <a href="https://wa.me/573207637511?text=Hola%2C%20necesito%20ayuda%20con%20Merc%C3%A1u." target="_blank" rel="noreferrer">contacta a Mercáu</a>.</p>}
    {!progress.issue && <ol aria-label="Avance del pedido" className="customer-order-steps">
      {customerOrderSteps.map((label, index) => <li key={label} aria-current={index === progress.index ? 'step' : undefined}
        className={index <= progress.index ? 'reached' : ''}><span aria-hidden="true">{index + 1}</span>{label}</li>)}
    </ol>}
    {order.delivery_mode==='OWN'&&<p className="rounded-md bg-red-50 p-3 text-sm font-bold text-[#B81810]">Entrega realizada por el negocio.</p>}
    <ul className={visual?'customer-order-lines':undefined}>{order.lines.map((line,index) => <li key={index}><strong>{line.quantity} x {line.name} · {money(line.unitPrice * line.quantity)}</strong>
      {line.selections?.map(selection=>selection.choices.map(choice=><span key={`${selection.groupName}-${choice.name}`} className="block text-sm text-gray-600">{selection.groupName}: {choice.name}{choice.priceDelta>0&&<> <strong>+{money(choice.priceDelta)} c/u</strong></>}</span>))}
      {line.note&&<span className="block text-sm text-gray-600">Observación: {line.note}</span>}</li>)}</ul>
    {visual?<dl className="customer-order-totals"><div><dt>Productos</dt><dd>{money(order.subtotal)}</dd></div><div><dt>Domicilio</dt><dd>{money(order.delivery_fee)}</dd></div><div><dt>Total</dt><dd>{money(order.subtotal+order.delivery_fee)}</dd></div></dl>:<><p>Productos: {money(order.subtotal)} · Domicilio: {money(order.delivery_fee)}</p><p><strong>Total: {money(order.subtotal + order.delivery_fee)}</strong></p></>}
    <p className={visual?'customer-order-address':undefined}>Entrega: {order.address}</p>
    {order.business_id && <a href={`/negocios/${order.business_id}/catalogo`}>Volver al menú del negocio</a>}
  </article>;
}
