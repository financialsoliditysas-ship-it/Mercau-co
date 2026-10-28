"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { serviceTypes } from "@/lib/delivery-types";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import BackToAccount from "@/components/BackToAccount";
import { ExternalLink, LocateFixed, MapPin, RotateCcw } from "lucide-react";

const initialForm = {
  serviceType: "Recoger una compra",
  pickupName: "",
  pickupAddress: "",
  pickupNeighborhood: "",
  pickupContact: "",
  pickupPhone: "",
  pickupInstructions: "",
  pickupLatitude: null as number | null,
  pickupLongitude: null as number | null,
  pickupLocationAccuracyM: null as number | null,
  pickupLocationCapturedAt: null as string | null,
  deliveryName: "",
  deliveryAddress: "",
  deliveryNeighborhood: "",
  deliveryPhone: "",
  deliveryInstructions: "",
  deliveryLatitude: null as number | null,
  deliveryLongitude: null as number | null,
  deliveryLocationAccuracyM: null as number | null,
  deliveryLocationCapturedAt: null as string | null,
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
  const requestKey = useRef('');
  const submitting = useRef(false);
  const [form, setForm] = useState<DeliveryForm>(initialForm);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ publicId: string; trackingUrl: string; message: string } | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [pickupBusinessId,setPickupBusinessId]=useState('');
  const [pickupLocationStatus, setPickupLocationStatus] = useState("");
  const [locatingPickup, setLocatingPickup] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('negocio');
    if(!id || !/^rec[A-Za-z0-9]{14}$/.test(id))return;
    let active=true;
    fetch('/api/negocios',{cache:'no-store'}).then(r=>r.json()).then(result=>{
      const b=result.businesses?.find((item:{id:string})=>item.id===id);
      if(!active||!b)return;
      setPickupBusinessId(b.id);setForm(current=>({...current,pickupName:b.name,pickupContact:b.name,pickupPhone:b.whatsapp,pickupAddress:`${b.neighborhood}, ${b.municipality}`,pickupNeighborhood:b.municipality}));
    }).catch(()=>{});return()=>{active=false;};
  },[]);

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient()?.auth.getUser().then(({ data }) => {
      const p = data.user?.user_metadata?.delivery_profile;
      if (!active || !p) return;
      const value = (key: string) => typeof p[key] === 'string' ? p[key] : '';
      setForm(current => ({ ...current,
        customerName: current.customerName || value('name'), customerPhone: current.customerPhone || value('phone'),
        deliveryName: current.deliveryName || value('name'), deliveryPhone: current.deliveryPhone || value('phone'),
        deliveryAddress: current.deliveryAddress || [value('address'), value('municipality')].filter(Boolean).join(', '),
        deliveryNeighborhood: current.deliveryNeighborhood || value('neighborhood'),
        deliveryInstructions: current.deliveryInstructions || value('instructions') }));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

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

  function captureDeliveryLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Este navegador no permite obtener la ubicación. Puedes escribir la dirección y las referencias.");
      return;
    }

    setLocating(true);
    setLocationStatus("Buscando tu ubicación actual...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          deliveryLatitude: Number(coords.latitude.toFixed(7)),
          deliveryLongitude: Number(coords.longitude.toFixed(7)),
          deliveryLocationAccuracyM: Math.round(coords.accuracy),
          deliveryLocationCapturedAt: new Date().toISOString()
        }));
        setLocationStatus("Ubicación guardada. Revisa el punto antes de continuar.");
        setLocating(false);
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "No autorizaste el acceso a la ubicación. Puedes escribir la dirección y las referencias.",
          2: "El teléfono no pudo determinar la ubicación. Intenta de nuevo en un lugar abierto.",
          3: "La ubicación tardó demasiado. Intenta nuevamente."
        };
        setLocationStatus(messages[error.code] || "No se pudo obtener la ubicación. Escribe la dirección y las referencias.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function capturePickupLocation() {
    if (!navigator.geolocation) {
      setPickupLocationStatus("Este navegador no permite obtener la ubicación. Puedes escribir la dirección y las referencias.");
      return;
    }
    setLocatingPickup(true);
    setPickupLocationStatus("Buscando la ubicación de recogida...");
    navigator.geolocation.getCurrentPosition(({coords}) => {
      setForm(current => ({...current,
        pickupLatitude:Number(coords.latitude.toFixed(7)),
        pickupLongitude:Number(coords.longitude.toFixed(7)),
        pickupLocationAccuracyM:Math.round(coords.accuracy),
        pickupLocationCapturedAt:new Date().toISOString()
      }));
      setPickupLocationStatus("Ubicación de recogida guardada. Revisa el punto antes de continuar.");
      setLocatingPickup(false);
    },error => {
      const messages:Record<number,string>={
        1:"No autorizaste el acceso a la ubicación. Puedes escribir la dirección y las referencias.",
        2:"El teléfono no pudo determinar la ubicación. Intenta de nuevo en un lugar abierto.",
        3:"La ubicación tardó demasiado. Intenta nuevamente."
      };
      setPickupLocationStatus(messages[error.code] || "No se pudo obtener la ubicación de recogida.");
      setLocatingPickup(false);
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }

  function clearPickupLocation() {
    setForm(current=>({...current,pickupLatitude:null,pickupLongitude:null,pickupLocationAccuracyM:null,pickupLocationCapturedAt:null}));
    setPickupLocationStatus("");
  }

  function clearDeliveryLocation() {
    setForm((current) => ({
      ...current,
      deliveryLatitude: null,
      deliveryLongitude: null,
      deliveryLocationAccuracyM: null,
      deliveryLocationCapturedAt: null
    }));
    setLocationStatus("");
  }

  const deliveryMapsUrl = form.deliveryLatitude !== null && form.deliveryLongitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.deliveryLatitude},${form.deliveryLongitude}`)}`
    : "";
  const pickupMapsUrl = form.pickupLatitude !== null && form.pickupLongitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.pickupLatitude},${form.pickupLongitude}`)}`
    : "";

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitDelivery() {
    if (submitting.current) return;
    submitting.current = true;
    setStatus("Creando solicitud...");

    try {
      requestKey.current ||= sessionStorage.getItem('mercau.delivery.pending-request') || crypto.randomUUID();
      sessionStorage.setItem('mercau.delivery.pending-request', requestKey.current);
      const client=getSupabaseBrowserClient();
      const session=client?(await client.auth.getSession()).data.session:null;
      const response = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json",...(session?{Authorization:`Bearer ${session.access_token}`}:{}) },
        body: JSON.stringify({ ...form, source: "WEB",pickupBusinessId,requestKey:requestKey.current })
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
      sessionStorage.removeItem('mercau.delivery.pending-request');
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo crear la solicitud.");
    } finally {
      submitting.current = false;
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
          <div className="flex flex-wrap justify-end gap-2"><a href="/" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black">Inicio</a><BackToAccount /></div>
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

            <LocationControl
              id="pickup-location-title"
              title="Ubicación exacta de recogida"
              help="Úsala si no conoces la dirección o la calle no aparece en el mapa."
              mapsUrl={pickupMapsUrl}
              accuracy={form.pickupLocationAccuracyM}
              locating={locatingPickup}
              status={pickupLocationStatus}
              onCapture={capturePickupLocation}
              onClear={clearPickupLocation}
            />

            <h2 className="mt-2 text-xl font-black">Datos de entrega</h2>
            <Field label="Nombre del destinatario" value={form.deliveryName} onChange={(value) => updateField("deliveryName", value)} required />
            <Field label="Dirección o descripción del lugar" value={form.deliveryAddress} onChange={(value) => updateField("deliveryAddress", value)} required />
            <Field label="Barrio/sector" value={form.deliveryNeighborhood} onChange={(value) => updateField("deliveryNeighborhood", value)} />
            <Field label="Teléfono" value={form.deliveryPhone} onChange={(value) => updateField("deliveryPhone", value)} required />
            <TextArea label="Referencia para encontrar el lugar" value={form.deliveryInstructions} onChange={(value) => updateField("deliveryInstructions", value)} />

            <LocationControl id="delivery-location-title" title="Ubicación exacta de entrega" help="Úsala cuando la calle no aparezca en el mapa o no tenga nomenclatura." mapsUrl={deliveryMapsUrl} accuracy={form.deliveryLocationAccuracyM} locating={locating} status={locationStatus} onCapture={captureDeliveryLocation} onClear={clearDeliveryLocation} />

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
            <Summary title="Recogida" lines={[form.pickupName, form.pickupAddress, form.pickupNeighborhood, form.pickupContact, form.pickupPhone, form.pickupInstructions, pickupMapsUrl ? "Ubicación exacta agregada" : ""]} />
            <Summary title="Entrega" lines={[form.deliveryName, form.deliveryAddress, form.deliveryNeighborhood, form.deliveryPhone, form.deliveryInstructions, deliveryMapsUrl ? "Ubicación exacta agregada" : ""]} />
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

function LocationControl({id,title,help,mapsUrl,accuracy,locating,status,onCapture,onClear}:{id:string;title:string;help:string;mapsUrl:string;accuracy:number|null;locating:boolean;status:string;onCapture:()=>void;onClear:()=>void}) {
  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-3" aria-labelledby={id}>
    <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D82016]" aria-hidden="true"/><div><h3 id={id} className="text-sm font-black">{title}</h3><p className="mt-0.5 text-xs font-semibold text-slate-600">{help}</p></div></div>
    {mapsUrl?<div className="mt-2 rounded-lg bg-white p-2"><p className="text-sm font-black text-emerald-700">Ubicación guardada</p><p className="text-xs font-semibold text-slate-600">Precisión aproximada: {accuracy??0} metros.</p>{(accuracy??0)>50?<p className="mt-1 text-xs font-bold text-amber-700">La precisión es baja. Vuelve a tomarla desde un lugar abierto.</p>:null}<div className="mt-2 flex flex-wrap gap-2"><a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#D82016] px-3 text-xs font-black text-white"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true"/>Revisar mapa</a><button type="button" onClick={onClear} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true"/>Volver a tomar</button></div></div>:<button type="button" onClick={onCapture} disabled={locating} className="mt-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#D82016] px-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"><LocateFixed className="h-4 w-4" aria-hidden="true"/>{locating?'Obteniendo...':'Usar mi ubicación actual'}</button>}
    {status?<p role="status" className="mt-2 text-xs font-bold text-slate-700">{status}</p>:null}<p className="mt-2 text-[11px] font-semibold text-slate-500">Mercáu guarda este punto para el servicio. No sigue tu recorrido.</p>
  </section>;
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
