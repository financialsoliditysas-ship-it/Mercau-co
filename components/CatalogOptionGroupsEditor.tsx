"use client";

import { Plus, Trash2 } from 'lucide-react';
import type { CatalogOptionGroup } from '@/lib/catalog-validation';

const field='min-h-11 min-w-0 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#D82016]';
const secondary='inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
const templates={
  ingredients:{name:'Ingredientes incluidos',type:'multiple' as const,required:false,minSelections:0,names:['Lechuga','Tomate','Cebolla','Ripio de papa']},
  sauces:{name:'Elige tus salsas',type:'multiple' as const,required:false,minSelections:0,names:['Tomate','Mayonesa','Ajo','BBQ']},
  additions:{name:'Adiciones',type:'multiple' as const,required:false,minSelections:0,names:['Queso adicional','Tocineta','Carne adicional']}
};

function makeGroup(template?:keyof typeof templates):CatalogOptionGroup {
  const source=template?templates[template]:{name:'',type:'single' as const,required:false,minSelections:0,names:['']};
  const defaults=template==='ingredients';
  const choices=source.names.map(name=>({id:crypto.randomUUID(),name,priceDelta:0,defaultSelected:defaults}));
  return {id:crypto.randomUUID(),name:source.name,type:source.type,required:source.required,minSelections:source.minSelections,maxSelections:source.type==='single'?1:choices.length,choices};
}

export default function CatalogOptionGroupsEditor({value,onChange,disabled=false}:{value:CatalogOptionGroup[];onChange:(groups:CatalogOptionGroup[])=>void;disabled?:boolean}) {
  const update=(index:number,group:CatalogOptionGroup)=>onChange(value.map((current,i)=>i===index?group:current));
  const add=(template?:keyof typeof templates)=>onChange([...value,makeGroup(template)]);
  return <section className="grid gap-4 border-t border-gray-200 pt-5 md:col-span-2" aria-labelledby="catalog-options-title">
    <div><h3 id="catalog-options-title" className="text-lg font-bold">Opciones y personalización</h3><p className="mt-1 text-sm leading-6 text-gray-600">Configura ingredientes, salsas, tamaños o adiciones. El cliente también podrá escribir una observación para cada producto.</p></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled || value.length>=8} onClick={()=>add('ingredients')} className={secondary}><Plus size={17}/>Ingredientes</button>
      <button type="button" disabled={disabled || value.length>=8} onClick={()=>add('sauces')} className={secondary}><Plus size={17}/>Salsas</button>
      <button type="button" disabled={disabled || value.length>=8} onClick={()=>add('additions')} className={secondary}><Plus size={17}/>Adiciones</button>
      <button type="button" disabled={disabled || value.length>=8} onClick={()=>add()} className={secondary}><Plus size={17}/>Grupo personalizado</button>
    </div>
    {!value.length && <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">Este producto todavía no tiene opciones. Puedes dejarlo así o agregar una plantilla.</p>}
    {value.map((group,index)=><fieldset key={group.id} className="grid gap-3 border-t border-gray-200 pt-4">
      <legend className="sr-only">Grupo {index+1}</legend>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-semibold">Nombre del grupo<input required maxLength={80} className={field} value={group.name} onChange={e=>update(index,{...group,name:e.target.value})}/></label>
        <label className="grid gap-1 text-sm font-semibold">Tipo de elección<select className={field} value={group.type} onChange={e=>{const type=e.target.value as CatalogOptionGroup['type'];update(index,{...group,type,maxSelections:type==='single'?1:Math.max(1,Math.min(group.maxSelections,group.choices.length)),minSelections:type==='single'?Math.min(group.minSelections,1):group.minSelections});}}><option value="single">Elegir una</option><option value="multiple">Elegir varias</option></select></label>
        <button type="button" onClick={()=>onChange(value.filter((_,i)=>i!==index))} className="grid h-11 w-11 place-items-center rounded-md border border-red-200 text-[#D82016]" aria-label={`Eliminar grupo ${group.name || index+1}`} title="Eliminar grupo"><Trash2 size={18}/></button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={group.required} onChange={e=>update(index,{...group,required:e.target.checked,minSelections:e.target.checked?Math.max(1,group.minSelections):0})} className="h-5 w-5 accent-[#D82016]"/>Elección obligatoria</label>
        {group.type==='multiple' && <label className="flex items-center gap-2 text-sm font-semibold">Máximo<input type="number" min={1} max={group.choices.length || 1} value={group.maxSelections} onChange={e=>update(index,{...group,maxSelections:Math.max(1,Math.min(group.choices.length,Number(e.target.value)))})} className="h-11 w-20 rounded-md border border-gray-300 px-2"/></label>}
      </div>
      <div className="grid gap-2">
        {group.choices.map((choice,choiceIndex)=><div key={choice.id} className="grid gap-2 sm:grid-cols-[auto_1fr_9rem_auto] sm:items-center">
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold"><input type={group.type==='single'?'radio':'checkbox'} name={`default-${group.id}`} checked={choice.defaultSelected} onChange={e=>update(index,{...group,choices:group.choices.map((item,i)=>({...item,defaultSelected:group.type==='single'?i===choiceIndex:i===choiceIndex?e.target.checked:item.defaultSelected}))})} className="h-5 w-5 accent-[#D82016]"/>Inicial</label>
          <input required maxLength={80} aria-label={`Nombre opción ${choiceIndex+1}`} placeholder="Nombre de la opción" className={field} value={choice.name} onChange={e=>update(index,{...group,choices:group.choices.map((item,i)=>i===choiceIndex?{...item,name:e.target.value}:item)})}/>
          <label className="grid gap-1 text-xs font-semibold">Costo adicional<input type="number" min={0} max={100000000} step={1} className={field} value={choice.priceDelta} onChange={e=>update(index,{...group,choices:group.choices.map((item,i)=>i===choiceIndex?{...item,priceDelta:Number(e.target.value)}:item)})}/></label>
          <button type="button" disabled={group.choices.length<=1} onClick={()=>{const choices=group.choices.filter((_,i)=>i!==choiceIndex);update(index,{...group,choices,maxSelections:group.type==='single'?1:Math.min(group.maxSelections,choices.length)});}} className="grid h-11 w-11 place-items-center rounded-md border border-gray-200 text-gray-700 disabled:opacity-40" aria-label={`Eliminar opción ${choice.name || choiceIndex+1}`} title="Eliminar opción"><Trash2 size={17}/></button>
        </div>)}
      </div>
      <button type="button" disabled={disabled || group.choices.length>=20} onClick={()=>{const choices=[...group.choices,{id:crypto.randomUUID(),name:'',priceDelta:0,defaultSelected:false}];update(index,{...group,choices,maxSelections:group.type==='single'?1:Math.max(group.maxSelections,choices.length)});}} className={`${secondary} w-fit`}><Plus size={17}/>Agregar opción</button>
    </fieldset>)}
  </section>;
}
