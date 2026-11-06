import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const mediaDir = process.argv[2] || 'migration-assets/business-photos';
const apply = process.argv.includes('--apply');
const files = fs.existsSync(mediaDir)
  ? fs.readdirSync(mediaDir).filter(name => /^rec[A-Za-z0-9]{14}\.(jpg|jpeg|png|webp)$/i.test(name)).sort()
  : [];

if (!files.length) throw new Error(`No se encontraron fotos migrables en ${mediaDir}.`);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', files: files.length }, null, 2));
if (!apply) {
  console.log('Dry-run completado. No se subieron archivos ni se escribieron relaciones.');
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = 'business-catalog';
for (const name of files) {
  const businessId = path.parse(name).name;
  const extension = path.extname(name).toLowerCase();
  const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
  const storagePath = `business-media/${businessId}/logo${extension}`;
  const body = fs.readFileSync(path.join(mediaDir, name));
  const upload = await db.storage.from(bucket).upload(storagePath, body, { contentType, upsert: true, cacheControl: '3600' });
  if (upload.error) throw new Error(`${businessId}: upload: ${upload.error.message}`);
  const relation = await db.from('directory_business_media').upsert({
    business_id: businessId,
    kind: 'logo',
    storage_path: storagePath,
    alt_text: 'Logo del negocio',
    position: 0
  }, { onConflict: 'business_id,storage_path' });
  if (relation.error) throw new Error(`${businessId}: relation: ${relation.error.message}`);
  console.log(`${businessId}: ok`);
}
console.log('Carga de medios completada.');
