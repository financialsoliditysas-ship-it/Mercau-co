"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type BusinessAccess = {
  business_id: string;
  business_name: string;
  owner_name: string;
  owner_whatsapp: string;
  status: string;
  private_token: string;
};

type DirectoryBusiness = {
  id: string;
  name: string;
  category: string;
  municipality: string;
  neighborhood: string;
  description: string;
  whatsapp: string;
  status: string;
};

export default function MyBusinessDashboard() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [accesses, setAccesses] = useState<BusinessAccess[]>([]);
  const [businesses, setBusinesses] = useState<DirectoryBusiness[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Cargando acceso...");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setStatus("La conexión de cuentas todavía no está configurada.");
      return;
    }
    const client = supabase;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      setUser(data.session?.user || null);
      setStatus(data.session?.user ? "Cargando tus negocios..." : "");
    }

    loadSession();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setStatus(session?.user ? "Cargando tus negocios..." : "");
    });

    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    const currentUser = user;

    async function loadAccesses() {
      const { data, error } = await client
        .from("business_admins")
        .select("business_id,business_name,owner_name,owner_whatsapp,status,private_token")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        setStatus("No se pudieron cargar tus negocios. Revisa que la tabla business_admins exista en Supabase.");
        return;
      }

      setAccesses((data || []) as BusinessAccess[]);
      setStatus("");
    }

    loadAccesses();
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;

    async function loadBusinesses() {
      const response = await fetch("/api/negocios", { cache: "no-store" });
      const result = await response.json();
      setBusinesses(result.businesses || []);
    }

    loadBusinesses().catch(() => {});
  }, [user]);

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setIsSubmitting(true);
    setStatus("Entrando...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setStatus("No se pudo entrar. Revisa el correo y la contraseña.");
    } else {
      setStatus("Acceso correcto.");
      setEmail("");
      setPassword("");
    }

    setIsSubmitting(false);
  }

  const businessById = new Map(businesses.map((business) => [business.id, business]));

  return (
    <main className="min-h-screen bg-[#FCFBF9] text-[#1F2937]">
      <section className="bg-[#D82016] px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-black uppercase tracking-normal text-white/80">Mi negocio</p>
          <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
            Administra tu ficha en Mercáu
          </h1>
          <p className="mt-3 max-w-2xl font-semibold leading-7 text-white/85">
            Entra con el acceso que activaste desde tu link privado. La información pública seguirá pasando por revisión antes de publicarse.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-4 py-8 md:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-3xl bg-white p-5 shadow-soft">
          {user ? (
            <>
              <p className="text-sm font-black text-[#D82016]">Sesión activa</p>
              <p className="mt-2 break-words text-sm font-bold text-slate-600">{user.email}</p>
              <button
                type="button"
                onClick={() => supabase?.auth.signOut()}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-100 px-4 font-black text-slate-900"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <form onSubmit={onLogin} className="grid gap-3">
              <h2 className="text-2xl font-black">Entrar</h2>
              <label className="grid gap-2 text-sm font-black">
                Correo
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Contraseña
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 rounded-2xl border border-slate-200 px-4 font-semibold outline-none focus:border-[#D82016] focus:ring-4 focus:ring-[#D82016]/20"
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#D82016] px-5 font-black text-white disabled:opacity-60"
              >
                {isSubmitting ? "Entrando..." : "Entrar a mi negocio"}
              </button>
            </form>
          )}
          {status ? <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm font-bold text-slate-700">{status}</p> : null}
        </aside>

        <div className="grid gap-4">
          {user && accesses.length === 0 ? (
            <div className="rounded-3xl bg-white p-5 shadow-soft">
              <h2 className="text-2xl font-black">Aún no tienes negocios asociados</h2>
              <p className="mt-2 font-semibold leading-7 text-slate-600">
                Para asociar tu negocio, abre el link privado que Mercáu te envió por WhatsApp y activa tu acceso desde allí.
              </p>
            </div>
          ) : null}

          {accesses.map((access) => {
            const business = businessById.get(access.business_id);
            return (
              <article key={access.business_id} className="rounded-3xl bg-white p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#D82016]">{access.status || "Activo"}</p>
                    <h2 className="mt-1 text-2xl font-black">{business?.name || access.business_name}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {business ? `${business.municipality} · ${business.neighborhood || "Dirección por confirmar"}` : "Ficha asociada"}
                    </p>
                  </div>
                  <a href={`/actualizar/${access.private_token}`} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#D82016] px-4 text-sm font-black text-white">
                    Solicitar cambios
                  </a>
                </div>
                <p className="mt-4 leading-7 text-slate-700">
                  {business?.description || "Cuando la ficha esté publicada, aquí verás la información pública del negocio."}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
