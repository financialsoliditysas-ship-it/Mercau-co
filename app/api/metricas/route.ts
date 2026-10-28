import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NEGOCIOS_FIELD_IDS = {
  status: "fldyyLYvoyMdiK13C"
};

const METRICAS_TABLE_ID = "tblKElWBMPPR7t0Z7";

const METRICAS_FIELD_IDS = {
  event: "fld7nBSFtJaVA2tI6",
  type: "fldE62qdQetGOjfZB",
  business: "fldz23iwnczsO1rvW",
  businessName: "fldJnNCMeDUtpqFTM",
  category: "fldOzN64VpDnoD1rY",
  search: "fldG60GRNjS5DMezD",
  path: "fldI467sEiBGYcFmg",
  date: "fldg1sAzI3lOd80uk",
  notes: "fldrOPMjQaj8yeo87"
};

const allowedTypes = new Set([
  "Visita",
  "Clic WhatsApp",
  "Categoria",
  "Busqueda",
  "Inscripcion enviada",
  "Pagina instalacion visitada",
  "Instalacion iniciada",
  "Guia iOS abierta",
  "Guia Android abierta",
  "Instalacion Android aceptada",
  "Instalacion Android confirmada",
  "App instalada activa",
  "Registro usuario iniciado",
  "Cuenta confirmada",
  "Menu visto",
  "Producto visto",
  "Producto agregado",
  "Carrito iniciado",
  "Pedido revisado",
  "Pedido confirmado",
  "business_card_viewed",
  "business_card_whatsapp_clicked",
  "business_card_favorite_added",
  "business_card_favorite_removed",
  "menu_opened",
  "catalog_opened",
  "business_info_opened",
  "directory_filter_used",
  "directory_search_performed"
]);

function cleanText(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function selectName(value: unknown) {
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }

  return String(value || "");
}

function config() {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const negociosTableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  const metricasTableId = process.env.AIRTABLE_METRICAS_TABLE_ID || METRICAS_TABLE_ID;

  if (!token || !baseId || !negociosTableId) return null;

  return { token, baseId, negociosTableId, metricasTableId };
}

async function airtableList(params: {
  token: string;
  baseId: string;
  tableId: string;
  query: URLSearchParams;
}) {
  const response = await fetch(
    `https://api.airtable.com/v0/${params.baseId}/${params.tableId}?${params.query.toString()}`,
    {
      headers: { Authorization: `Bearer ${params.token}` },
      cache: "no-store"
    }
  );

  const result = await response.json();
  return { response, result };
}

export async function GET() {
  const currentConfig = config();

  if (!currentConfig) {
    return NextResponse.json(
      { error: "Airtable no esta configurado en este entorno." },
      { status: 503 }
    );
  }

  const negociosQuery = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true"
  });
  const metricasQuery = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true"
  });

  const [negociosResult, metricasResult] = await Promise.all([
    airtableList({
      token: currentConfig.token,
      baseId: currentConfig.baseId,
      tableId: currentConfig.negociosTableId,
      query: negociosQuery
    }),
    airtableList({
      token: currentConfig.token,
      baseId: currentConfig.baseId,
      tableId: currentConfig.metricasTableId,
      query: metricasQuery
    })
  ]);

  if (!negociosResult.response.ok) {
    return NextResponse.json(
      { error: "No se pudieron cargar los negocios." },
      { status: negociosResult.response.status }
    );
  }

  const businesses = negociosResult.result.records || [];
  const events = metricasResult.response.ok ? metricasResult.result.records || [] : [];
  const categoryCounts: Record<string, number> = {};

  events.forEach((record: { fields?: Record<string, unknown> }) => {
    const fields = record.fields || {};
    const type = selectName(fields[METRICAS_FIELD_IDS.type]);
    const category = cleanText(fields[METRICAS_FIELD_IDS.category], 80);

    if (type === "Categoria" && category) {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  });

  const summary = businesses.reduce(
    (
      acc: { inscritos: number; aprobados: number },
      record: { fields?: Record<string, unknown> }
    ) => {
      const status = selectName((record.fields || {})[NEGOCIOS_FIELD_IDS.status]);
      acc.inscritos += 1;
      if (status === "Verificado" || status === "Destacado") acc.aprobados += 1;
      return acc;
    },
    { inscritos: 0, aprobados: 0 }
  );

  return NextResponse.json({
    visitas: events.filter(
      (record: { fields?: Record<string, unknown> }) =>
        selectName((record.fields || {})[METRICAS_FIELD_IDS.type]) === "Visita"
    ).length,
    clicsWhatsApp: events.filter(
      (record: { fields?: Record<string, unknown> }) =>
        selectName((record.fields || {})[METRICAS_FIELD_IDS.type]) === "Clic WhatsApp"
    ).length,
    categoriasMasBuscadas: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count })),
    negociosInscritos: summary.inscritos,
    negociosAprobados: summary.aprobados
  });
}

export async function POST(request: NextRequest) {
  const currentConfig = config();

  if (!currentConfig) {
    return NextResponse.json(
      { error: "Airtable no esta configurado en este entorno." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const type = cleanText(body.type, 80);

  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "Tipo de evento invalido." }, { status: 400 });
  }

  const businessId = cleanText(body.businessId, 32);
  const fields: Record<string, string | string[]> = {
    [METRICAS_FIELD_IDS.event]: `${type} - ${new Date().toISOString()}`,
    [METRICAS_FIELD_IDS.type]: type,
    [METRICAS_FIELD_IDS.businessName]: cleanText(body.businessName, 120),
    [METRICAS_FIELD_IDS.category]: cleanText(body.category, 80),
    [METRICAS_FIELD_IDS.search]: cleanText(body.search, 120),
    [METRICAS_FIELD_IDS.path]: cleanText(body.path, 180),
    [METRICAS_FIELD_IDS.date]: new Date().toISOString(),
    [METRICAS_FIELD_IDS.notes]: cleanText(body.notes, 300)
  };

  if (/^rec[A-Za-z0-9]{14}$/.test(businessId)) {
    fields[METRICAS_FIELD_IDS.business] = [businessId];
  }

  Object.keys(fields).forEach((key) => {
    const value = fields[key];
    if (!value || (Array.isArray(value) && value.length === 0)) delete fields[key];
  });

  const response = await fetch(
    `https://api.airtable.com/v0/${currentConfig.baseId}/${currentConfig.metricasTableId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentConfig.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields, typecast: true })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "No se pudo guardar la metrica.",
        detail: result?.error?.message || result?.error || "Error desconocido"
      },
      { status: response.status }
    );
  }

  return NextResponse.json({ ok: true, recordId: result.id }, { status: 201 });
}
