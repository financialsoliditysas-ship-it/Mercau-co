import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FIELD_IDS = {
  name: "fldZAuId3Z7tmNg1y",
  category: "fldyp3od5rTBa74il",
  description: "fldlAXHZlQY2PLtvX",
  neighborhood: "fldzy7nwjlebys4w0",
  primary: process.env.AIRTABLE_CATEGORIA_PRINCIPAL_FIELD_ID || "",
  subcategory: process.env.AIRTABLE_SUBCATEGORIA_FIELD_ID || "",
  tags: process.env.AIRTABLE_ETIQUETAS_FIELD_ID || "",
  legacy: process.env.AIRTABLE_CATEGORIA_ANTERIOR_FIELD_ID || "",
  review: "fldyzNzOUJyieR9cQ"
};

function selectName(value: unknown) {
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }

  return String(value || "");
}

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function classify(oldCategory: string, name: string, description: string, neighborhood: string) {
  const text = normalize(`${name} ${description} ${neighborhood}`);
  let primary = "Profesionales y servicios";
  let subcategory = "Otros servicios profesionales";
  const tags = new Set<string>();

  if (
    oldCategory === "Comidas y Bebidas" ||
    hasAny(text, ["restaurante", "comida", "comidas", "alitas", "hamburguesa", "asado", "panaderia", "cafeteria", "cafe", "helado", "michelada", "salpicon", "oblea", "wafle", "torta", "bunuelos", "avena"])
  ) {
    primary = "Comidas y bebidas";
    if (hasAny(text, ["panaderia", "torta", "bunuelos", "reposteria"])) subcategory = "Panaderías y reposterías";
    else if (hasAny(text, ["cafe", "cafeteria"])) subcategory = "Cafeterías";
    else if (hasAny(text, ["helado", "michelada", "salpicon", "oblea", "wafle", "bebida"])) subcategory = "Heladerías y bebidas";
    else if (hasAny(text, ["hamburguesa", "alitas", "comidas rapidas"])) subcategory = "Comidas rápidas";
    else if (hasAny(text, ["asado"])) subcategory = "Asaderos";
    else subcategory = "Restaurantes";
  } else if (hasAny(text, ["tilapia", "granja", "piscicultura", "pesca", "agro", "agricola", "ganaderia", "semilla"])) {
    primary = "Agro, campo y alimentos";
    subcategory = "Piscicultura";
  } else if (
    oldCategory === "Moda" ||
    hasAny(text, ["ropa", "calzado", "tenis", "camiseta", "camisetas", "boutique", "prendas", "gorras", "bolsos", "joyeria", "joyas", "oro", "bisuteria", "uniformes", "sandalias", "accesorios y perfumeria"])
  ) {
    primary = "Moda y accesorios";
    if (hasAny(text, ["joyeria", "joyas", "oro", "bisuteria"])) subcategory = "Joyería y bisutería";
    else if (hasAny(text, ["calzado", "tenis", "sandalias"])) subcategory = "Calzado";
    else if (hasAny(text, ["camiseta", "camisetas", "ropa", "boutique", "prendas"])) subcategory = "Ropa";
    else subcategory = "Accesorios";
  } else if (
    oldCategory === "Belleza" ||
    hasAny(text, ["cosmetico", "cosmeticos", "maquillaje", "barberia", "peluqueria", "belleza", "manicure", "pedicure", "capilar", "estetica"])
  ) {
    primary = "Belleza y cuidado personal";
    if (hasAny(text, ["cosmetico", "cosmeticos", "maquillaje"])) subcategory = "Cosméticos";
    else if (hasAny(text, ["barberia"])) subcategory = "Barberías";
    else if (hasAny(text, ["peluqueria"])) subcategory = "Peluquerías";
    else subcategory = "Salones de belleza";
  } else if (
    oldCategory === "Salud" ||
    hasAny(text, ["drogueria", "farmacia", "medicamento", "salud", "bienestar", "fuxion", "natural", "odontologia", "laboratorio", "optica", "gimnasio"])
  ) {
    primary = "Salud y bienestar";
    if (hasAny(text, ["drogueria", "farmacia", "medicamento"])) subcategory = "Droguerías y farmacias";
    else if (hasAny(text, ["fuxion", "natural"])) subcategory = "Productos naturales";
    else if (hasAny(text, ["gimnasio"])) subcategory = "Gimnasios";
    else subcategory = "Bienestar";
  } else if (
    oldCategory === "Transporte" ||
    hasAny(text, ["transporte", "taxi", "mototaxi", "mensajeria", "domicilio", "domicilios", "encomienda", "carga", "mudanza", "fluvial", "nechi caucasia"])
  ) {
    primary = "Transporte y movilidad";
    if (hasAny(text, ["encomienda", "mensajeria"])) subcategory = "Mensajería";
    else if (hasAny(text, ["carga"])) subcategory = "Transporte de carga";
    else if (hasAny(text, ["taxi"])) subcategory = "Taxi";
    else if (hasAny(text, ["mototaxi", "carro moto"])) subcategory = "Mototaxi";
    else subcategory = "Transporte especial";
  } else if (
    oldCategory === "Ferreteria" ||
    hasAny(text, ["ferreteria", "herramienta", "herramientas", "materiales de construccion", "pintura", "plomeria"])
  ) {
    primary = "Ferretería y construcción";
    subcategory = "Ferreterías";
  } else if (
    oldCategory === "Hogar y Tecnología" ||
    hasAny(text, ["celular", "celulares", "tecnologia", "tecnologico", "electrodomestico", "ventilador", "ventiladores", "aire acondicionado", "aires acondicionados", "lavadora", "nevera", "servicio tecnico", "reparacion", "mantenimiento", "muebles", "decoracion"])
  ) {
    if (hasAny(text, ["variedades", "miscelanea", "productos del hogar", "articulos escolares", "linea economica", "todo lo que buscas"])) {
      primary = "Tiendas y comercio";
      subcategory = "Variedades";
    } else {
      primary = "Hogar, tecnología y reparación";
      if (hasAny(text, ["celular", "celulares", "sim card", "esim"])) subcategory = "Celulares y accesorios";
      else if (hasAny(text, ["aire acondicionado", "aires acondicionados", "lavadora", "nevera", "electrodomestico"])) subcategory = "Técnicos de electrodomésticos";
      else if (hasAny(text, ["ventilador", "ventiladores"])) subcategory = "Reparación de ventiladores";
      else subcategory = "Electrodomésticos";
    }
  } else if (hasAny(text, ["tienda", "variedades", "miscelanea", "papeleria", "productos del hogar", "articulos escolares", "abarrotes", "supermercado", "granero"])) {
    primary = "Tiendas y comercio";
    if (hasAny(text, ["papeleria", "articulos escolares"])) subcategory = "Papelerías";
    else if (hasAny(text, ["productos del hogar"])) subcategory = "Productos para el hogar";
    else if (hasAny(text, ["tienda"])) subcategory = "Tiendas de barrio";
    else subcategory = "Variedades";
  } else if (hasAny(text, ["contable", "contabilidad", "financiera", "financiero"])) {
    primary = "Profesionales y servicios";
    subcategory = "Contadores";
  } else if (hasAny(text, ["fotografia", "foto", "publicidad", "medios", "producciones", "digital", "noticias"])) {
    primary = "Profesionales y servicios";
    subcategory = "Publicidad y medios";
  } else if (hasAny(text, ["educativa", "educacion", "clases", "estudios"])) {
    primary = "Profesionales y servicios";
    subcategory = "Educación";
  }

  if (hasAny(text, ["domicilio", "domicilios"])) tags.add("Domicilios");
  if (oldCategory === "Emprendimientos" || hasAny(text, ["emprendimiento", "emprender"])) tags.add("Emprendimiento local");
  if (hasAny(text, ["repuestos"])) tags.add("Repuestos");
  if (hasAny(text, ["papeleria", "articulos escolares"])) tags.add("Papelería");
  if (hasAny(text, ["variedades"])) tags.add("Variedades");
  if (hasAny(text, ["tienda virtual", "virtual"])) tags.add("Tienda virtual");
  if (hasAny(text, ["servicio tecnico", "mantenimiento", "reparacion"])) tags.add("Servicio técnico");

  return { primary, subcategory, tags: Array.from(tags) };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (!process.env.ADMIN_METRICS_PASSWORD || body.password !== process.env.ADMIN_METRICS_PASSWORD) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;

  if (!token || !baseId || !tableId || !FIELD_IDS.primary || !FIELD_IDS.subcategory || !FIELD_IDS.legacy || !FIELD_IDS.tags) {
    return NextResponse.json({ error: "Falta configuración de Airtable." }, { status: 503 });
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const records: Array<{ id: string; fields?: Record<string, unknown> }> = [];
  let offset = "";

  do {
    const params = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true" });
    if (offset) params.set("offset", offset);

    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`, {
      headers,
      cache: "no-store"
    });
    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "No se pudieron leer registros.", detail: result }, { status: response.status });
    }

    records.push(...(result.records || []));
    offset = result.offset || "";
  } while (offset);

  const preview = records.map((record) => {
    const fields = record.fields || {};
    const oldCategory = selectName(fields[FIELD_IDS.category]);
    const businessName = String(fields[FIELD_IDS.name] || "");
    const classification = classify(
      oldCategory,
      businessName,
      String(fields[FIELD_IDS.description] || ""),
      String(fields[FIELD_IDS.neighborhood] || "")
    );

    return { record, businessName, oldCategory, ...classification };
  });

  if (!body.dryRun) {
    const updates = preview.map((item) => {
      const fields: Record<string, string | string[]> = {
        [FIELD_IDS.primary]: item.primary,
        [FIELD_IDS.subcategory]: item.subcategory,
        [FIELD_IDS.legacy]: item.oldCategory,
        [FIELD_IDS.review]: "Sí"
      };

      if (item.tags.length > 0) fields[FIELD_IDS.tags] = item.tags;

      return { id: item.record.id, fields };
    });

    for (const group of chunk(updates, 10)) {
      const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ records: group, typecast: true })
      });
      const result = await response.json();

      if (!response.ok) {
        return NextResponse.json({ error: "No se pudo actualizar Airtable.", detail: result }, { status: response.status });
      }
    }
  }

  const byCategory = preview.reduce<Record<string, number>>((counts, item) => {
    counts[item.primary] = (counts[item.primary] || 0) + 1;
    return counts;
  }, {});

  return NextResponse.json({
    ok: true,
    dryRun: Boolean(body.dryRun),
    updated: body.dryRun ? 0 : preview.length,
    total: preview.length,
    byCategory,
    preview: preview.map((item) => ({
      negocio: item.businessName,
      anterior: item.oldCategory,
      nueva: item.primary,
      subcategoria: item.subcategory,
      etiquetas: item.tags
    }))
  });
}
