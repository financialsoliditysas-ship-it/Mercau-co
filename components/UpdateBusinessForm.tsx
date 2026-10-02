"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type UpdateBusiness = {
  id: string;
  name: string;
  category: string;
  neighborhood: string;
  description: string;
  hours: string;
  whatsapp: string;
  deliveries: string;
  instagram: string;
  facebook: string;
  mapsUrl: string;
  status: string;
};

export default function UpdateBusinessForm({ token }: { token: string }) {
  const supabase = getSupabaseBrowserClient();
  const [business, setBusiness] = useState<UpdateBusiness | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [pageStatus, setPageStatus] = useState("Cargando enlace privado...");
  const [submitStatus, setSubmitStatus] = useState("");
  const [accessStatus, setAccessStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingAccess, setIsCreatingAccess] = useState(false);

  async function saveBusinessAccess(currentUser: User, currentBusiness: UpdateBusiness) {
    if (!supabase) {
      setAccessStatus("La conexión de cuentas todavía no está configurada.");
      return;
    }

    const { error } = await supabase.from("business_admins").upsert(
      {
        user_id: currentUser.id,
        business_id: currentBusiness.id,
        business_name: currentBusiness.name,
        owner_name: currentUser.user_metadata?.name || "",
        owner_whatsapp: currentBusiness.whatsapp || "",
        private_token: token,
        status: "Activo"
      },
      { onConflict: "user_id,business_id" }
    );

    if (error) {
      setAccessStatus("No se pudo asociar el negocio. Revisa que la tabla business_admins exista en Supabase.");
      return;
    }

    window.localStorage.removeItem(`mercau.pendingBusinessAccess.${token}`);
    setAccessStatus("Acceso activado. Ya puedes entrar a Mi negocio.");
  }

  useEffect(() => {
    async function loadBusiness() {
      try {
        const response = await fetch(`/api/actualizaciones/${token}`, {
          cache: "no-store"
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "No se pudo cargar el negocio.");
        }

        setBusiness(result.business);
        setPageStatus("");
      } catch (error) {
        setPageStatus(
          "Este enlace privado no existe, fue cambiado o no está disponible."
        );
      }
    }

    loadBusiness();
  }, [token]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      setUser(data.session?.user || null);
    }

    loadSession();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user || !business) return;

    const pending = window.localStorage.getItem(`mercau.pendingBusinessAccess.${token}`);
    if (pending === "1") {
      saveBusinessAccess(user, business);
    }
  }, [user, business, token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const hasChanges = [
      "requestedChanges",
      "newDescription",
      "newWhatsapp",
      "newNeighborhood",
      "newHours",
      "deliveries",
      "instagram",
      "facebook",
      "mapsUrl"
    ].some((field) => String(payload[field] || "").trim());

    if (!hasChanges) {
      setSubmitStatus("Escribe al menos un dato para actualizar.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("Enviando solicitud...");

    try {
      const response = await fetch(`/api/actualizaciones/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo enviar la solicitud.");
      }

      form.reset();
      setSubmitStatus(
        "Solicitud recibida. Mercáu revisará el cambio antes de publicarlo."
      );
    } catch (error) {
      setSubmitStatus(
        "No se pudo enviar la solicitud. Intenta nuevamente o escribe por WhatsApp a Mercáu."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onCreateAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !supabase) {
      setAccessStatus("La conexión de cuentas todavía no está configurada.");
      return;
    }

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const name = String(payload.adminName || "").trim();
    const email = String(payload.email || "").trim();
    const password = String(payload.password || "");

    if (!name || !email || password.length < 6) {
      setAccessStatus("Escribe nombre, correo y una contraseña de mínimo 6 caracteres.");
      return;
    }

    setIsCreatingAccess(true);
    setAccessStatus("Creando acceso...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined
      }
    });

    if (error) {
      setAccessStatus(error.message === "User already registered"
        ? "Ese correo ya existe. Entra en Mi negocio con tu contraseña."
        : `No se pudo crear el acceso: ${error.message}`);
      setIsCreatingAccess(false);
      return;
    }

    window.localStorage.setItem(`mercau.pendingBusinessAccess.${token}`, "1");

    if (data.session?.user) {
      await saveBusinessAccess(data.session.user, business);
    } else {
      setAccessStatus("Revisa tu correo para confirmar la cuenta. Luego vuelve a abrir este mismo link privado para terminar la activación.");
    }

    form.reset();
    setIsCreatingAccess(false);
  }

  return (
    <main className="min-h-screen bg-[#FCFBF9] text-[#1F2937]">
      <section className="bg-[#D82016] py-10 text-white md:py-12">
        <div className="container">
          <div className="mb-6 flex items-center gap-3">
            <img src="/logo-mercau.png" alt="Mercáu" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/30" />
            <div>
              <strong className="block text-2xl font-black leading-none">Mercáu</strong>
              <span className="block text-sm font-semibold text-white/80">Directorio Digital del Bajo Cauca</span>
            </div>
          </div>
          <p className="text-sm font-extrabold uppercase tracking-normal text-white/75">
            Link privado del negocio
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">
            Actualizar ficha en Mercáu
          </h1>
          <p className="mt-4 max-w-3xl leading-8 text-white/85">
            Este enlace es privado para administrar la información de tu negocio.
            No lo compartas con otras personas. Los cambios enviados serán
            revisados antes de publicarse.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            {business ? (
              <>
                <p className="text-sm font-extrabold uppercase tracking-normal text-[#D82016]">
                  Ficha actual
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight">
                  {business.name}
                </h2>
                <div className="mt-5 grid gap-3 text-sm text-slate-700">
                  <p><strong>Categoría:</strong> {business.category || "Por confirmar"}</p>
                  <p><strong>Dirección:</strong> {business.neighborhood || "Por confirmar"}</p>
                  <p><strong>WhatsApp:</strong> {business.whatsapp || "Por confirmar"}</p>
                  <p><strong>Horario:</strong> {business.hours || "Por confirmar"}</p>
                  <p><strong>Domicilios:</strong> {business.deliveries || "Consultar"}</p>
                  <p><strong>Estado:</strong> {business.status || "Pendiente"}</p>
                </div>
                <p className="mt-5 leading-7 text-slate-600">
                  {business.description || "Sin descripcion publicada."}
                </p>
              </>
            ) : (
              <p className="font-bold text-slate-700">{pageStatus}</p>
            )}
          </div>

          <form onSubmit={onCreateAccess} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-sm font-extrabold uppercase tracking-normal text-[#D82016]">
              Activar acceso
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight">
              Administra tu ficha
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Crea tu acceso privado para entrar después a Mi negocio. Este acceso queda asociado a esta ficha.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-bold">
                Nombre del administrador
                <input name="adminName" required className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Correo electrónico
                <input name="email" type="email" required className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Contraseña
                <input name="password" type="password" minLength={6} required className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
              </label>
              <button
                type="submit"
                disabled={!business || isCreatingAccess}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#D82016] px-5 font-extrabold text-white hover:bg-[#B91C1C] disabled:opacity-60"
              >
                {isCreatingAccess ? "Activando..." : "Activar mi acceso"}
              </button>
              <a href="/mi-negocio" className="text-center text-sm font-black text-[#D82016] underline">
                Ya tengo acceso, entrar a Mi negocio
              </a>
              {accessStatus ? <p className="rounded-xl bg-[#FFF1F0] p-3 text-sm font-bold text-[#1F2937]">{accessStatus}</p> : null}
            </div>
          </form>
          </aside>

          <form
            onSubmit={onSubmit}
            className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:grid-cols-2"
          >
            <label className="grid gap-2 font-bold sm:col-span-2">
              Qué quieres cambiar
              <textarea
                name="requestedChanges"
                rows={5}
                placeholder="Ejemplo: cambie de numero, ahora atiendo hasta las 9 p.m. y hago domicilios."
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 font-bold sm:col-span-2">
              Nueva descripción pública
              <textarea
                name="newDescription"
                rows={4}
                placeholder="Escribe aquí cómo quieres que aparezca la descripción del negocio."
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 font-bold">
              WhatsApp de confirmacion
              <input
                name="confirmationWhatsapp"
                inputMode="tel"
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 font-bold">
              Nuevo WhatsApp
              <input
                name="newWhatsapp"
                inputMode="tel"
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 font-bold">
              Nueva dirección
              <input name="newNeighborhood" className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
            </label>
            <label className="grid gap-2 font-bold">
              Nuevo horario
              <input name="newHours" className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
            </label>
            <label className="grid gap-2 font-bold">
              Domicilios
              <select name="deliveries" className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20">
                <option value="">Sin cambio</option>
                <option>Consultar</option>
                <option>Si</option>
                <option>No</option>
              </select>
            </label>
            <label className="grid gap-2 font-bold">
              Instagram
              <input
                name="instagram"
                placeholder="@minegocio o link"
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 font-bold">
              Facebook
              <input
                name="facebook"
                placeholder="Nombre de pagina o link"
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 font-bold sm:col-span-2">
              Google Maps
              <input
                name="mapsUrl"
                placeholder="Link de ubicación si lo tienes"
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <button
              type="submit"
              disabled={!business || isSubmitting}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#D82016] px-5 font-extrabold text-white hover:bg-[#B91C1C] disabled:opacity-60 sm:col-span-2"
            >
              {isSubmitting ? "Enviando..." : "Enviar solicitud de cambio"}
            </button>
            {submitStatus ? (
              <p className="rounded-xl bg-[#FFF1F0] p-3 font-bold text-[#1F2937] sm:col-span-2">
                {submitStatus}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
