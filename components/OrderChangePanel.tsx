'use client';
import { useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { PilotProduct } from '@/lib/restaurant-pilot';
import { latestChange, type ChangeLine, type OrderChange } from '@/lib/order-changes-model';
import './order-changes.css';

const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
type Edit={action:'keep'|'remove'|'replace';productId:string;selections:Record<string,string[]>};
export default function OrderChangePanel({publicId,changes,fee,manager=false,lines=[],menu=[],canPropose=false}: {
  publicId:string;changes?:OrderChange[];fee:number;manager?:boolean;lines?:ChangeLine[];menu?:PilotProduct[];canPropose?:boolean;
}) {
  const [open,setOpen]=useState(false),[edits,setEdits]=useState<Record<string,Edit>>({}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const inFlight=useRef(false),key=useRef('');
  const change=latestChange(changes),unresolved=change?.status==='pending'||change?.status==='declined';
  if(changes===undefined)return null;
  function edit(lineId:string,patch:Partial<Edit>) {
    key.current='';setEdits(prev=>({...prev,[lineId]:{...(prev[lineId]||{action:'keep',productId:'',selections:{}}),...patch}}));
  }
  async function act(action:string) {
    if(inFlight.current)return;
    if(action==='accept'&&!window.confirm(`¿Aceptas los productos y opciones propuestos por un total de ${money(change!.new_subtotal+fee)}?`))return;
    if(action==='withdraw'&&!window.confirm('¿Retirar la propuesta y conservar los productos originales? Confirma que puedes atender el pedido original.'))return;
    inFlight.current=true;setBusy(true);setMessage('');
    try {
      const client=getSupabaseBrowserClient(),session=client?(await client.auth.getSession()).data.session:null;
      if(!session)throw new Error('Entra nuevamente con tu cuenta.');
      if(action==='propose'&&!key.current)key.current=crypto.randomUUID();
      const body=action==='propose'?{publicId,action,requestKey:key.current,changes:Object.entries(edits).filter(([,e])=>e.action!=='keep').map(([lineId,e])=>({lineId,action:e.action,productId:e.productId,selections:Object.entries(e.selections).map(([groupId,choiceIds])=>({groupId,choiceIds}))}))}:{publicId,action,proposalId:change?.id};
      const response=await fetch('/api/pedidos/cambios',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo guardar.');
      setMessage('Guardado. Actualizando el pedido.');setOpen(false);setEdits({});key.current='';
      window.dispatchEvent(new Event('mercau:order-updated'));
    }catch(error){setMessage(error instanceof Error?error.message:'No se pudo guardar. Actualiza el pedido antes de reintentar.');}
    finally{setBusy(false);inFlight.current=false;}
  }
  return <section className="order-change" aria-label="Cambios del pedido">
    {change&&<div className="order-change-summary">
      <h3>{change.status==='pending'?'El negocio propone un cambio':change.status==='accepted'?'Cambio aceptado':change.status==='declined'?'Cambio no aceptado':change.status==='withdrawn'?'Propuesta retirada':'Propuesta cancelada'}</h3>
      {(change.status==='pending'||change.status==='declined'||change.status==='accepted')&&<>
        <details open={change.status==='pending'}><summary>Ver productos y opciones del cambio</summary>
          <h4>Pedido original</h4><ChangeLines lines={change.old_lines}/>
          <h4>Propuesta</h4><ChangeLines lines={change.new_lines}/>
          <dl><div><dt>Total anterior</dt><dd>{money(change.old_subtotal+fee)}</dd></div><div><dt>Productos propuestos</dt><dd>{money(change.new_subtotal)}</dd></div><div><dt>Domicilio sin cambios</dt><dd>{money(fee)}</dd></div><div><dt>Total propuesto</dt><dd>{money(change.new_subtotal+fee)}</dd></div></dl>
        </details>
        {change.status==='pending'&&<p>Revisa ingredientes, opciones y precio. El pedido no se modifica sin tu aceptación.</p>}
        {!manager&&change.status==='pending'&&<div className="order-change-actions"><button disabled={busy} onClick={()=>act('accept')}>Aceptar cambio · {money(change.new_subtotal+fee)}</button><button disabled={busy} onClick={()=>act('decline')}>No aceptar el cambio</button></div>}
      </>}
      {manager&&unresolved&&<><p>{change.status==='pending'?'Esperando la respuesta del comprador. No solicites domiciliario.':'El comprador no aceptó. Puedes preparar otra propuesta o retirar esta si puedes atender el pedido original.'}</p><button disabled={busy} onClick={()=>act('withdraw')}>Retirar propuesta</button></>}
      {!manager&&change.status==='declined'&&<p>Tu pedido conserva los productos originales. El negocio debe resolver la novedad antes de continuar. <a href="/contacto">Ayuda de Mercáu</a></p>}
    </div>}
    {manager&&canPropose&&change?.status!=='pending'&&<details open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
      <summary>Opciones del pedido · Hay un producto agotado</summary>
      {open&&<div className="order-change-editor"><h3>Proponer cambio al comprador</h3><p>Selecciona una alternativa del menú o retira el producto. No se enviarán teléfonos ni mensajes libres.</p>
        {lines.map((line,index)=>{
          const id=line.lineId||'',e=edits[id],product=menu.find(item=>item.id===e?.productId);
          return <fieldset key={id||index}><legend>{line.quantity} x {line.name}</legend>
            <label>Qué propones<select disabled={busy||!id} value={e?.action||'keep'} onChange={event=>edit(id,{action:event.target.value as Edit['action'],productId:'',selections:{}})}><option value="keep">Conservar</option><option value="remove">Retirar este producto</option><option value="replace">Cambiar por otro producto</option></select></label>
            {e?.action==='replace'&&<><label>Producto disponible<select disabled={busy} value={e.productId} onChange={event=>edit(id,{productId:event.target.value,selections:{}})}><option value="">Seleccionar alternativa</option>{menu.map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}</select></label>
              {product?.optionGroups.map(group=><fieldset key={group.id}><legend>{group.name}{group.required?' · Obligatorio':''} · Máximo {group.maxSelections}</legend>{group.choices.map(choice=><label key={choice.id} className="order-change-choice"><input disabled={busy} type={group.type==='single'?'radio':'checkbox'} name={`${publicId}-${id}-${group.id}`} checked={(e.selections[group.id]||[]).includes(choice.id)} onChange={event=>{const ids=e.selections[group.id]||[];edit(id,{selections:{...e.selections,[group.id]:group.type==='single'?[choice.id]:event.target.checked?[...ids,choice.id]:ids.filter(value=>value!==choice.id)}});}}/>{choice.name}{choice.priceDelta>0?` +${money(choice.priceDelta)}`:''}</label>)}</fieldset>)}
              {line.note&&<p>Observación original: {line.note}. El comprador debe revisar si la alternativa es adecuada.</p>}
            </>}
          </fieldset>;
        })}
        <button disabled={busy||!Object.values(edits).some(e=>e.action!=='keep')} onClick={()=>act('propose')}>{busy?'Enviando...':'Enviar propuesta para aprobación'}</button>
      </div>}
    </details>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
function ChangeLines({lines}:{lines:ChangeLine[]}) {
  return <ul>{lines.map((line,index)=><li key={index}><strong>{line.quantity} x {line.name} · {money(line.quantity*line.unitPrice)}</strong>
    {line.selections?.map((s,i)=><span key={i}>{s.groupName}: {s.choices.map(c=>`${c.name}${c.priceDelta>0?` (+${money(c.priceDelta)})`:''}`).join(', ')}</span>)}{line.note&&<span>Observación: {line.note}</span>}
  </li>)}</ul>;
}
