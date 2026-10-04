export type DirectoryCategory =
  | "Comidas y bebidas"
  | "Tiendas y comercio"
  | "Ferretería y construcción"
  | "Motos y vehículos"
  | "Salud y bienestar"
  | "Belleza y cuidado personal"
  | "Moda y accesorios"
  | "Hogar, tecnología y reparación"
  | "Transporte y movilidad"
  | "Agro, campo y alimentos"
  | "Profesionales y servicios";

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
  legacyCategory?: string;
  secondaryCategories?: DirectoryCategory[];
  subcategory?: string;
  tags?: string[];
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
  subcategories: string[];
}> = [
  {
    name: "Comidas y bebidas",
    hint: "Restaurantes, comidas rápidas, panaderías y bebidas",
    subcategories: ["Restaurantes", "Comidas rápidas", "Panaderías y reposterías", "Cafeterías", "Heladerías y bebidas", "Asaderos", "Comida preparada"]
  },
  {
    name: "Tiendas y comercio",
    hint: "Tiendas, minimercados, misceláneas y ventas generales",
    subcategories: ["Tiendas de barrio", "Minimercados", "Supermercados", "Graneros y abarrotes", "Misceláneas", "Papelerías", "Variedades", "Productos para el hogar", "Ventas generales"]
  },
  {
    name: "Ferretería y construcción",
    hint: "Ferreterías, materiales, herramientas y construcción",
    subcategories: ["Ferreterías", "Materiales de construcción", "Pinturas", "Herramientas", "Electricidad", "Plomería", "Alquiler de equipos"]
  },
  {
    name: "Motos y vehículos",
    hint: "Talleres, repuestos, llantas, lavaderos y vehículos",
    subcategories: ["Talleres de motos", "Talleres de carros", "Repuestos", "Llantas", "Lubricantes", "Lavaderos", "Montallantas", "Electricidad automotriz", "Grúas", "Compra y venta de vehículos"]
  },
  {
    name: "Salud y bienestar",
    hint: "Droguerías, farmacias, consultorios y bienestar",
    subcategories: ["Droguerías y farmacias", "Consultorios", "Odontología", "Laboratorios", "Ópticas", "Terapias", "Productos naturales", "Gimnasios", "Bienestar"]
  },
  {
    name: "Belleza y cuidado personal",
    hint: "Barberías, peluquerías, estética y cosméticos",
    subcategories: ["Barberías", "Peluquerías", "Salones de belleza", "Manicure y pedicure", "Maquillaje", "Estética", "Spa", "Cosméticos"]
  },
  {
    name: "Moda y accesorios",
    hint: "Ropa, calzado, bolsos, accesorios y bisutería",
    subcategories: ["Ropa", "Calzado", "Bolsos", "Accesorios", "Joyería y bisutería", "Ropa deportiva", "Uniformes"]
  },
  {
    name: "Hogar, tecnología y reparación",
    hint: "Tecnología, electrodomésticos, muebles y reparaciones",
    subcategories: ["Electrodomésticos", "Celulares y accesorios", "Reparación de celulares", "Reparación de televisores", "Reparación de ventiladores", "Técnicos de electrodomésticos", "Muebles", "Decoración", "Electricistas", "Reparaciones del hogar"]
  },
  {
    name: "Transporte y movilidad",
    hint: "Taxi, mototaxi, mensajería, domicilios y carga",
    subcategories: ["Mototaxi", "Taxi", "Transporte especial", "Transporte de carga", "Mensajería", "Domicilios", "Alquiler de vehículos", "Mudanzas", "Transporte fluvial"]
  },
  {
    name: "Agro, campo y alimentos",
    hint: "Agro, pesca, ganadería, alimentos e insumos rurales",
    subcategories: ["Insumos agropecuarios", "Semillas", "Alimentos para animales", "Productos agrícolas", "Ganadería", "Pesca", "Piscicultura", "Maquinaria agrícola", "Servicios rurales"]
  },
  {
    name: "Profesionales y servicios",
    hint: "Profesionales, oficios, educación, medios y otros servicios",
    subcategories: ["Contadores", "Abogados", "Diseñadores", "Fotógrafos", "Publicidad y medios", "Eventos", "Educación", "Clases particulares", "Limpieza", "Seguridad", "Servicios funerarios", "Otros servicios profesionales"]
  }
];

export const categoryAliases: Record<string, DirectoryCategory> = {
  "Comida": "Comidas y bebidas",
  "Comidas y Bebidas": "Comidas y bebidas",
  "Comidas y bebidas": "Comidas y bebidas",
  "Hogar": "Hogar, tecnología y reparación",
  "Hogar y Tecnología": "Hogar, tecnología y reparación",
  "Hogar, tecnología y reparación": "Hogar, tecnología y reparación",
  "Salud": "Salud y bienestar",
  "Salud y bienestar": "Salud y bienestar",
  "Belleza": "Belleza y cuidado personal",
  "Belleza y cuidado personal": "Belleza y cuidado personal",
  "Moda": "Moda y accesorios",
  "Moda y accesorios": "Moda y accesorios",
  "Ferreteria": "Ferretería y construcción",
  "Ferretería": "Ferretería y construcción",
  "Ferretería y construcción": "Ferretería y construcción",
  "Servicios": "Profesionales y servicios",
  "Profesionales y servicios": "Profesionales y servicios",
  "Transporte": "Transporte y movilidad",
  "Transporte y movilidad": "Transporte y movilidad",
  "Emprendimientos": "Profesionales y servicios",
  "Tiendas y comercio": "Tiendas y comercio",
  "Motos y vehículos": "Motos y vehículos",
  "Agro, campo y alimentos": "Agro, campo y alimentos"
};

export function toDirectoryCategory(value: string): DirectoryCategory {
  return categoryAliases[value] || "Profesionales y servicios";
}
