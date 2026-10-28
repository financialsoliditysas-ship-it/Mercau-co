import type { DirectoryBusiness } from './directory';
// Synthetic, local-only fixtures. Never used by production endpoints.
export const buyerPreviewBusinesses: DirectoryBusiness[] = [
  { id:'rec00000000000001',name:'Asados de prueba',category:'Comidas y bebidas',photoUrl:'/demo-steak.jpg',photoKind:'photo',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000002',name:'Hamburguesas de prueba',category:'Comidas y bebidas',photoUrl:'/demo-burger.jpg',photoKind:'photo',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000003',name:'Tienda de prueba',category:'Tiendas y comercio',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000004',name:'Servicios de prueba',category:'Profesionales y servicios',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000005',name:'Comercio de prueba',category:'Moda y accesorios',municipality:'Caucasia',hasCatalog:false },
].map(b => ({...b,neighborhood:'',description:'Ejemplo ficticio para revisión visual.',hours:'',whatsapp:'',status:'Publicado',source:'local-preview'} as DirectoryBusiness));
