import { DirectoryBusiness, toDirectoryCategory } from "@/data/directory";
import { cache } from 'react';
import { photoDetails, photoFieldId } from './business-photo';
import { isPilotBusinessNote } from './pilot-directory-data';

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

const OPTIONAL_CATEGORY_FIELD_IDS = {
  primaryCategory: process.env.AIRTABLE_CATEGORIA_PRINCIPAL_FIELD_ID || "",
  subcategory: process.env.AIRTABLE_SUBCATEGORIA_FIELD_ID || "",
  secondaryCategories: process.env.AIRTABLE_CATEGORIAS_SECUNDARIAS_FIELD_ID || "",
  tags: process.env.AIRTABLE_ETIQUETAS_FIELD_ID || "",
  legacyCategory: process.env.AIRTABLE_CATEGORIA_ANTERIOR_FIELD_ID || ""
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
  mapsUrl: "fldDn2C4jBQQjD3yG",
  internalComment: "fld5XhR6GjiKu6fF3"
};

const approvedStatuses = new Set(["Verificado", "Destacado", "Publicado"]);

function publicStatus(value: string): DirectoryBusiness["status"] | null {
  if (value === "Verificado" || value === "Destacado" || value === "Publicado") return value;
  return null;
}

function selectName(value: unknown) {
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }

  return String(value || "");
}

function text(fields: Record<string, unknown>, fieldId: string, fallback = "") {
  if (!fieldId) return fallback;
  return String(fields[fieldId] || fallback).trim();
}

function multiSelectNames(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "object" && item && "name" in item) {
        return String((item as { name?: unknown }).name || "").trim();
      }

      return String(item || "").trim();
    })
    .filter(Boolean);
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

  const updates = new Map<string, Record<string, unknown>>();
  let offset: string | undefined;
  do {
  if (offset) params.set('offset',offset);

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

  offset = typeof result.offset === 'string' ? result.offset : undefined;
  } while (offset);

  return updates;
}

async function readDirectoryBusinesses() {
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
      "OR({Estado} = 'Verificado', {Estado} = 'Destacado', {Estado} = 'Publicado')"
  });

  const [response,appliedUpdates] = await Promise.all([fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    }
  ),loadAppliedUpdates({ token, baseId, updateTableId })]);

  const result = await response.json();

  if (!response.ok) {
    const detail = result?.error?.message || result?.error || "Error desconocido";
    throw new Error(`No se pudo cargar el directorio desde Airtable. ${detail}`);
  }

  return ((result.records || []) as Array<{ id: string; fields?: Record<string, unknown> }>)
    .map((record): DirectoryBusiness | null => {
      const fields = record.fields || {};
      const appliedUpdate = appliedUpdates.get(record.id) || {};
      let direct: Record<string, string | string[]> | null = null;
      try {
        const note = JSON.parse(String(appliedUpdate[UPDATE_FIELD_IDS.internalComment] || ''));
        if (note.kind === 'owner_edit' && note.business_id === record.id && note.after && typeof note.after === 'object') direct = note.after;
      } catch { /* Legacy requests have plain-text notes. */ }
      const status = publicStatus(selectName(fields[FIELD_IDS.status]));
      const originalCategory = selectName(fields[FIELD_IDS.category]);
      const storedLegacyCategory =
        text(fields, OPTIONAL_CATEGORY_FIELD_IDS.legacyCategory) || originalCategory;
      const category = publicCategory(
        selectName(fields[OPTIONAL_CATEGORY_FIELD_IDS.primaryCategory]) || originalCategory
      );
      const secondaryCategories = multiSelectNames(
        fields[OPTIONAL_CATEGORY_FIELD_IDS.secondaryCategories]
      ).map(publicCategory);
      const storedTags = multiSelectNames(fields[OPTIONAL_CATEGORY_FIELD_IDS.tags]);
      const tags =
        storedTags.length > 0
          ? storedTags
          : storedLegacyCategory === "Emprendimientos"
            ? ["Emprendimiento local"]
            : [];

      if (!status || !approvedStatuses.has(status)) return null;
      const pilotRestaurant=isPilotBusinessNote(fields.fldrZ1LUWRcvKklVQ) ? 'restaurante-mercado' as const : undefined;
      const photo=photoDetails(record.id,fields[photoFieldId]);

      return {
        ...photo,
        photoUrl:photo.photoUrl || (pilotRestaurant ? '/demo-burger.jpg' : undefined),
        pilotRestaurant,
        id: record.id,
        name: typeof direct?.name==='string'?direct.name:text(fields, FIELD_IDS.businessName, "Negocio sin nombre"),
        category:typeof direct?.category==='string'?publicCategory(direct.category):category,
        legacyCategory: storedLegacyCategory,
        secondaryCategories:Array.isArray(direct?.secondaryCategories)?direct.secondaryCategories.map(publicCategory):secondaryCategories,
        subcategory: typeof direct?.subcategory==='string'?direct.subcategory:selectName(fields[OPTIONAL_CATEGORY_FIELD_IDS.subcategory]),
        tags:Array.isArray(direct?.tags)?direct.tags:tags,
        municipality: publicMunicipality(typeof direct?.municipality==='string'?direct.municipality:text(fields, FIELD_IDS.municipality, "Nechí")),
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
        hours: direct ? String(direct.hours || '') :
          text(appliedUpdate, UPDATE_FIELD_IDS.newHours) ||
          text(fields, FIELD_IDS.hours, "Consultar por WhatsApp"),
        whatsapp:typeof direct?.whatsapp==='string'?direct.whatsapp:
          text(appliedUpdate, UPDATE_FIELD_IDS.newWhatsapp) ||
          text(fields, FIELD_IDS.whatsapp),
        deliveries:
          selectName(appliedUpdate[UPDATE_FIELD_IDS.deliveries]) ||
          selectName(fields[FIELD_IDS.deliveries]) ||
          "Consultar",
        instagram: direct ? String(direct.instagram || '') :
          text(appliedUpdate, UPDATE_FIELD_IDS.instagram) ||
          text(fields, FIELD_IDS.instagram),
        facebook: direct ? String(direct.facebook || '') :
          text(appliedUpdate, UPDATE_FIELD_IDS.facebook) ||
          text(fields, FIELD_IDS.facebook),
        mapsUrl: direct ? String(direct.mapsUrl || '') :
          text(appliedUpdate, UPDATE_FIELD_IDS.mapsUrl) ||
          text(fields, FIELD_IDS.mapsUrl),
        status,
        source: selectName(fields[FIELD_IDS.source]) || "Airtable"
      } satisfies DirectoryBusiness;
    })
    .filter((business): business is DirectoryBusiness => Boolean(business));
}

// RSC supports request-local cache; standalone React/route tests retain the original reader.
export const loadDirectoryBusinesses=typeof cache==='function'?cache(readDirectoryBusinesses):readDirectoryBusinesses;

export async function loadDirectoryBusiness(id: string) {
  const businesses = await loadDirectoryBusinesses();
  return businesses.find((business) => business.id === id) || null;
}
