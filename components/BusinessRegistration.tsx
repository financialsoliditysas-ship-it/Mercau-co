"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  directoryCategories,
  directoryMunicipalities,
  DirectoryCategory,
} from "@/data/directory";
import { getSupabaseBrowserClient } from "@/lib/supabase";
export default function BusinessRegistration({ onRegistered, compact = false }: { onRegistered?: () => void; compact?: boolean } = {}) {
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    client?.auth
      .getUser()
      .then(({ data }) => {
        if (data.user && data.user.user_metadata?.account_intent !== "business")
          client.auth.updateUser({ data: { account_intent: "business" } });
      })
      .catch(() => {});
  }, []);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const formRef=useRef<HTMLFormElement|null>(null);
  const firstStepRender=useRef(true);
  const [signupCategory, setSignupCategory] = useState<DirectoryCategory | "">(
    "",
  );
  const signupCategoryConfig = directoryCategories.find(
    (category) => category.name === signupCategory,
  );
  useEffect(()=>{
    if(firstStepRender.current){firstStepRender.current=false;return;}
    const frame=window.requestAnimationFrame(()=>{
      formRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
      const firstVisible=Array.from(formRef.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[name]:not([type="hidden"])`) || [])
        .find(field=>field.offsetParent!==null && !field.disabled);
      window.setTimeout(()=>firstVisible?.focus({preventScroll:true}),350);
    });
    return()=>window.cancelAnimationFrame(frame);
  },[step]);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      setStep((value) => value + 1);
      return;
    }
    setIsSubmitting(true);
    setStatus("Enviando inscripción...");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {
      ...Object.fromEntries(formData.entries()),
      secondaryCategories: formData.getAll("secondaryCategories"),
    };

    try {
      const client = getSupabaseBrowserClient();
      const { data } = client
        ? await client.auth.getSession()
        : { data: { session: null } };
      if (!data.session) {
        window.location.assign("/negocios/registro");
        return;
      }
      const response = await fetch("/api/inscripciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo enviar.");
      }

      form.reset();
      setSignupCategory("");
      setStep(0);
      setStatus(
        `${result.message || "Inscripción recibida."} Queda pendiente de revisión antes de publicarse.`,
      );
      if (result.linked) {
        if (onRegistered) onRegistered();
        else window.location.assign("/mi-cuenta/negocio?onboarding=producto");
      }
    } catch (error) {
      setStatus(
        "No se pudo enviar la inscripción. Revisa la conexión e intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id="inscripcion"
      className={compact ? "mx-auto mt-5 max-w-3xl pb-8" : "mx-auto mt-8 max-w-7xl px-4 pb-10 md:px-6"}
    >
      <div className={compact ? "rounded-lg bg-white p-1" : "grid gap-6 rounded-[2rem] bg-white p-5 shadow-soft md:grid-cols-[0.85fr_1.15fr] md:p-7"}>
        {!compact && <div>
          <p className="text-sm font-black uppercase tracking-normal text-[#D82016]">
            Inscripción gratuita
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-[#1F2937] md:text-4xl">
            Inscribe tu negocio en Mercáu
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            El formulario está pensado para celular. Tu solicitud queda en
            revisión y se publica cuando Mercáu apruebe la información.
          </p>
        </div>}

        <form ref={formRef} onSubmit={onSubmit} className="scroll-mt-4 grid gap-3 sm:grid-cols-2">
          <nav
            aria-label="Pasos para inscribir el negocio"
            className="flex flex-wrap gap-3 border-b border-gray-200 pb-3 sm:col-span-2"
          >
            {["Datos básicos", "Actividad", "Contacto y entregas"].map(
              (label, index) => (
                <span
                  key={label}
                  aria-current={step === index ? "step" : undefined}
                  className={
                    step === index
                      ? "font-bold text-[#D82016]"
                      : "text-gray-500"
                  }
                >
                  {label}
                </span>
              ),
            )}
          </nav>
          <div className={step === 0 ? "contents" : "hidden"}>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Nombre del negocio
              <input
                name="businessName"
                required
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Nombre del propietario / administrador
              <input
                name="ownerName"
                required
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              WhatsApp
              <input
                name="whatsapp"
                required
                inputMode="tel"
                placeholder="Ej: 3001234567"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Categoría principal
              <select
                name="category"
                aria-label="Categoría principal"
                required
                value={signupCategory}
                onChange={(event) =>
                  setSignupCategory(
                    event.target.value as DirectoryCategory | "",
                  )
                }
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              >
                <option value="">Seleccionar categoría</option>
                {directoryCategories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {signupCategoryConfig ? (
              <label className="grid gap-2 text-sm font-black text-slate-800">
                Subcategoría
                <select
                  name="subcategory"
                  aria-label="Subcategoría"
                  className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
                >
                  <option value="">Seleccionar subcategoría</option>
                  {signupCategoryConfig.subcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                  <option value="Otra actividad">Otra actividad</option>
                </select>
              </label>
            ) : null}
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Municipio
              <select
                name="municipality"
                aria-label="Municipio"
                required
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              >
                <option value="">Seleccionar municipio</option>
                {directoryMunicipalities.map((municipality) => (
                  <option key={municipality} value={municipality}>
                    {municipality}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Dirección del negocio
              <input
                name="neighborhood"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800 sm:col-span-2">
              Descripción corta del negocio
              <textarea
                name="description"
                required
                rows={3}
                className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
          </div>
          <div className={step === 1 ? "contents" : "hidden"}>
            {signupCategory ? (
              <fieldset className="grid gap-2 rounded-2xl border border-slate-200 p-4 sm:col-span-2">
                <legend className="px-1 text-sm font-black text-slate-800">
                  Categorías secundarias opcionales
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {directoryCategories
                    .filter((category) => category.name !== signupCategory)
                    .map((category) => (
                      <label
                        key={category.name}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                      >
                        <input
                          type="checkbox"
                          name="secondaryCategories"
                          value={category.name}
                          className="h-4 w-4 accent-[#D82016]"
                        />
                        {category.name}
                      </label>
                    ))}
                </div>
              </fieldset>
            ) : null}
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Etiquetas o servicios
              <input
                name="tags"
                placeholder="Ej: domicilios, repuestos, papelería"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Otra actividad
              <input
                name="otherActivity"
                placeholder="Si no encaja, escríbela aquí"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
          </div>
          <div className={step === 2 ? "contents" : "hidden"}>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Horario
              <input
                name="hours"
                placeholder="Ej: lunes a sábado"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Domicilios
              <select
                name="deliveries"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              >
                <option>Consultar</option>
                <option value="Si">Sí</option>
                <option>No</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Instagram o usuario
              <input
                name="instagram"
                type="text"
                placeholder="@minegocio"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800">
              Facebook o página
              <input
                name="facebook"
                type="text"
                placeholder="Mi Negocio"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-800 sm:col-span-2">
              ¿Quieres vender en Mercáu?
              <select
                name="wantsMarketplace"
                className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
              >
                <option value="Si">Sí</option>
                <option value="Después">Después</option>
              </select>
            </label>
          </div>
          {step > 0 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep((value) => value - 1)}
              className="min-h-11 rounded-md border border-gray-300 px-4"
            >
              Volver
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#D82016] px-5 py-4 font-black text-white hover:bg-[#B91C1C] disabled:opacity-60 sm:col-span-2"
          >
            {isSubmitting
              ? "Enviando..."
              : step < 2
                ? "Continuar"
                : "Enviar inscripción para revisión"}
          </button>
          {status ? (
            <p className="rounded-2xl bg-[#FFF1F0] p-4 font-bold text-[#1F2937] sm:col-span-2">
              {status}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
