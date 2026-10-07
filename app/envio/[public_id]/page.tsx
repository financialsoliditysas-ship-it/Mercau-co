import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeliveryHistory, getDeliveryOrderByPublicId } from "@/lib/deliveries";

export const dynamic = "force-dynamic";

const steps = [
  { key: "created", label: "Solicitud recibida" },
  { key: "assigned", label: "Mensajero asignado" },
  { key: "picked_up", label: "Recogido" },
  { key: "in_transit", label: "En camino" },
  { key: "delivered", label: "Entregado" }
];

const rank: Record<string, number> = {
  created: 0,
  sent_to_shipday: 0,
  integration_error: 0,
  assigned: 1,
  picked_up: 2,
  in_transit: 3,
  delivered: 4,
  failed: 0,
  cancelled: 0
};

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date(value));
}

export default async function DeliveryTrackingPage({
  params
}: {
  params: { public_id: string };
}) {
  const order = await getDeliveryOrderByPublicId(params.public_id);
  if (!order) notFound();

  const history = await getDeliveryHistory(order.id);
  const currentRank = rank[order.status] || 0;

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#1F2937]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo-mercau.png" alt="Mercáu" className="h-11 w-11 rounded-2xl object-cover" />
            <div>
              <strong className="block text-2xl font-black leading-none text-[#D82016]">Mercáu</strong>
              <span className="block text-xs font-semibold text-slate-500">Seguimiento de envío</span>
            </div>
          </Link>
          <Link href="/enviar" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black">Nuevo envío</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <article className="rounded-[1.5rem] bg-white p-5 shadow-soft md:p-6">
          <p className="text-sm font-black uppercase tracking-normal text-[#D82016]">Pedido</p>
          <h1 className="mt-1 text-4xl font-black">{order.public_id}</h1>
          <p className="mt-2 font-semibold text-slate-600">Creado: {formatDate(order.created_at)}</p>

          <div className="mt-6 grid gap-3">
            {steps.map((step, index) => {
              const active = index === currentRank;
              const done = index < currentRank || order.status === "delivered";

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${
                    done ? "bg-[#D82016] text-white" : active ? "border-2 border-[#D82016] text-[#D82016]" : "bg-slate-100 text-slate-400"
                  }`}>
                    {done ? "✓" : active ? "●" : "○"}
                  </span>
                  <span className={`font-black ${done || active ? "text-[#1F2937]" : "text-slate-400"}`}>{step.label}</span>
                </div>
              );
            })}
          </div>

          {order.status === "integration_error" ? (
            <p className="mt-5 rounded-2xl bg-[#FFF1F0] p-4 text-sm font-bold text-[#D82016]">
              Recibimos tu solicitud y estamos terminando de procesarla.
            </p>
          ) : null}

          {order.status === "failed" || order.status === "cancelled" ? (
            <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-700">
              Este envío requiere revisión de Mercáu.
            </p>
          ) : null}

          <section className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <p><strong>Estado actual:</strong> {order.status}</p>
            <p><strong>Origen:</strong> {order.pickup_neighborhood || order.pickup_address}</p>
            <p><strong>Destino:</strong> {order.delivery_neighborhood || order.delivery_address}</p>
            {order.shipday_tracking_url ? (
              <a className="font-black text-[#D82016] underline" href={order.shipday_tracking_url} target="_blank" rel="noreferrer">
                Ver tracking de Shipday
              </a>
            ) : null}
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-black">Historial</h2>
            <div className="mt-3 grid gap-2">
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                  <p className="font-black">{item.status}</p>
                  <p className="font-semibold text-slate-500">{formatDate(item.created_at)}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
