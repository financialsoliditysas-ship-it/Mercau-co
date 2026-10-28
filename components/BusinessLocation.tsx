export default function BusinessLocation({ mapsUrl }: { mapsUrl?: string }) {
  if (!mapsUrl) return null;
  let url: URL;
  try { url = new URL(mapsUrl.trim()); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  return <a href={url.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-[#D82016] bg-white px-3 py-2 text-center text-sm font-bold text-[#D82016] hover:bg-[#FFF1F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D82016]">Ver ubicación en Google Maps</a>;
}
