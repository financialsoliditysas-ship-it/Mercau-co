import { CircleHelp } from 'lucide-react';

export default function CatalogPhotoHelp() {
  return <details className="group rounded-md border border-gray-200 bg-white">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 py-2 font-bold text-[#1F2937]">
      <CircleHelp className="h-5 w-5 shrink-0 text-[#D82016]" aria-hidden="true" />
      ¿Cómo debe ser la foto de mi producto o plato?
      <span className="ml-auto text-[#D82016] group-open:rotate-45" aria-hidden="true">+</span>
    </summary>
    <div className="border-t border-gray-200 px-4 py-4 text-sm leading-6 text-gray-700">
      <p><strong>Recomendado:</strong> JPG de 1.200 × 900 píxeles, formato horizontal 4:3 y máximo 2 MB.</p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>Mercáu acepta JPG, JPEG, PNG y WebP.</li>
        <li>El archivo original puede pesar hasta 12 MB; Mercáu intenta reducirlo automáticamente.</li>
        <li>El lado más largo se procesa hasta un máximo de 1.600 píxeles.</li>
        <li>Ubica el producto en el centro y deja espacio alrededor para evitar recortes.</li>
        <li>Usa buena iluminación y evita capturas de pantalla, collages y textos pequeños.</li>
      </ul>
      <p className="mt-3">Las tarjetas del catálogo utilizan formato horizontal 4:3. Una imagen cuadrada también funciona, pero puede recortarse ligeramente.</p>
    </div>
  </details>;
}
