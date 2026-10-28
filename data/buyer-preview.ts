import type { BuyerBusiness } from '@/lib/buyer-commercial';
// Synthetic, local-only fixtures. Never used by production endpoints.
export const buyerPreviewBusinesses: BuyerBusiness[] = [
  { id:'rec00000000000001',name:'Asados de prueba',category:'Comidas y bebidas',photoUrl:'/demo-steak.jpg',photoKind:'photo',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000002',name:'Hamburguesas de prueba',category:'Comidas y bebidas',photoUrl:'/demo-burger.jpg',photoKind:'photo',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000003',name:'Tienda de prueba',category:'Tiendas y comercio',subcategory:'Tienda de barrio',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000004',name:'Servicios de prueba',category:'Profesionales y servicios',commercialKind:'services',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000005',name:'Comercio de prueba',category:'Moda y accesorios',municipality:'Caucasia',hasCatalog:false },
  { id:'rec00000000000006',name:'Mercado de prueba',category:'Tiendas y comercio',subcategory:'Minimercado',photoUrl:'/buyer-commerce.jpg',photoKind:'photo',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000007',name:'Farmacia de prueba',category:'Salud y bienestar',subcategory:'Farmacia',municipality:'Nechí',hasCatalog:true },
  { id:'rec00000000000008',name:'Ficha sin catálogo',category:'Moda y accesorios',municipality:'Nechí',hasCatalog:false },
].map(b => ({...b,neighborhood:'',description:'Ejemplo ficticio para revisión visual.',hours:'',whatsapp:'',status:'Publicado',source:'local-preview'} as BuyerBusiness));
