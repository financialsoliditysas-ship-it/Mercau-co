import fs from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const file = process.argv[2];
const apply = process.argv.includes('--apply');

if (!file) {
  console.error('Uso: node scripts/import-directory-to-supabase.mjs <export.json> [--apply]');
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(source)) throw new Error('La exportacion debe ser un arreglo JSON.');

const required = ['id', 'name', 'category', 'municipality', 'status'];
const allowedStatuses = new Set(['Borrador', 'Verificado', 'Destacado', 'Publicado', 'Archivado']);
const businesses = source.map((record, index) => {
  for (const field of required) {
    if (!String(record?.[field] ?? '').trim()) throw new Error(`Registro ${index + 1}: falta ${field}.`);
  }
  if (!allowedStatuses.has(record.status)) throw new Error(`Registro ${index + 1}: estado no permitido ${record.status}.`);
  return {
    id: String(record.id).trim(),
    airtable_record_id: String(record.id).trim(),
    name: String(record.name).trim(),
    category: String(record.category || '').trim(),
    municipality: String(record.municipality || '').trim(),
    neighborhood: String(record.neighborhood || '').trim(),
    description: String(record.description || '').trim(),
    whatsapp: String(record.whatsapp || '').trim(),
    instagram: String(record.instagram || '').trim(),
    facebook: String(record.facebook || '').trim(),
    maps_url: String(record.mapsUrl || '').trim(),
    delivery_notes: String(record.deliveries || '').trim(),
    status: record.status,
    source: 'airtable-import'
  };
});

const duplicateIds = businesses.map(row => row.id).filter((id, i, all) => all.indexOf(id) !== i);
if (duplicateIds.length) throw new Error(`IDs duplicados: ${[...new Set(duplicateIds)].join(', ')}`);

const hours = source.map(record => ({
  business_id: String(record.id).trim(),
  schedule: { display: String(record.hours || '').trim() },
  timezone: 'America/Bogota'
}));

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', businesses: businesses.length, hours: hours.length }, null, 2));
if (!apply) {
  console.log('Dry-run completado. No se escribio en Supabase.');
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
for (let start = 0; start < businesses.length; start += 100) {
  const { error } = await db.from('directory_businesses').upsert(businesses.slice(start, start + 100), { onConflict: 'id' });
  if (error) throw new Error(`Importacion de negocios: ${error.message}`);
}
for (let start = 0; start < hours.length; start += 100) {
  const { error } = await db.from('directory_business_hours').upsert(hours.slice(start, start + 100), { onConflict: 'business_id' });
  if (error) throw new Error(`Importacion de horarios: ${error.message}`);
}
console.log('Importacion de fichas y horarios completada. Las imagenes requieren una etapa separada hacia Supabase Storage.');
