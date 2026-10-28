"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type CountItem = {
  label: string;
  count: number;
};

type MetricsData = {
  summary: {
    visitas: number;
    clicsWhatsApp: number;
    visitasQrTarjeta: number;
    instalacionesIniciadas: number;
    instalacionesAndroidConfirmadas: number;
    instalacionesActivasEstimadas: number;
    registrosIniciados: number;
    cuentasConfirmadas: number;
    menusVistos: number;
    productosAgregados: number;
    carritosIniciados: number;
    pedidosRevisados: number;
    pedidosConfirmados: number;
    negociosInscritos: number;
    negociosAprobados: number;
  };
  statusCounts: CountItem[];
  categoriasMasBuscadas: CountItem[];
  busquedas: CountItem[];
  whatsappPorNegocio: CountItem[];
  fuentesCampana: CountItem[];
  ultimosEventos: Array<{
    tipo: string;
    negocio: string;
    categoria: string;
    busqueda: string;
    ruta: string;
    fecha: string;
    notas: string;
  }>;
};

const emptyData: MetricsData = {
  summary: {
    visitas: 0,
    clicsWhatsApp: 0,
    visitasQrTarjeta: 0,
    instalacionesIniciadas: 0,
    instalacionesAndroidConfirmadas: 0,
    instalacionesActivasEstimadas: 0,
    registrosIniciados: 0,
    cuentasConfirmadas: 0,
    menusVistos: 0,
    productosAgregados: 0,
    carritosIniciados: 0,
    pedidosRevisados: 0,
    pedidosConfirmados: 0,
    negociosInscritos: 0,
    negociosAprobados: 0
  },
  statusCounts: [],
  categoriasMasBuscadas: [],
  busquedas: [],
  whatsappPorNegocio: [],
  fuentesCampana: [],
  ultimosEventos: []
};

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function MetricCard(props: { label: string; value: number; helper: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-bold text-slate-500">{props.label}</p>
      <strong className="mt-3 block text-4xl font-black text-emerald-950">
        {props.value}
      </strong>
      <span className="mt-2 block text-sm leading-6 text-slate-600">
        {props.helper}
      </span>
    </article>
  );
}

function Ranking(props: { title: string; items: CountItem[]; empty: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-black text-emerald-950">{props.title}</h2>
      <div className="mt-4 grid gap-3">
        {props.items.length > 0 ? (
          props.items.map((item) => (
            <div key={item.label} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
              <span className="truncate font-bold text-slate-700">{item.label}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-black text-emerald-900">
                {item.count}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-500">{props.empty}</p>
        )}
      </div>
    </section>
  );
}

export default function AdminMetricasPage() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<MetricsData>(emptyData);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  useEffect(() => { setPassword(sessionStorage.getItem("mercau_admin_password") || ""); }, []);

  async function loadMetrics(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsLoading(true);
    setStatus("Cargando metricas...");

    try {
      const response = await fetch("/api/admin/metricas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudieron cargar las metricas.");
      }

      setData(result);
      sessionStorage.setItem("mercau_admin_password", password);
      setIsUnlocked(true);
      setStatus("Metricas actualizadas.");
    } catch (error) {
      setIsUnlocked(false);
      setStatus(error instanceof Error ? error.message : "No se pudo cargar.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AdminShell active="metricas" title="Métricas" description="Consulta visitas, contactos, búsquedas y actividad de los negocios en Mercáu.">
        <form
          onSubmit={loadMetrics}
          className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft sm:grid-cols-[1fr_auto]"
        >
          <label className="grid gap-2 font-bold">
            Clave del panel
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="rounded-lg border border-slate-200 px-4 py-3 font-normal"
              placeholder="Escribe la clave"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="mt-auto inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-700 px-5 font-extrabold text-white disabled:opacity-60"
          >
            {isLoading ? "Cargando..." : "Entrar"}
          </button>
        </form>

        {status ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 font-bold text-emerald-900">
            {status}
          </p>
        ) : null}

        {isUnlocked ? (
          <>
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-2xl font-black text-emerald-950">Adquisición e instalación</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Android confirmado usa el evento del navegador. Instalaciones activas es una estimación basada en la primera apertura desde el icono.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <MetricCard
                  label="Visitas desde QR físico"
                  value={data.summary.visitasQrTarjeta}
                  helper="Llegadas desde tarjetas con fuente tarjeta_fisica y medio qr."
                />
                <MetricCard
                  label="Clics en instalar"
                  value={data.summary.instalacionesIniciadas}
                  helper="Personas que tocaron Instalar Mercáu."
                />
                <MetricCard
                  label="Android confirmadas"
                  value={data.summary.instalacionesAndroidConfirmadas}
                  helper="Instalaciones confirmadas por Chrome."
                />
                <MetricCard
                  label="Instalaciones activas"
                  value={data.summary.instalacionesActivasEstimadas}
                  helper="Primera apertura detectada desde el icono."
                />
                <MetricCard
                  label="Registros iniciados"
                  value={data.summary.registrosIniciados}
                  helper="Formularios de cuenta enviados correctamente."
                />
                <MetricCard
                  label="Cuentas confirmadas"
                  value={data.summary.cuentasConfirmadas}
                  helper="Confirmaciones detectadas en el mismo navegador."
                />
              </div>
            </section>

            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Menús vistos"
                value={data.summary.menusVistos}
                helper="Entradas registradas a menús y catálogos."
              />
              <MetricCard
                label="Productos agregados"
                value={data.summary.productosAgregados}
                helper="Productos incorporados a pedidos."
              />
              <MetricCard
                label="Carritos iniciados"
                value={data.summary.carritosIniciados}
                helper="Personas que avanzaron a los datos de entrega."
              />
              <MetricCard
                label="Solicitudes de pedido"
                value={data.summary.pedidosConfirmados}
                helper="Pedidos enviados al negocio, todavía no ventas entregadas."
              />
              <MetricCard
                label="Visitas"
                value={data.summary.visitas}
                helper="Entradas registradas al directorio."
              />
              <MetricCard
                label="Clics WhatsApp"
                value={data.summary.clicsWhatsApp}
                helper="Personas que intentaron contactar negocios."
              />
              <MetricCard
                label="Negocios inscritos"
                value={data.summary.negociosInscritos}
                helper="Total de registros en Airtable."
              />
              <MetricCard
                label="Negocios aprobados"
                value={data.summary.negociosAprobados}
                helper="Verificados o destacados visibles."
              />
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <Ranking
                title="Categorias mas buscadas"
                items={data.categoriasMasBuscadas}
                empty="Todavia no hay clics de categoria."
              />
              <Ranking
                title="WhatsApp por negocio"
                items={data.whatsappPorNegocio}
                empty="Todavia no hay clics de WhatsApp."
              />
              <Ranking
                title="Busquedas escritas"
                items={data.busquedas}
                empty="Todavia no hay busquedas escritas registradas."
              />
              <Ranking
                title="Origen de campañas"
                items={data.fuentesCampana}
                empty="Todavía no hay campañas con utm_source."
              />
              <Ranking
                title="Estados de negocios"
                items={data.statusCounts}
                empty="Todavia no hay negocios registrados."
              />
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <h2 className="text-xl font-black text-emerald-950">Ultimos eventos</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-3 pr-4">Tipo</th>
                      <th className="py-3 pr-4">Negocio</th>
                      <th className="py-3 pr-4">Categoria</th>
                      <th className="py-3 pr-4">Busqueda</th>
                      <th className="py-3 pr-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ultimosEventos.length > 0 ? (
                      data.ultimosEventos.map((event, index) => (
                        <tr key={`${event.fecha}-${index}`} className="border-b">
                          <td className="py-3 pr-4 font-bold">{event.tipo || "Evento"}</td>
                          <td className="py-3 pr-4">{event.negocio || "-"}</td>
                          <td className="py-3 pr-4">{event.categoria || "-"}</td>
                          <td className="py-3 pr-4">{event.busqueda || "-"}</td>
                          <td className="py-3 pr-4">{formatDate(event.fecha)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={5}>
                          Todavia no hay eventos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
    </AdminShell>
  );
}
