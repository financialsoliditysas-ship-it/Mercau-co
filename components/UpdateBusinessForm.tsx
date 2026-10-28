"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import BackToAccount from "./BackToAccount";
import BirthDateField from "./account/BirthDateField";
import { birthDateError, isBirthDateMessage } from "@/lib/account-age";

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
  const [accessStatus, setAccessStatus] = useState("");
  const [isCreatingAccess, setIsCreatingAccess] = useState(false);
  const [accessMode, setAccessMode] = useState<'register' | 'login'>('register');
  const [birthDate, setBirthDate] = useState('');

  async function saveBusinessAccess(currentUser: User, currentBusiness: UpdateBusiness) {
    if (!supabase) {
      setAccessStatus("La conexión de cuentas todavía no está configurada.");
      return;
    }

    setIsCreatingAccess(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== currentUser.id || !currentBusiness.id) throw new Error('Session changed');
      const response = await fetch(`/api/actualizaciones/${token}/activar`, { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
      if (!response.ok) {
        setAccessStatus('No se pudo activar la invitación. Confirma el correo o contacta a Mercáu si ya tiene un administrador.');
        return;
      }
      window.localStorage.removeItem(`mercau.pendingBusinessAccess.${token}`);
      window.location.assign('/mi-negocio');
    } catch {
      setAccessStatus('No se pudo activar la invitación. Intenta más tarde.');
    } finally { setIsCreatingAccess(false); }
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

  async function onCreateAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !supabase) {
      setAccessStatus("La conexión de cuentas todavía no está configurada.");
      return;
    }

    if (user) { await saveBusinessAccess(user, business); return; }

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const name = String(payload.adminName || "").trim();
    const email = String(payload.email || "").trim();
    const password = String(payload.password || "");

    if (accessMode === 'login') {
      setIsCreatingAccess(true);
      window.localStorage.setItem(`mercau.pendingBusinessAccess.${token}`, '1');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { window.localStorage.removeItem(`mercau.pendingBusinessAccess.${token}`); setAccessStatus('No se pudo entrar. Revisa correo, contraseña y confirmación del correo.'); }
      setIsCreatingAccess(false);
      return;
    }
    if (!name || !email || password.length < 8) {
      setAccessStatus("Escribe nombre, correo y una contraseña de mínimo 8 caracteres.");
      return;
    }

    const ageError = birthDateError(birthDate);
    if (ageError) { setAccessStatus(ageError); return; }
    setIsCreatingAccess(true);
    setAccessStatus("Creando acceso...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, account_intent: 'business', birth_date: birthDate },
        emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined
      }
    });

    if (error) {
      setAccessStatus(error.message === "User already registered"
        ? "Ese correo ya existe. Entra en Mi negocio con tu contraseña."
        : isBirthDateMessage(error.message) ? error.message : 'No se pudo crear el acceso. Revisa tus datos e intenta más tarde.');
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
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <img src="/logo-mercau.png" alt="Mercáu" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/30" />
            <div>
              <strong className="block text-2xl font-black leading-none">Mercáu</strong>
              <span className="block text-sm font-semibold text-white/80">Directorio Digital del Bajo Cauca</span>
            </div>
          </div>
          <div className="mb-4 flex justify-end"><BackToAccount /></div>
          <p className="text-sm font-extrabold uppercase tracking-normal text-white/75">
            Link privado del negocio
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">
            Activa la administración de tu negocio
          </h1>
          <p className="mt-4 max-w-3xl leading-8 text-white/85">
            Este enlace es privado. Crea tu cuenta o entra con una cuenta existente
            para administrar esta ficha desde Panel de mi negocio.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container max-w-4xl">
          <div className="grid gap-6 md:grid-cols-2">
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
              Activa el acceso a tu negocio
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Crea tu acceso privado para entrar después a Mi negocio. Este acceso queda asociado a esta ficha.
            </p>
            {!user && <div className="mt-4 flex gap-2"><button type="button" onClick={() => setAccessMode('register')} aria-pressed={accessMode === 'register'} className="min-h-11 px-3 font-bold">Crear mi cuenta</button><button type="button" onClick={() => setAccessMode('login')} aria-pressed={accessMode === 'login'} className="min-h-11 px-3 font-bold">Ya tengo cuenta</button></div>}
            <div className="mt-4 grid gap-3">
              {!user && <>
              {accessMode === 'register' &&
              <label className="grid gap-2 text-sm font-bold">
                Nombre del administrador
                <input name="adminName" required className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
              </label>}
              {accessMode === 'register' && <BirthDateField value={birthDate} onChange={setBirthDate} className="grid gap-2 text-sm font-bold" inputClassName="min-h-11 rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016]"/>}
              <label className="grid gap-2 text-sm font-bold">
                Correo electrónico
                <input name="email" type="email" required className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Contraseña
                <input name="password" type="password" minLength={accessMode === 'register' ? 8 : undefined} required className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20" />
              </label>
              </>}
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
          </div>
        </div>
      </section>
    </main>
  );
}
