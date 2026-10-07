"use client";

import { FormEvent, useEffect, useState } from "react";
import { serviceTypes } from "@/lib/delivery-types";

const initialForm = {
  serviceType: "Recoger una compra",
  pickupName: "",
  pickupAddress: "",
  pickupNeighborhood: "",
  pickupContact: "",
  pickupPhone: "",
  pickupInstructions: "",
  deliveryName: "",
  deliveryAddress: "",
  deliveryNeighborhood: "",
  deliveryPhone: "",
  deliveryInstructions: "",
  description: "",
  notes: "",
  customerName: "",
  customerPhone: ""
};

type DeliveryForm = typeof initialForm;

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

export default function SendPage() {
  const [form, setForm] = useState<DeliveryForm>(initialForm);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ publicId: string; trackingUrl: string; message: string } | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/deliveries/config")
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.ok && Number.isFinite(Number(payload.deliveryFee))) {
          setDeliveryFee(Number(payload.deliveryFee));
        }
      })
      .catch(() => {});
  }, []);

  function updateField(name: keyof DeliveryForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitDelivery() {
    setStatus("Creando solicitud...");

    try {
      const response = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "WEB" })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "No se pudo crear la solicitud.");
      }

      setResult({
        publicId: payload.publicId,
        trackingUrl: payload.trackingUrl,
        message: payload.message
      });
      setStep("done");
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo crear la solicitud.");
    }
  }

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#1F2937]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-3">
            <img src="/logo-mercau.png" alt="Mercáu" className="h-11 w-11 rounded-2xl object-cover" />
            <div>
              <strong className="block text-2xl font-black leading-none text-[#D82016]">Mercáu</strong>
              <span className="block text-xs font-semibold text-slate-500">Mensajería y domicilios</span>
            </div>
          </a>
          <a href="/" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black">Inicio</a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="rounded-[1.5rem] bg-[#D82016] p-5 text-white shadow-soft">
          <p className="text-sm font-black uppercase tracking-normal text-white/80">MVP logístico</p>
          <h1 className="mt-2 text-3xl font-black leading-tight">Solicita un envío</h1>
          <p className="mt-2 font-semibold text-white/90">Recogemos y llevamos por ti.</p>
        </section>

        {step === "form" ? (
          <form onSubmit={handleReview} className="mt-5 grid gap-4 rounded-[1.5rem] bg-white p-4 shadow-soft md:p-6">
            <label className="grid gap-2 font-black">
              Tipo de servicio
              <select value={form.serviceType} onChange={(event) => updateField("serviceType", event.target.value)} className="min-h-12 rounded-xl border border-slate-200 px-4 font-semibold">
                {serviceTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <h2 className="mt-2 text-xl font-black">Datos de recogida</h2>
            <Field label="Nombre del punto/persona" value={form.pickupName} onChange={(value) => updateField("pickupName", value)} required />
            <Field label="Dirección de recogida" value={form.pickupAddress} onChange={(value) => updateField("pickupAddress", value)} required />
            <Field label="Barrio/sector" value={form.pickupNeighborhood} onChange={(value) => updateField("pickupNeighborhood", value)} />
            <Field label="Nombre de contacto" value={form.pickupContact} onChange={(value) => updateField("pickupContact", value)} />
            <Field label="Teléfono" value={form.pickupPhone} onChange={(value) => updateField("pickupPhone", value)} required />
            <TextArea label="Referencia/instrucciones" value={form.pickupInstructions} onChange={(value) => updateField("pickupInstructions", value)} />

            <h2 className="mt-2 text-xl font-black">Datos de entrega</h2>
            <Field label="Nombre del destinatario" value={form.deliveryName} onChange={(value) => updateField("deliveryName", value)} required />
            <Field label="Dirección" value={form.deliveryAddress} onChange={(value) => updateField("deliveryAddress", value)} required />
            <Field label="Barrio/sector" value={form.deliveryNeighborhood} onChange={(value) => updateField("deliveryNeighborhood", value)} />
            <Field label="Teléfono" value={form.deliveryPhone} onChange={(value) => updateField("deliveryPhone", value)} required />
            <TextArea label="Referencia/instrucciones" value={form.deliveryInstructions} onChange={(value) => updateField("deliveryInstructions", value)} />

            <h2 className="mt-2 text-xl font-black">Detalle</h2>
            <TextArea label="¿Qué vamos a llevar?" value={form.description} onChange={(value) => updateField("description", value)} required />
            <TextArea label="Observaciones" value={form.notes} onChange={(value) => updateField("notes", value)} />

            <h2 className="mt-2 text-xl font-black">Cliente que solicita</h2>
            <Field label="Nombre" value={form.customerName} onChange={(value) => updateField("customerName", value)} required />
            <Field label="WhatsApp/teléfono" value={form.customerPhone} onChange={(value) => updateField("customerPhone", value)} required />

            <button className="mt-2 min-h-12 rounded-2xl bg-[#D82016] px-5 font-black text-white hover:bg-[#B91C1C]">
              Revisar solicitud
            </button>
          </form>
        ) : null}

        {step === "confirm" ? (
          <section className="mt-5 rounded-[1.5rem] bg-white p-4 shadow-soft md:p-6">
            <h2 className="text-2xl font-black">Revisa tu solicitud</h2>
            <Summary title="Recogida" lines={[form.pickupName, form.pickupAddress, form.pickupNeighborhood, form.pickupContact, form.pickupPhone, form.pickupInstructions]} />
            <Summary title="Entrega" lines={[form.deliveryName, form.deliveryAddress, form.deliveryNeighborhood, form.deliveryPhone, form.deliveryInstructions]} />
            <Summary title="Servicio" lines={[form.serviceType]} />
            <Summary title="Descripción" lines={[form.description, form.notes]} />
            <div className="mt-4 rounded-2xl bg-[#FFF1F0] p-4">
              <p className="text-sm font-black uppercase tracking-normal text-[#D82016]">Tarifa</p>
              <p className="text-2xl font-black">{deliveryFee === null ? "Consultando" : money(deliveryFee)}</p>
            </div>
            {status ? <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-bold">{status}</p> : null}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button onClick={() => setStep("form")} className="min-h-12 rounded-2xl border border-slate-200 px-5 font-black">
                Corregir datos
              </button>
              <button onClick={submitDelivery} className="min-h-12 rounded-2xl bg-[#D82016] px-5 font-black text-white hover:bg-[#B91C1C]">
                Confirmar y solicitar mensajero
              </button>
            </div>
          </section>
        ) : null}

        {step === "done" && result ? (
          <section className="mt-5 rounded-[1.5rem] bg-white p-5 shadow-soft">
            <p className="text-sm font-black uppercase tracking-normal text-[#D82016]">Solicitud recibida</p>
            <h2 className="mt-2 text-3xl font-black">{result.publicId}</h2>
            <p className="mt-2 font-semibold text-slate-700">{result.message}</p>
            <a href={result.trackingUrl} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#D82016] px-5 font-black text-white">
              Ver seguimiento
            </a>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-black">
      {label}
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 rounded-xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
    </label>
  );
}

function TextArea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-black">
      {label}
      <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
    </label>
  );
}

function Summary({ title, lines }: { title: string; lines: string[] }) {
  const visible = lines.filter(Boolean);
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="font-black">{title}</h3>
      {visible.length ? (
        <div className="mt-1 grid gap-1 text-sm font-semibold text-slate-600">
          {visible.map((line) => <p key={line}>{line}</p>)}
        </div>
      ) : (
        <p className="mt-1 text-sm font-semibold text-slate-400">Sin datos adicionales.</p>
      )}
    </div>
  );
}
