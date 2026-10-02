import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FIELD_IDS = {
  ownerName: "fldnTNuAH1PTyItul",
  updateToken: "fldSXi5dNYP1WaWKq",
  updateLink: "fldINHrjgKw2AATkZ",
  message: "fldjadmXzJbaMVQxH"
};

function cleanText(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function config() {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  const adminPassword = process.env.ADMIN_METRICS_PASSWORD;

  if (!token || !baseId || !tableId || !adminPassword) return null;

  return { token, baseId, tableId, adminPassword };
}

async function airtableJson(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  const currentConfig = config();

  if (!currentConfig) {
    return NextResponse.json(
      { error: "Migracion no configurada. Falta Airtable o ADMIN_METRICS_PASSWORD." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = cleanText(body.password, 120);

  if (password !== currentConfig.adminPassword) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }

  const records: Array<{ id: string; fields?: Record<string, unknown> }> = [];
  let offset = "";

  do {
    const params = new URLSearchParams({
      pageSize: "100",
      returnFieldsByFieldId: "true"
    });
    if (offset) params.set("offset", offset);

    const { response, result } = await airtableJson(
      `https://api.airtable.com/v0/${currentConfig.baseId}/${currentConfig.tableId}?${params.toString()}`,
      currentConfig.token
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "No se pudieron leer los negocios.",
          detail: result?.error?.message || result?.error || "Error desconocido"
        },
        { status: response.status }
      );
    }

    records.push(...(result.records || []));
    offset = result.offset || "";
  } while (offset);

  const updates = records
    .map((record) => {
      const updateToken = cleanText(record.fields?.[FIELD_IDS.updateToken], 100);
      if (!updateToken) return null;

      const updateLink = `https://www.mercau.co/actualizar/${updateToken}`;
      const currentLink = cleanText(record.fields?.[FIELD_IDS.updateLink], 300);

      if (currentLink === updateLink) return null;

      return {
        id: record.id,
        fields: {
          [FIELD_IDS.updateLink]: updateLink
        }
      };
    })
    .filter(Boolean) as Array<{ id: string; fields: Record<string, string> }>;

  let updatedLinks = 0;

  for (const batch of chunk(updates, 10)) {
    const { response, result } = await airtableJson(
      `https://api.airtable.com/v0/${currentConfig.baseId}/${currentConfig.tableId}`,
      currentConfig.token,
      {
        method: "PATCH",
        body: JSON.stringify({ records: batch, typecast: true })
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "No se pudieron actualizar todos los links.",
          updatedLinks,
          detail: result?.error?.message || result?.error || "Error desconocido"
        },
        { status: response.status }
      );
    }

    updatedLinks += batch.length;
  }

  const messageFormula =
    '"Hola, " & IF({fldnTNuAH1PTyItul}, {fldnTNuAH1PTyItul} & ", ", "") & "tu negocio ya quedó registrado en Mercáu, el Directorio Digital del Bajo Cauca.\\n\\nYa puedes activar tu acceso privado para administrar tu ficha y solicitar cambios cuando lo necesites:\\n\\n" & {fldINHrjgKw2AATkZ} & "\\n\\nNo compartas este enlace con otras personas. Cualquier cambio que envíes será revisado antes de publicarse en el directorio."';

  const formulaUpdate = await airtableJson(
    `https://api.airtable.com/v0/meta/bases/${currentConfig.baseId}/tables/${currentConfig.tableId}/fields/${FIELD_IDS.message}`,
    currentConfig.token,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: "Mensaje para enviar link",
        description: "Mensaje listo para copiar y enviar al negocio con su link privado de actualización.",
        type: "formula",
        options: {
          formula: messageFormula
        }
      })
    }
  );

  return NextResponse.json({
    ok: true,
    totalRecords: records.length,
    linksToUpdate: updates.length,
    updatedLinks,
    messageFormulaUpdated: formulaUpdate.response.ok,
    messageFormulaDetail: formulaUpdate.response.ok
      ? "Formula actualizada."
      : formulaUpdate.result?.error?.message || formulaUpdate.result?.error || "No se pudo actualizar la formula."
  });
}
