import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDirectoryBusiness } from "@/lib/airtable-directory";

export const dynamic = "force-dynamic";

const siteUrl = "https://www.mercau.co";

function normalizePhoneForColombia(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

function whatsappUrl(phone: string, businessName: string) {
  const normalized = normalizePhoneForColombia(phone);
  const text = encodeURIComponent(
    `Hola, vi ${businessName} en Mercáu y quiero más información.`
  );

  return normalized ? `https://wa.me/${normalized}?text=${text}` : "#";
}

function phoneForCall(phone: string) {
  const normalized = normalizePhoneForColombia(phone);
  return normalized ? `+${normalized}` : "";
}

function displayCategory(category: string) {
  return category;
}

function socialUrl(value: string | undefined, network: "instagram" | "facebook") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const handle = clean.replace(/^@/, "").replace(/^\/+/, "");
  return network === "instagram"
    ? `https://instagram.com/${handle}`
    : `https://facebook.com/${handle}`;
}

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const business = await loadDirectoryBusiness(params.id);

  if (!business) {
    return {
      title: "Negocio no encontrado | Mercáu"
    };
  }

  const title = `${business.name} | Mercáu`;
  const description = `${displayCategory(business.category)} en ${business.municipality}${business.neighborhood ? `, ${business.neighborhood}` : ""}. Contacta por WhatsApp desde Mercáu.`;
  const url = `/negocios/${business.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      type: "website",
      siteName: "Mercáu",
      title,
      description,
      url,
      images: [
        {
          url: "/og-mercau.jpg",
          width: 1200,
          height: 630,
          alt: `${business.name} en Mercáu`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-mercau.jpg"]
    }
  };
}

export default async function BusinessPage({
  params
}: {
  params: { id: string };
}) {
  const business = await loadDirectoryBusiness(params.id);

  if (!business) notFound();

  const callPhone = phoneForCall(business.whatsapp);
  const shareUrl = `${siteUrl}/negocios/${business.id}`;
  const shareMessage = `Mira ${business.name} en Mercáu: ${shareUrl}`;

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#1F2937]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3" aria-label="Volver a Mercáu">
            <img src="/logo-mercau.png" alt="Mercáu" className="h-11 w-11 rounded-2xl object-cover" />
            <div>
              <strong className="block text-2xl font-black leading-none text-[#D82016]">Mercáu</strong>
              <span className="block text-xs font-semibold text-slate-500">Directorio Digital del Bajo Cauca</span>
            </div>
          </Link>
          <Link href="/#directorio" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-[#1F2937] hover:bg-[#FFF1F0] hover:text-[#D82016]">
            Directorio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 md:py-8">
        <article className="overflow-hidden rounded-[1.75rem] bg-white shadow-soft">
          <div className="grid min-h-40 place-items-center bg-[#D82016] px-5 py-8 text-white">
            <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-black ring-1 ring-white/30">
              {displayCategory(business.category)}
            </span>
            <h1 className="mt-4 max-w-3xl text-center text-3xl font-black leading-tight md:text-5xl">
              {business.name}
            </h1>
            <p className="mt-3 text-center text-sm font-bold text-white/90 md:text-base">
              {business.municipality}
              {business.neighborhood ? ` · ${business.neighborhood}` : ""}
            </p>
          </div>

          <div className="grid gap-6 p-5 md:grid-cols-[1fr_20rem] md:p-7">
            <div>
              <section>
                <h2 className="text-xl font-black">Qué ofrece</h2>
                <p className="mt-2 leading-7 text-slate-700">{business.description}</p>
              </section>

              <section className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <h2 className="text-lg font-black text-[#1F2937]">Datos del negocio</h2>
                <p><strong>Categoría:</strong> {displayCategory(business.category)}</p>
                {business.subcategory ? <p><strong>Subcategoría:</strong> {business.subcategory}</p> : null}
                {business.tags?.length ? <p><strong>Etiquetas:</strong> {business.tags.join(", ")}</p> : null}
                <p><strong>Municipio:</strong> {business.municipality}</p>
                <p><strong>Zona:</strong> {business.neighborhood || "Consultar"}</p>
                <p><strong>Domicilios:</strong> {business.deliveries === "Si" ? "Sí" : business.deliveries || "Consultar"}</p>
                <p><strong>Horario:</strong> {business.hours || "Consultar por WhatsApp"}</p>
              </section>

              <section className="mt-6 grid gap-2">
                <h2 className="text-lg font-black">Enlaces</h2>
                {business.mapsUrl ? <a className="font-bold text-[#D82016] underline" href={business.mapsUrl} target="_blank" rel="noreferrer">Abrir ubicación</a> : null}
                {business.instagram ? <a className="font-bold text-[#D82016] underline" href={socialUrl(business.instagram, "instagram")} target="_blank" rel="noreferrer">Instagram</a> : null}
                {business.facebook ? <a className="font-bold text-[#D82016] underline" href={socialUrl(business.facebook, "facebook")} target="_blank" rel="noreferrer">Facebook</a> : null}
              </section>
            </div>

            <aside className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <h2 className="text-lg font-black">Contactar</h2>
              <div className="mt-4 grid gap-2">
                <a
                  href={whatsappUrl(business.whatsapp, business.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#D82016] px-4 font-black text-white hover:bg-[#B91C1C]"
                >
                  Contactar por WhatsApp
                </a>
                <a
                  href={callPhone ? `tel:${callPhone}` : "#"}
                  aria-disabled={!callPhone}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-4 font-black text-slate-900"
                >
                  Llamar
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-4 font-black text-slate-900"
                >
                  Compartir por WhatsApp
                </a>
              </div>
              <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
                Esta ficha hace parte del Directorio Digital del Bajo Cauca.
              </p>
            </aside>
          </div>
        </article>
      </main>
    </div>
  );
}
