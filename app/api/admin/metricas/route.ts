import { NextRequest, NextResponse } from "next/server";
import { toDirectoryCategory } from "@/data/directory";

export const dynamic = "force-dynamic";

const NEGOCIOS_FIELD_IDS = {
  businessName: "fldZAuId3Z7tmNg1y",
  status: "fldyyLYvoyMdiK13C",
  category: "fldyp3od5rTBa74il"
};

const METRICAS_TABLE_ID = "tblKElWBMPPR7t0Z7";

const METRICAS_FIELD_IDS = {
  type: "fldE62qdQetGOjfZB",
  businessName: "fldJnNCMeDUtpqFTM",
  category: "fldOzN64VpDnoD1rY",
  search: "fldG60GRNjS5DMezD",
  path: "fldI467sEiBGYcFmg",
  date: "fldg1sAzI3lOd80uk",
  notes: "fldrOPMjQaj8yeo87"
};

function selectName(value: unknown) {
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }

  return String(value || "");
}

function cleanText(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function publicCategory(value: string) {
  return toDirectoryCategory(value);
}

function config() {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const negociosTableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  const metricasTableId = process.env.AIRTABLE_METRICAS_TABLE_ID || METRICAS_TABLE_ID;
  const adminPassword = process.env.ADMIN_METRICS_PASSWORD;

  if (!token || !baseId || !negociosTableId || !adminPassword) return null;

  return { token, baseId, negociosTableId, metricasTableId, adminPassword };
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

function increment(map: Record<string, number>, key: string) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

export async function POST(request: NextRequest) {
  const currentConfig = config();

  if (!currentConfig) {
    return NextResponse.json(
      { error: "Panel no configurado. Falta ADMIN_METRICS_PASSWORD o Airtable." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = cleanText(body.password, 120);

  if (password !== currentConfig.adminPassword) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
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
  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const searchCounts: Record<string, number> = {};
  const whatsappByBusiness: Record<string, number> = {};

  businesses.forEach((record: { fields?: Record<string, unknown> }) => {
    const fields = record.fields || {};
    increment(statusCounts, selectName(fields[NEGOCIOS_FIELD_IDS.status]) || "Sin estado");
  });

  events.forEach((record: { createdTime?: string; fields?: Record<string, unknown> }) => {
    const fields = record.fields || {};
    const type = selectName(fields[METRICAS_FIELD_IDS.type]);
    const category = publicCategory(cleanText(fields[METRICAS_FIELD_IDS.category], 80));
    const search = cleanText(fields[METRICAS_FIELD_IDS.search], 120);
    const businessName = cleanText(fields[METRICAS_FIELD_IDS.businessName], 120);

    if (type === "Categoria") increment(categoryCounts, category);
    if (search) increment(searchCounts, search.toLowerCase());
    if (type === "Clic WhatsApp") increment(whatsappByBusiness, businessName || "Sin negocio");
  });

  const summary = {
    visitas: events.filter(
      (record: { fields?: Record<string, unknown> }) =>
        selectName((record.fields || {})[METRICAS_FIELD_IDS.type]) === "Visita"
    ).length,
    clicsWhatsApp: events.filter(
      (record: { fields?: Record<string, unknown> }) =>
        selectName((record.fields || {})[METRICAS_FIELD_IDS.type]) === "Clic WhatsApp"
    ).length,
    negociosInscritos: businesses.length,
    negociosAprobados: businesses.filter((record: { fields?: Record<string, unknown> }) => {
      const status = selectName((record.fields || {})[NEGOCIOS_FIELD_IDS.status]);
      return status === "Verificado" || status === "Destacado";
    }).length
  };

  const top = (map: Record<string, number>) =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));

  return NextResponse.json({
    summary,
    statusCounts: top(statusCounts),
    categoriasMasBuscadas: top(categoryCounts),
    busquedas: top(searchCounts),
    whatsappPorNegocio: top(whatsappByBusiness),
    ultimosEventos: events.slice(0, 12).map(
      (record: { createdTime?: string; fields?: Record<string, unknown> }) => {
        const fields = record.fields || {};
        return {
          tipo: selectName(fields[METRICAS_FIELD_IDS.type]),
          negocio: cleanText(fields[METRICAS_FIELD_IDS.businessName], 120),
          categoria: publicCategory(cleanText(fields[METRICAS_FIELD_IDS.category], 80)),
          busqueda: cleanText(fields[METRICAS_FIELD_IDS.search], 120),
          ruta: cleanText(fields[METRICAS_FIELD_IDS.path], 180),
          fecha: cleanText(fields[METRICAS_FIELD_IDS.date], 80) || record.createdTime || "",
          notas: cleanText(fields[METRICAS_FIELD_IDS.notes], 180)
        };
      }
    )
  });
}
