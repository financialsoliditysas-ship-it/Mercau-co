import { directoryCategories } from '@/data/directory';

export type PublicationType='product'|'service';
export type AttributeDefinition={key:string;label:string;kind:'text'|'number';unit?:string};
export type VariantDefinition={key:string;label:string};
export type CatalogTemplate={attributes:AttributeDefinition[];variants:VariantDefinition[]};

const templates:Record<string,CatalogTemplate>={
  'Comidas y bebidas':{attributes:[{key:'contenido',label:'Contenido',kind:'text'},{key:'peso',label:'Peso',kind:'text'}],variants:[{key:'presentacion',label:'Presentación'}]},
  'Tiendas y comercio':{attributes:[{key:'marca',label:'Marca',kind:'text'},{key:'contenido',label:'Contenido',kind:'text'}],variants:[{key:'unidad',label:'Unidad'},{key:'presentacion',label:'Presentación'}]},
  'Ferretería y construcción':{attributes:[{key:'material',label:'Material',kind:'text'},{key:'medida',label:'Medida',kind:'text'},{key:'calibre',label:'Calibre',kind:'text'},{key:'potencia',label:'Potencia',kind:'text'},{key:'voltaje',label:'Voltaje',kind:'text'}],variants:[{key:'unidad',label:'Unidad'},{key:'presentacion',label:'Presentación'}]},
  'Motos y vehículos':{attributes:[{key:'modelo',label:'Modelo',kind:'text'},{key:'referencia',label:'Referencia',kind:'text'},{key:'compatibilidad',label:'Compatibilidad',kind:'text'},{key:'condicion',label:'Condición',kind:'text'}],variants:[]},
  'Salud y bienestar':{attributes:[{key:'marca',label:'Marca',kind:'text'},{key:'contenido',label:'Contenido',kind:'text'}],variants:[{key:'presentacion',label:'Presentación'}]},
  'Belleza y cuidado personal':{attributes:[{key:'contenido',label:'Contenido',kind:'text'},{key:'duracion',label:'Duración',kind:'text'}],variants:[{key:'tono',label:'Tono'},{key:'presentacion',label:'Presentación'}]},
  'Moda y accesorios':{attributes:[{key:'material',label:'Material',kind:'text'},{key:'edad',label:'Edad recomendada',kind:'text'},{key:'guia',label:'Guía de medidas',kind:'text'}],variants:[{key:'talla',label:'Talla'},{key:'color',label:'Color'}]},
  'Hogar, tecnología y reparación':{attributes:[{key:'modelo',label:'Modelo',kind:'text'},{key:'capacidad',label:'Capacidad',kind:'text'},{key:'dimensiones',label:'Dimensiones',kind:'text'},{key:'garantia',label:'Garantía',kind:'text'}],variants:[{key:'almacenamiento',label:'Almacenamiento'},{key:'memoria',label:'Memoria'},{key:'color',label:'Color'}]},
  'Transporte y movilidad':{attributes:[{key:'cobertura',label:'Cobertura',kind:'text'},{key:'modalidad',label:'Modalidad',kind:'text'}],variants:[]},
  'Agro, campo y alimentos':{attributes:[{key:'peso',label:'Peso',kind:'text'},{key:'contenido',label:'Contenido',kind:'text'}],variants:[{key:'unidad',label:'Unidad'},{key:'presentacion',label:'Presentación'}]},
  'Profesionales y servicios':{attributes:[{key:'alcance',label:'Alcance',kind:'text'},{key:'modalidad',label:'Modalidad',kind:'text'},{key:'duracion',label:'Duración',kind:'text'},{key:'cobertura',label:'Cobertura',kind:'text'}],variants:[]}
};

export const basicProductTemplate:CatalogTemplate={attributes:[{key:'marca',label:'Marca',kind:'text'},{key:'referencia',label:'Referencia',kind:'text'}],variants:[]};
export const basicServiceTemplate:CatalogTemplate={attributes:[{key:'alcance',label:'Alcance',kind:'text'},{key:'modalidad',label:'Modalidad',kind:'text'},{key:'cobertura',label:'Cobertura',kind:'text'}],variants:[]};
export function catalogTemplate(category:string,type:PublicationType){return type==='service'?{...basicServiceTemplate,attributes:[...basicServiceTemplate.attributes,...(templates[category]?.attributes||[]).filter(item=>!basicServiceTemplate.attributes.some(base=>base.key===item.key))]}:(templates[category]||basicProductTemplate);}
export function validCatalogCategory(value:string){return directoryCategories.some(item=>item.name===value);}
export function catalogSubcategories(category:string){return directoryCategories.find(item=>item.name===category)?.subcategories||[];}
