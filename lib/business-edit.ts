import { createHash } from 'crypto';
import { directoryCategories,directoryMunicipalities } from '@/data/directory';

export const editableBusinessKeys = ['description','neighborhood','hours','deliveries','instagram','facebook','mapsUrl'] as const;
export const additionalBusinessKeys=['name','category','municipality','whatsapp','subcategory','secondaryCategories','tags'] as const;
export type BusinessEdit = Record<typeof editableBusinessKeys[number], string> & {name?:string;category?:string;municipality?:string;whatsapp?:string;subcategory?:string;secondaryCategories?:string[];tags?:string[]};
export function businessEditValues(business: Partial<BusinessEdit>): BusinessEdit {
  return {...Object.fromEntries(editableBusinessKeys.map(key => [key, business[key] || ''])),...Object.fromEntries(additionalBusinessKeys.filter(key=>business[key]!==undefined).map(key=>[key,business[key]]))} as BusinessEdit;
}
export function businessEditVersion(business: Partial<BusinessEdit>) {
  return createHash('sha256').update(JSON.stringify(businessEditValues(business))).digest('hex');
}
export function validateBusinessEdit(value: unknown): BusinessEdit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Datos inválidos.');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => ![...editableBusinessKeys,...additionalBusinessKeys].includes(key as typeof editableBusinessKeys[number]))) throw new Error('Hay campos que no se pueden editar desde este formulario.');
  const limits = { description:700, neighborhood:120, hours:100, deliveries:20, instagram:180, facebook:180, mapsUrl:240 };
  for (const key of editableBusinessKeys) {
    if (typeof data[key] !== 'string' || (data[key] as string).length > limits[key]) throw new Error('Revisa los campos y su longitud.');
  }
  const clean:BusinessEdit = {description:String(data.description).trim(),neighborhood:String(data.neighborhood).trim(),hours:String(data.hours).trim(),deliveries:String(data.deliveries).trim(),instagram:String(data.instagram).trim(),facebook:String(data.facebook).trim(),mapsUrl:String(data.mapsUrl).trim()};
  if (!clean.description || !clean.neighborhood) throw new Error('La descripción y la dirección son obligatorias.');
  if (!['Si','Sí','No','Consultar'].includes(clean.deliveries)) throw new Error('Selecciona una opción de domicilios válida.');
  if (clean.deliveries === 'Sí') clean.deliveries = 'Si';
  for(const key of ['name','category','municipality','whatsapp','subcategory'] as const){if(data[key]!==undefined){if(typeof data[key]!=='string'||String(data[key]).length>120)throw new Error('Revisa los datos principales.');clean[key]=String(data[key]).trim();}}
  if(clean.name!==undefined&&!clean.name)throw new Error('Escribe el nombre comercial.');
  if(clean.category!==undefined&&!directoryCategories.some(c=>c.name===clean.category))throw new Error('Selecciona una categoría válida.');
  if(clean.municipality!==undefined&&!directoryMunicipalities.includes(clean.municipality as typeof directoryMunicipalities[number]))throw new Error('Selecciona un municipio válido.');
  if(clean.whatsapp!==undefined){const digits=clean.whatsapp.replace(/\D/g,'').replace(/^57(?=3\d{9}$)/,'');if(!/^3\d{9}$/.test(digits))throw new Error('Escribe un WhatsApp colombiano de 10 dígitos.');clean.whatsapp=`+57${digits}`;}
  if(clean.subcategory && clean.subcategory!=='Otra actividad'&&!directoryCategories.find(c=>c.name===clean.category)?.subcategories.includes(clean.subcategory))throw new Error('La subcategoría no corresponde a la categoría principal.');
  for(const key of ['secondaryCategories','tags'] as const){if(data[key]!==undefined){if(!Array.isArray(data[key])||(data[key] as unknown[]).length>20||(data[key] as unknown[]).some(v=>typeof v!=='string'||v.length>80))throw new Error('Revisa las categorías y etiquetas.');clean[key]=Array.from(new Set((data[key] as string[]).map(v=>v.trim()).filter(Boolean)));}}
  if(clean.secondaryCategories?.some(c=>c===clean.category||!directoryCategories.some(option=>option.name===c)))throw new Error('Revisa las categorías secundarias.');
  for (const key of ['instagram','facebook','mapsUrl'] as const) {
    const text = clean[key];
    if (key === 'mapsUrl' && text || /^[a-z][a-z\d+.-]*:/i.test(text)) {
      let url: URL;
      try { url = new URL(text); } catch { throw new Error('Revisa los enlaces de redes y Google Maps.'); }
      if (!['https:','http:'].includes(url.protocol)) throw new Error('Usa enlaces http o https.');
    }
  }
  return clean;
}
