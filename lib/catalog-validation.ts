export type CatalogOptionChoice = { id:string; name:string; priceDelta:number; defaultSelected:boolean };
export type CatalogOptionGroup = {
  id:string; name:string; type:'single'|'multiple'; required:boolean;
  minSelections:number; maxSelections:number; choices:CatalogOptionChoice[];
};
export type CatalogFields = {
  name: string; description: string; section: string; price: number;
  available: boolean; status: 'draft'|'published'|'archived'; position: number;
  optionGroups: CatalogOptionGroup[];
};
export type CatalogProduct = CatalogFields & {id:string;version:number;imageUrl?:string;updated_at:string};
export const catalogKeys = ['name','description','section','price','available','status','position','optionGroups'] as const;
const optionId=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function catalogOptionGroups(value:unknown):CatalogOptionGroup[] {
  if(!Array.isArray(value) || value.length>8)throw new Error('Puedes crear hasta 8 grupos de opciones por producto.');
  let total=0;
  return value.map(raw=>{
    if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('Revisa las opciones del producto.');
    const group=raw as Record<string,unknown>;
    const allowed=['id','name','type','required','minSelections','maxSelections','choices'];
    if(Object.keys(group).some(key=>!allowed.includes(key)) || !optionId.test(String(group.id || '')) || typeof group.name!=='string' || !group.name.trim() || group.name.length>80 || !['single','multiple'].includes(String(group.type)) || typeof group.required!=='boolean' || !Number.isInteger(group.minSelections) || !Number.isInteger(group.maxSelections))throw new Error('Revisa la configuración del grupo de opciones.');
    if(!Array.isArray(group.choices) || group.choices.length<1 || group.choices.length>20)throw new Error('Cada grupo debe tener entre 1 y 20 opciones.');
    total+=group.choices.length;if(total>60)throw new Error('Puedes configurar hasta 60 opciones por producto.');
    const choices=group.choices.map(rawChoice=>{
      if(!rawChoice || typeof rawChoice!=='object' || Array.isArray(rawChoice))throw new Error('Revisa una opción del producto.');
      const choice=rawChoice as Record<string,unknown>;
      if(Object.keys(choice).some(key=>!['id','name','priceDelta','defaultSelected'].includes(key)) || !optionId.test(String(choice.id || '')) || typeof choice.name!=='string' || !choice.name.trim() || choice.name.length>80 || !Number.isInteger(choice.priceDelta) || Number(choice.priceDelta)<0 || Number(choice.priceDelta)>100000000 || typeof choice.defaultSelected!=='boolean')throw new Error('Revisa el nombre y precio de las opciones.');
      return {id:String(choice.id),name:choice.name.trim(),priceDelta:Number(choice.priceDelta),defaultSelected:choice.defaultSelected};
    });
    if(new Set(choices.map(choice=>choice.id)).size!==choices.length)throw new Error('Hay opciones repetidas.');
    const type=group.type as CatalogOptionGroup['type'];
    const min=Number(group.minSelections),max=Number(group.maxSelections);
    if(min<0 || max<1 || min>max || max>choices.length || (type==='single' && (max!==1 || min>1)))throw new Error('Revisa el mínimo y máximo de selecciones.');
    if(group.required && min<1)throw new Error('Un grupo obligatorio debe exigir al menos una selección.');
    if(type==='single' && choices.filter(choice=>choice.defaultSelected).length>1)throw new Error('Solo una opción puede estar marcada inicialmente.');
    return {id:String(group.id),name:group.name.trim(),type,required:group.required,minSelections:min,maxSelections:max,choices};
  });
}
export function parseCatalogPrice(value:string):number {
  const text=value.trim();
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) throw new Error('Escribe el precio en pesos enteros, por ejemplo 20000 o 20.000.');
  const price=Number(text.replace(/\./g,''));
  if(!Number.isSafeInteger(price) || price>100000000) throw new Error('El precio debe estar entre 0 y 100.000.000 de pesos.');
  return price;
}
export function formatCatalogPrice(price:number):string {
  return new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(price);
}
export function validProductId(value:unknown): value is string {
  return typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}
export function catalogFields(value:unknown):CatalogFields {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Revisa los datos del producto.');
  const input=value as Record<string,unknown>;
  if (Object.keys(input).some(key=>!catalogKeys.includes(key as typeof catalogKeys[number]))) throw new Error('Hay campos de producto no permitidos.');
  for (const [key,limit] of [['name',120],['description',600],['section',80]] as const) {
    if (typeof input[key]!=='string' || input[key].length>limit) throw new Error('Revisa el nombre, la descripción y la sección.');
  }
  if (!(input.name as string).trim()) throw new Error('Escribe el nombre del producto.');
  if (!Number.isInteger(input.price) || Number(input.price)<0 || Number(input.price)>100000000) throw new Error('Escribe un precio en pesos colombianos, sin decimales.');
  if (typeof input.available!=='boolean' || !['draft','published','archived'].includes(String(input.status))) throw new Error('Revisa la disponibilidad y el estado.');
  if (!Number.isInteger(input.position) || Number(input.position)<0 || Number(input.position)>10000) throw new Error('Revisa el orden del producto.');
  return {name:(input.name as string).trim(),description:(input.description as string).trim(),section:(input.section as string).trim(),price:Number(input.price),available:input.available,status:input.status as CatalogFields['status'],position:Number(input.position),optionGroups:catalogOptionGroups(input.optionGroups ?? [])};
}
export function sameCatalogFields(a:CatalogFields,b:CatalogFields) {
  return catalogKeys.every(key=>key==='optionGroups'
    ? JSON.stringify(a.optionGroups)===JSON.stringify(b.optionGroups)
    : a[key]===b[key]);
}
export function isFoodBusiness(category:string) {
  return category.trim().toLocaleLowerCase('es-CO')==='comidas y bebidas';
}
export function catalogNoun(category:string) {
  return isFoodBusiness(category) ? 'Menú' : 'Catálogo';
}
export function catalogLabel(category:string) {
  return `Ver ${catalogNoun(category).toLocaleLowerCase('es-CO')}`;
}
