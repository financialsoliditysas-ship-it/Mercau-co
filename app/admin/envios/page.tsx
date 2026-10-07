"use client";

import { FormEvent, useState } from "react";

type AdminOrder = {
  id: string;
  public_id: string;
  created_at: string;
  customer_name: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  shipday_status: string | null;
  shipday_order_id: string | null;
  shipday_tracking_url: string | null;
  delivery_fee: number;
};

export default function AdminDeliveriesPage() {
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  async function loadOrders(event?: FormEvent) {
    event?.preventDefault();
    setStatus("Cargando envíos...");
    setSelected(null);

    const response = await fetch("/api/admin/envios", {
      headers: { "x-admin-password": password }
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setStatus(payload.error || "No se pudieron cargar los envíos.");
      return;
    }

    setOrders(payload.orders || []);
    setStatus(`${payload.orders?.length || 0} envíos cargados.`);
  }

  async function action(id: string, actionName: "retry_shipday" | "history" | "cancel") {
    setStatus("Procesando...");
    const response = await fetch("/api/admin/envios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify({ id, action: actionName })
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setStatus(payload.error || "No se pudo procesar.");
      return;
    }

    setSelected(payload);
    setStatus("Listo.");
    await loadOrders();
  }

  return (
    <div className="min-h-screen bg-[#FCFBF9] p-4 text-[#1F2937]">
      <main className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black">Envíos Mercáu</h1>
        <p className="mt-2 font-semibold text-slate-600">Panel mínimo para pruebas logísticas.</p>

        <form onSubmit={loadOrders} className="mt-5 flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-soft sm:flex-row">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Clave administrativa"
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 font-semibold"
          />
          <button className="min-h-11 rounded-xl bg-[#D82016] px-5 font-black text-white">Cargar</button>
        </form>

        {status ? <p className="mt-4 rounded-xl bg-white p-3 text-sm font-bold shadow-soft">{status}</p> : null}

        <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-soft">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Recogida</th>
                <th className="p-3">Entrega</th>
                <th className="p-3">Estado Mercáu</th>
                <th className="p-3">Estado Shipday</th>
                <th className="p-3">Shipday ID</th>
                <th className="p-3">Tarifa</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="p-3 font-black">{order.public_id}</td>
                  <td className="p-3">{new Date(order.created_at).toLocaleString("es-CO")}</td>
                  <td className="p-3">{order.customer_name}</td>
                  <td className="p-3">{order.pickup_address}</td>
                  <td className="p-3">{order.delivery_address}</td>
                  <td className="p-3">{order.status}</td>
                  <td className="p-3">{order.shipday_status || "-"}</td>
                  <td className="p-3">{order.shipday_order_id || "-"}</td>
                  <td className="p-3">${Number(order.delivery_fee || 0).toLocaleString("es-CO")}</td>
                  <td className="grid gap-1 p-3">
                    <button onClick={() => action(order.id, "history")} className="rounded-lg bg-slate-100 px-3 py-2 font-black">Ver</button>
                    {order.status === "integration_error" ? (
                      <button onClick={() => action(order.id, "retry_shipday")} className="rounded-lg bg-[#D82016] px-3 py-2 font-black text-white">Reintentar</button>
                    ) : null}
                    {order.status !== "delivered" && order.status !== "cancelled" ? (
                      <button onClick={() => action(order.id, "cancel")} className="rounded-lg bg-slate-900 px-3 py-2 font-black text-white">Cancelar</button>
                    ) : null}
                    <a href={`/envio/${order.public_id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-center font-black">Tracking</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? (
          <pre className="mt-5 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">
            {JSON.stringify(selected, null, 2)}
          </pre>
        ) : null}
      </main>
    </div>
  );
}
