import { customerOrderProgress, customerOrderSteps, type CustomerOrder } from '@/lib/customer-order-status';
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
export default function CustomerOrderCard({ order }: { order: CustomerOrder }) {
  const progress = customerOrderProgress(order);
  return <article className="customer-order" aria-label={`Pedido ${order.public_id}`}>
    <header><div><h2>{order.restaurant_name || `Pedido ${order.public_id}`}</h2><p>{order.public_id} · {new Date(order.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p></div>
      <strong className="customer-order-state">{progress.label}</strong></header>
    {!progress.issue && <ol aria-label="Avance del pedido" className="customer-order-steps">
      {customerOrderSteps.map((label, index) => <li key={label} aria-current={index === progress.index ? 'step' : undefined}
        className={index <= progress.index ? 'reached' : ''}><span aria-hidden="true">{index + 1}</span>{label}</li>)}
    </ol>}
    {order.delivery_mode==='OWN'&&<p className="rounded-md bg-red-50 p-3 text-sm font-bold text-[#B81810]">Entrega realizada por el negocio.</p>}
    <ul>{order.lines.map((line,index) => <li key={index}><strong>{line.quantity} x {line.name} · {money(line.unitPrice * line.quantity)}</strong>
      {line.selections?.map(selection=>selection.choices.map(choice=><span key={`${selection.groupName}-${choice.name}`} className="block text-sm text-gray-600">{selection.groupName}: {choice.name}{choice.priceDelta>0&&<> <strong>+{money(choice.priceDelta)} c/u</strong></>}</span>))}
      {line.note&&<span className="block text-sm text-gray-600">Observación: {line.note}</span>}</li>)}</ul>
    <p>Productos: {money(order.subtotal)} · Domicilio: {money(order.delivery_fee)}</p>
    <p><strong>Total: {money(order.subtotal + order.delivery_fee)}</strong></p><p>Entrega: {order.address}</p>
    {order.business_id && <a href={`/negocios/${order.business_id}/catalogo`}>Volver al menú del negocio</a>}
  </article>;
}
