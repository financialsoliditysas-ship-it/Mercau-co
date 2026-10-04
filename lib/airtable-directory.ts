import { DirectoryBusiness, toDirectoryCategory } from "@/data/directory";

const FIELD_IDS = {
  businessName: "fldZAuId3Z7tmNg1y",
  whatsapp: "fldCe1uBzTZhUZQMj",
  category: "fldyp3od5rTBa74il",
  municipality: "fldAziT6B2rW6HcyT",
  neighborhood: "fldzy7nwjlebys4w0",
  description: "fldlAXHZlQY2PLtvX",
  hours: "fldGg2RLescrYR2Z6",
  deliveries: "fldmIVPP97MTqrUfZ",
  instagram: "fldkT6oBXKONCkak6",
  facebook: "fldC9M9vXoMFhdqUK",
  mapsUrl: "fld79aU7BULwF5b65",
  status: "fldyyLYvoyMdiK13C",
  source: "fldOZnz4JnwxkLTYA"
};

const UPDATE_TABLE_ID = "tblZFp7SvVV7MuBWD";

const UPDATE_FIELD_IDS = {
  business: "fldRn5vmrSMFc4xAb",
  status: "fldxcaBA32ryuBUya",
  requestedChanges: "fldwaqSezmV71z0d7",
  newDescription: "fldvfa8cy8ZV4xquD",
  newWhatsapp: "fldjY6CEsYHyJnBbQ",
  newNeighborhood: "fld1jU61ntd250csD",
  newHours: "fldMsiMikQRpKW6YY",
  deliveries: "fldxITFwlegSY2hFp",
  instagram: "fldb37RSOmv5op09a",
  facebook: "fldyyeqCumnxqjG3x",
  mapsUrl: "fldDn2C4jBQQjD3yG"
};

const approvedStatuses = new Set(["Verificado", "Destacado"]);

function publicStatus(value: string): DirectoryBusiness["status"] | null {
  if (value === "Verificado" || value === "Destacado") return value;
  return null;
}

function selectName(value: unknown) {
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }

  return String(value || "");
}

function text(fields: Record<string, unknown>, fieldId: string, fallback = "") {
  return String(fields[fieldId] || fallback).trim();
}

function linkedRecordId(value: unknown) {
  if (!Array.isArray(value)) return "";
  const first = value[0];

  if (typeof first === "string") return first;
  if (typeof first === "object" && first && "id" in first) {
    return String((first as { id?: unknown }).id || "");
  }

  return "";
}

function publicCategory(value: string): DirectoryBusiness["category"] {
  return toDirectoryCategory(value);
}

function publicMunicipality(value: string): DirectoryBusiness["municipality"] {
  const municipality = value === "Bagre" ? "El Bagre" : value;
  return municipality as DirectoryBusiness["municipality"];
}

async function loadAppliedUpdates(config: {
  token: string;
  baseId: string;
  updateTableId: string;
}) {
  const params = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true",
    filterByFormula: "{Estado} = 'Aplicada'"
  });

  const response = await fetch(
    `https://api.airtable.com/v0/${config.baseId}/${config.updateTableId}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`
      },
      cache: "no-store"
    }
  );
  const result = await response.json();

  if (!response.ok) return new Map<string, Record<string, unknown>>();

  const updates = new Map<string, Record<string, unknown>>();

  (result.records || []).forEach(
    (record: { createdTime?: string; fields?: Record<string, unknown> }) => {
      const fields = record.fields || {};
      const businessId = linkedRecordId(fields[UPDATE_FIELD_IDS.business]);
      if (!businessId) return;

      const current = updates.get(businessId) as
        | (Record<string, unknown> & { createdTime?: string })
        | undefined;

      if (!current || String(record.createdTime || "") > String(current.createdTime || "")) {
        updates.set(businessId, { ...fields, createdTime: record.createdTime });
      }
    }
  );

  return updates;
}

export async function loadDirectoryBusinesses() {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  const updateTableId =
    process.env.AIRTABLE_ACTUALIZACIONES_TABLE_ID || UPDATE_TABLE_ID;

  if (!token || !baseId || !tableId) {
    throw new Error("Airtable no esta configurado en este entorno.");
  }

  const params = new URLSearchParams({
    pageSize: "100",
    returnFieldsByFieldId: "true",
    filterByFormula:
      "OR({Estado} = 'Verificado', {Estado} = 'Destacado')"
  });

  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    }
  );

  const result = await response.json();

  if (!response.ok) {
    const detail = result?.error?.message || result?.error || "Error desconocido";
    throw new Error(`No se pudo cargar el directorio desde Airtable. ${detail}`);
  }

  const appliedUpdates = await loadAppliedUpdates({ token, baseId, updateTableId });

  return ((result.records || []) as Array<{ id: string; fields?: Record<string, unknown> }>)
    .map((record): DirectoryBusiness | null => {
      const fields = record.fields || {};
      const appliedUpdate = appliedUpdates.get(record.id) || {};
      const status = publicStatus(selectName(fields[FIELD_IDS.status]));
      const legacyCategory = selectName(fields[FIELD_IDS.category]);
      const category = publicCategory(legacyCategory);

      if (!status || !approvedStatuses.has(status)) return null;

      return {
        id: record.id,
        name: text(fields, FIELD_IDS.businessName, "Negocio sin nombre"),
        category,
        legacyCategory,
        secondaryCategories: [],
        subcategory: "",
        tags: legacyCategory === "Emprendimientos" ? ["Emprendimiento local"] : [],
        municipality: publicMunicipality(text(fields, FIELD_IDS.municipality, "Nechí")),
        neighborhood:
          text(appliedUpdate, UPDATE_FIELD_IDS.newNeighborhood) ||
          text(fields, FIELD_IDS.neighborhood, "Nechí"),
        description:
          text(appliedUpdate, UPDATE_FIELD_IDS.newDescription) ||
          text(appliedUpdate, UPDATE_FIELD_IDS.requestedChanges) ||
          text(
            fields,
            FIELD_IDS.description,
            "Negocio local inscrito en el directorio."
          ),
        hours:
          text(appliedUpdate, UPDATE_FIELD_IDS.newHours) ||
          text(fields, FIELD_IDS.hours, "Consultar por WhatsApp"),
        whatsapp:
          text(appliedUpdate, UPDATE_FIELD_IDS.newWhatsapp) ||
          text(fields, FIELD_IDS.whatsapp),
        deliveries:
          selectName(appliedUpdate[UPDATE_FIELD_IDS.deliveries]) ||
          selectName(fields[FIELD_IDS.deliveries]) ||
          "Consultar",
        instagram:
          text(appliedUpdate, UPDATE_FIELD_IDS.instagram) ||
          text(fields, FIELD_IDS.instagram),
        facebook:
          text(appliedUpdate, UPDATE_FIELD_IDS.facebook) ||
          text(fields, FIELD_IDS.facebook),
        mapsUrl:
          text(appliedUpdate, UPDATE_FIELD_IDS.mapsUrl) ||
          text(fields, FIELD_IDS.mapsUrl),
        status,
        source: selectName(fields[FIELD_IDS.source]) || "Airtable"
      } satisfies DirectoryBusiness;
    })
    .filter((business): business is DirectoryBusiness => Boolean(business));
}

export async function loadDirectoryBusiness(id: string) {
  const businesses = await loadDirectoryBusinesses();
  return businesses.find((business) => business.id === id) || null;
}
