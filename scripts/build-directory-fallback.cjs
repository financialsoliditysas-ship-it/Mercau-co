const fs = require('fs');

const csvPath = process.argv[2];
const outputPath = process.argv[3];

if (!csvPath || !outputPath) {
  throw new Error('Uso: node scripts/build-directory-fallback.cjs <origen.csv> <salida.json>');
}

const idBySlug = new Map(Object.entries({
  'joyeria-oro-puro': 'rec0rwB43SejtOzrl',
  'electronica-celulares-mr': 'rec1ljGB0Tdr9QGbD',
  'variedades-y-celulares-jl': 'rec2oz1QWBtK2mxXp',
  'cafeteria-y-panaderia-el-portal': 'rec4AaFqir3iZMnxk',
  'restaurante-lita-maria-gourmet': 'rec9TOxnhFgguld6g',
  'variedades-y-accesorios-jym': 'recAq5owAz59ezHob',
  'tienda-movil': 'recb6v4MEfBCtzZJq',
  'variedades-y-celulares-jl-2': 'recBCExqy1ntvh14D',
  'jazhel-store': 'recBgQhMKhnrr8OvT',
  'restaurante-mercado-prueba': 'recbnxV3UMB9u0ZyI',
  'jake': 'recbrOJV09ptKcfO0',
  'drip-station': 'recctUQMDUnxpgLVo',
  'carro-moto-talike': 'recCx6KVtsKxItsa9',
  'delicias-cande': 'recCXPysaYK0OqThV',
  'kikiriki-y-quesudos': 'rece62hjPb3DM0l8P',
  'marval-store': 'recEBOVxHR6WEG5rM',
  'ocre-cafe-experiencial': 'recEJfgtRJtCdh4xS',
  'tienda-cosmeticos': 'recgIH1ZgGiLMb90D',
  'financial-solidity-sas': 'recGLMhJYXTRE46st',
  'cosmeticos-y-variedades-alejandra': 'recIajq4cMEpyjBIV',
  'steffa-boutique': 'recJc8WL3MEIjJ60h',
  'pizzas-y-shawarma': 'recJijPZH0koyAY3c',
  'micheladas-y-algo-mas-sofi': 'recJjDt9dWsQtS0UE',
  'punto-fresh': 'recJYRWVfDrm018O9',
  'asados-tic-tac': 'recLhzizMbEgMN6gg',
  'efecty-servientrega': 'reclOhGibnaYhjCHn',
  'tienda-me-gusta': 'recLv84BcR7EVlQoj',
  'happy-broaster': 'recMqPkqsNzAf46dB',
  'eufoshoptienda26': 'recmT6LI2AN6Y1FnC',
  'granja-integral-no-hay-como-dios': 'recmWtXydN3C4by1T',
  'corporacion-educativa-nechi-coren': 'recMxo8cI63j6v2hz',
  'vital-fuxion-saludable': 'recOEMe2zZjt6XhWI',
  'croky-alitas-nechi': 'recOPiHxGryCdknF0',
  'donde-kiko': 'recqb7NOaWcepqp1o',
  'cootransnec': 'recRXUJ5gt0zSavPH',
  'tecnico-en-refrigeracion-de-aires-acondicionados': 'recS8hbRCKFWpuUpV',
  'franvy-fotografia-y-publicidad': 'recUgZNIZCpRRWVji',
  'comidas-rapidas-cyk-los-chamos': 'recUH1dESDfNwEcvR',
  'sanstisar': 'recUVIMp2TSDKQ79F',
  'mi-camiseta': 'recVwy5bE9uJE7Wwe',
  'milenazo': 'recWGLZ48QuckezIi',
  'nevoz-producciones': 'recx3oSn2tHhqC8Wg',
  'al-reves-digital': 'recXRpTxUmzbiZYLO',
  'drogueria-medifarma-nechi': 'recYpWUN69hNqECRt',
  'amalaya-restaurante': 'reczNAjJ3QQ1TgQ2a',
  'asados-el-choli-bar-grill': 'recZQzu4If5VE0Egr'
}));

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  const headers = rows.shift().map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '') : header
  );
  return rows.filter(rowValues => rowValues.some(Boolean)).map(rowValues =>
    Object.fromEntries(headers.map((header, index) => [header, rowValues[index] || '']))
  );
}

function slugify(value) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const approved = new Set(['Verificado', 'Destacado', 'Publicado']);
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  .filter(row => approved.has(row.Estado));

const missing = rows
  .map(row => slugify(row['Nombre del negocio']))
  .filter(slug => !idBySlug.has(slug));

if (missing.length) {
  throw new Error(`No hay ID público para: ${missing.join(', ')}`);
}

const businesses = rows.map(row => {
  const name = row['Nombre del negocio'].trim();
  const slug = slugify(name);
  const category = row['Categoría principal nueva'] || 'Profesionales y servicios';
  const legacyCategory = row['Categoría anterior'] || row.Categoria || category;
  const secondaryCategories = row['Categorías secundarias']
    ? row['Categorías secundarias'].split(',').map(value => value.trim()).filter(Boolean)
    : [];
  const tags = row['Etiquetas / servicios']
    ? row['Etiquetas / servicios'].split(',').map(value => value.trim()).filter(Boolean)
    : [];

  return {
    id: idBySlug.get(slug),
    name,
    category,
    legacyCategory,
    secondaryCategories,
    subcategory: row.Subcategoría || '',
    tags,
    municipality: row.Municipio === 'Bagre' ? 'El Bagre' : (row.Municipio || 'Nechí'),
    neighborhood: row['Dirección'] || 'Nechí',
    description: row['Descripcion corta'] || 'Negocio local inscrito en el directorio.',
    hours: row.Horario || 'Consultar por WhatsApp',
    whatsapp: row.WhatsApp || '',
    deliveries: row.Domicilios || 'Consultar',
    instagram: row.Instagram || '',
    facebook: row.Facebook || '',
    mapsUrl: row['Google Maps'] || '',
    status: row.Estado,
    source: 'Airtable (copia de continuidad 2026-11-06)',
    ...(slug === 'restaurante-mercado-prueba' ? { pilotRestaurant: 'restaurante-mercado' } : {})
  };
});

fs.writeFileSync(outputPath, `${JSON.stringify(businesses, null, 2)}\n`, 'utf8');
console.log(`Copia creada: ${businesses.length} negocios publicados.`);
