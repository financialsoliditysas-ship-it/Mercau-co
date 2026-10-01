export type DirectoryCategory =
  | "Comidas y Bebidas"
  | "Hogar y Tecnología"
  | "Salud"
  | "Belleza"
  | "Moda"
  | "Ferreteria"
  | "Servicios"
  | "Transporte"
  | "Emprendimientos";

export type DirectoryMunicipality =
  | "Cáceres"
  | "Nechí"
  | "Caucasia"
  | "Tarazá"
  | "El Bagre"
  | "Zaragoza";

export type DirectoryBusiness = {
  id: string;
  name: string;
  category: DirectoryCategory;
  municipality: DirectoryMunicipality;
  neighborhood: string;
  description: string;
  hours: string;
  whatsapp: string;
  deliveries?: string;
  instagram?: string;
  facebook?: string;
  mapsUrl?: string;
  status: "Verificado" | "Destacado";
  source: string;
};

export const directoryMunicipalities: DirectoryMunicipality[] = [
  "Cáceres",
  "Caucasia",
  "El Bagre",
  "Nechí",
  "Tarazá",
  "Zaragoza"
];

export const directoryCategories: Array<{
  name: DirectoryCategory;
  hint: string;
}> = [
  { name: "Comidas y Bebidas", hint: "Restaurantes, comidas rápidas y bebidas" },
  { name: "Hogar y Tecnología", hint: "Tiendas, variedades, tecnología y productos de casa" },
  { name: "Salud", hint: "Droguerías, bienestar y atención local" },
  { name: "Belleza", hint: "Barberías, peluquerías y estética" },
  { name: "Moda", hint: "Ropa, calzado y accesorios" },
  { name: "Ferreteria", hint: "Materiales, herramientas y repuestos" },
  { name: "Servicios", hint: "Oficios, técnicos y soluciones" },
  { name: "Transporte", hint: "Mensajería, domicilios y movilidad" },
  { name: "Emprendimientos", hint: "Marcas locales y ventas por redes" }
];
