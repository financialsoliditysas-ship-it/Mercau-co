const fs = require('node:fs');

const directory = fs.readFileSync('components/MercauDirectory.tsx', 'utf8');
const directoryApi = fs.readFileSync('app/api/negocios/route.ts', 'utf8');
const metricsApi = fs.readFileSync('app/api/metricas/route.ts', 'utf8');
const catalogManager = fs.readFileSync('components/CatalogManager.tsx', 'utf8');

function includes(source, value, message) {
  if (!source.includes(value)) throw new Error(message);
}

includes(directory, 'grid-cols-2', 'El directorio debe mostrar dos columnas en móvil.');
includes(directory, 'sm:grid-cols-3', 'El directorio debe mostrar tres columnas en pantallas intermedias.');
includes(directory, 'xl:grid-cols-4', 'El directorio debe mostrar cuatro columnas en escritorio ancho.');
includes(directory, 'business.hasCatalog&&<a', 'La acción comercial solo debe aparecer cuando existe contenido publicado.');
includes(directory, 'catalogLabel(business.category)', 'El CTA debe distinguir menú de catálogo mediante la categoría.');
includes(directory, 'business.commercialSearchTerms', 'La búsqueda debe incluir nombres y descripciones del contenido comercial.');
includes(directory, 'IntersectionObserver', 'Las vistas de fichas deben medirse por visibilidad real.');
includes(directory, 'viewedBusinessCards.has(business.id)', 'Una ficha no debe contar vistas repetidas durante la misma visita.');
includes(directory, 'DirectorySkeleton', 'La carga debe mostrar una estructura visual estable.');
includes(directory, 'border-[#F3D1CE]', 'Las fichas deben conservar un contorno rojo tenue.');
includes(directory, 'bg-[#D82016] text-xs font-black text-white transition hover:bg-[#B91C14]', 'La acción de WhatsApp debe usar el rojo Mercáu.');
includes(directoryApi, 'catalogBusinessAvailability', 'La API debe consultar la disponibilidad comercial de forma agregada.');
includes(metricsApi, 'business_card_viewed', 'La API de métricas debe aceptar vistas de fichas.');
includes(metricsApi, 'directory_search_performed', 'La API de métricas debe aceptar búsquedas del directorio.');
includes(catalogManager, 'Agregar primer producto', 'El panel del negocio debe orientar al dueño cuando no tiene contenido publicado.');

console.log('PASS responsive public directory contract.');
