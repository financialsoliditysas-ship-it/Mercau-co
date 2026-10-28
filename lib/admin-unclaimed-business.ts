import { randomBytes } from 'crypto';
import { directoryCategories, directoryMunicipalities } from '@/data/directory';
import { loadDirectoryBusinesses } from '@/lib/airtable-directory';

const FIELD_IDS = {
  businessName: 'fldZAuId3Z7tmNg1y', ownerName: 'fldnTNuAH1PTyItul', whatsapp: 'fldCe1uBzTZhUZQMj',
  category: 'fldyp3od5rTBa74il', municipality: 'fldAziT6B2rW6HcyT', neighborhood: 'fldzy7nwjlebys4w0',
  description: 'fldlAXHZlQY2PLtvX', hours: 'fldGg2RLescrYR2Z6', deliveries: 'fldmIVPP97MTqrUfZ',
  status: 'fldyyLYvoyMdiK13C', source: 'fldOZnz4JnwxkLTYA', notes: 'fldrZ1LUWRcvKklVQ',
  updateToken: 'fldSXi5dNYP1WaWKq', updateLink: 'fldINHrjgKw2AATkZ'
};

const OPTIONAL_FIELDS = {
  primaryCategory: process.env.AIRTABLE_CATEGORIA_PRINCIPAL_FIELD_ID || '',
  subcategory: process.env.AIRTABLE_SUBCATEGORIA_FIELD_ID || '',
  legacyCategory: process.env.AIRTABLE_CATEGORIA_ANTERIOR_FIELD_ID || ''
};

const clean = (value: unknown, max = 240) => String(value || '').trim().slice(0, max);
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export async function createUnclaimedBusiness(input: Record<string, unknown>, origin: string) {
  const airtableToken = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_NEGOCIOS_TABLE_ID;
  if (!airtableToken || !baseId || !tableId) throw new Error('Airtable no está configurado en este entorno.');

  const name = clean(input.businessName, 100);
  const category = clean(input.category, 100);
  const municipality = clean(input.municipality, 80);
  const subcategory = clean(input.subcategory, 100);
  const categoryConfig = directoryCategories.find(item => item.name === category);
  if (!name || !categoryConfig || !directoryMunicipalities.includes(municipality as never)) {
    throw new Error('Completa el nombre, la categoría y el municipio con opciones válidas.');
  }
  if (subcategory && !categoryConfig.subcategories.includes(subcategory)) throw new Error('La subcategoría no corresponde a la categoría.');

  const businesses = await loadDirectoryBusinesses();
  const duplicate = businesses.some(item => normalized(item.name) === normalized(name) && item.municipality === municipality);
  if (duplicate) throw new Error('Ya existe una ficha publicada con ese nombre en el municipio. Revísala antes de crear otra.');

  const privateToken = randomBytes(24).toString('base64url');
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || origin || 'https://www.mercau.co').replace(/\/$/, '');
  const claimUrl = `${appOrigin}/actualizar/${privateToken}`;
  const fields: Record<string, string> = {
    [FIELD_IDS.businessName]: name,
    [FIELD_IDS.category]: category,
    [FIELD_IDS.municipality]: municipality,
    [FIELD_IDS.status]: 'Publicado',
    [FIELD_IDS.source]: 'Administración Mercáu',
    [FIELD_IDS.notes]: 'Ficha creada por Mercáu sin propietario. Pendiente de reclamación mediante enlace privado.',
    [FIELD_IDS.updateToken]: privateToken,
    [FIELD_IDS.updateLink]: claimUrl
  };
  const optional: Array<[string, string]> = [
    [FIELD_IDS.ownerName, clean(input.ownerName, 100)], [FIELD_IDS.whatsapp, clean(input.whatsapp, 32).replace(/[^\d+]/g, '')],
    [FIELD_IDS.neighborhood, clean(input.neighborhood, 120)], [FIELD_IDS.description, clean(input.description, 700)],
    [FIELD_IDS.hours, clean(input.hours, 100) || 'Consultar'], [FIELD_IDS.deliveries, clean(input.deliveries, 20) || 'Consultar'],
    [OPTIONAL_FIELDS.primaryCategory, category], [OPTIONAL_FIELDS.subcategory, subcategory], [OPTIONAL_FIELDS.legacyCategory, category]
  ];
  for (const [fieldId, value] of optional) if (fieldId && value) fields[fieldId] = value;

  const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: 'POST', headers: { Authorization: `Bearer ${airtableToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'No se pudo crear la ficha en Airtable.');
  return { id: String(result.id), name, claimUrl };
}
