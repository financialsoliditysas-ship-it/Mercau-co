"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import BackToAccount from "./BackToAccount";
import BusinessEditor from "./BusinessEditor";
import BusinessImage from "./BusinessImage";
import BusinessOrdersLink from "./BusinessOrdersLink";
import { businessPath, businessShareMessage } from '@/lib/business-public-url';
import { catalogNoun } from '@/lib/catalog-validation';

type BusinessAccess = {
  business_id: string;
  business_name: string;
  owner_name: string;
  owner_whatsapp: string;
  status: string;
  private_token: string;
};

type DirectoryBusiness = {
  publicSlug?:string;
  pilotRestaurant?:string;
  photoUrl?:string;
  photoKind?:'photo'|'logo';
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
  const [editingBusiness,setEditingBusiness] = useState('');
  const [accessLoading,setAccessLoading] = useState(true);
  const editorRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(!editingBusiness)return;
    const frame=window.requestAnimationFrame(()=>{
      editorRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
      window.setTimeout(()=>editorRef.current?.focus({preventScroll:true}),350);
    });
    return()=>window.cancelAnimationFrame(frame);
  },[editingBusiness]);

  useEffect(() => {
    if (!supabase) {
      setStatus("La conexión de cuentas todavía no está configurada.");
      return;
    }
    const client = supabase;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      setUser(data.session?.user || null);
      setAccessLoading(!!data.session?.user);
      setStatus(data.session?.user ? "Cargando tus negocios..." : "");
    }

    loadSession();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAccesses([]);setBusinesses([]);setEditingBusiness('');setAccessLoading(!!session?.user);
      setStatus(session?.user ? "Cargando tus negocios..." : "");
    });

    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    const currentUser = user;
    let active = true;
    setAccessLoading(true);

    async function loadAccesses() {
      const { data, error } = await client
        .from("business_admins")
        .select("business_id,business_name,owner_name,owner_whatsapp,status,private_token")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (!active) return;
      setAccessLoading(false);
      if (error) {
        setStatus("No se pudieron cargar tus negocios. Revisa que la tabla business_admins exista en Supabase.");
        return;
      }

      setAccesses((data || []) as BusinessAccess[]);
      setStatus("");
    }

    loadAccesses();
    return ()=>{active=false;};
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
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-black uppercase tracking-normal text-white/80">Panel de mi negocio</p><BackToAccount /></div>
          <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
            Administra tu ficha en Mercáu
          </h1>
          <p className="mt-3 max-w-2xl font-semibold leading-7 text-white/85">
            Edita la información de tu negocio y guarda los cambios directamente en su ficha pública.
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

        <div className="grid min-w-0 gap-4">
          {user && !accessLoading && !status && accesses.length === 0 ? (
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
              <article key={access.business_id} className="min-w-0 rounded-3xl bg-white p-5 shadow-soft">
                {business?.photoUrl && <BusinessImage name={business.name} photoUrl={business.photoUrl} photoKind={business.photoKind} className="mb-4 h-40 w-full overflow-hidden rounded-md" />}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#D82016]">{access.status || "Activo"}</p>
                    <h2 className="mt-1 text-2xl font-black">{business?.name || access.business_name}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {business ? `${business.municipality} · ${business.neighborhood || "Dirección por confirmar"}` : "Ficha asociada"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2"><button type="button" disabled={access.status !== 'Activo'} onClick={()=>setEditingBusiness(access.business_id)} className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#D82016] px-4 text-sm font-black text-white disabled:opacity-60">Editar ficha</button>{access.status==='Activo' && <a href={`/mi-negocio/${access.business_id}/catalogo`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#D82016] px-4 text-sm font-black text-[#D82016]">Mi {business?catalogNoun(business.category).toLocaleLowerCase('es-CO'):'catálogo'}</a>}</div>
                </div>
                <p className="mt-4 leading-7 text-slate-700">
                  {business?.description || "Cuando la ficha esté publicada, aquí verás la información pública del negocio."}
                </p>
                {business && <div className="mt-3 flex flex-wrap gap-2"><a href={businessPath(business)} className="inline-flex min-h-11 items-center rounded-md border border-gray-300 px-3 text-sm font-bold">Ver mi página</a><a href={`https://wa.me/?text=${encodeURIComponent(businessShareMessage(business))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-gray-300 px-3 text-sm font-bold">Compartir mi página</a></div>}
                {access.status === 'Activo' && <BusinessOrdersLink businessId={access.business_id} />}
                {(business?.pilotRestaurant || access.business_name==='Restaurante Mercado [PRUEBA]') && <a href="/piloto/restaurante" className="mt-3 inline-flex min-h-11 items-center rounded-md border border-gray-300 px-4 text-sm font-bold">Recibir pedidos de prueba</a>}
                {editingBusiness === access.business_id && <div ref={editorRef} tabIndex={-1} className="scroll-mt-4 outline-none"><BusinessEditor key={access.business_id} businessId={access.business_id} onPhotoUpdated={()=>{fetch('/api/negocios',{cache:'no-store'}).then(response=>response.json()).then(result=>setBusinesses(result.businesses || [])).catch(()=>{});}} onCancel={()=>setEditingBusiness('')} onSaved={()=>{
                  setEditingBusiness('');setStatus('Cambios guardados. Tu ficha pública está actualizada.');
                  fetch('/api/negocios',{cache:'no-store'}).then(response=>response.json()).then(result=>setBusinesses(result.businesses || [])).catch(()=>setStatus('Cambios guardados. Recarga para ver la ficha actualizada.'));
                }} /></div>}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
