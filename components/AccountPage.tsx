"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AccountPanel from "./AccountPanel";
import BusinessRegistration from "./BusinessRegistration";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function AccountPage({ registration = false }: { registration?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) { setReady(true); return; }
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (_event === 'PASSWORD_RECOVERY') setRecovering(true);
      setUser(session?.user || null); setReady(true);
    });
    client.auth.getSession().then(({ data }) => {
      if (active) { setUser(data.session?.user || null); setReady(true); }
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!ready || recovering) return;
    if (registration && !user) window.location.replace('/mi-cuenta?next=inscribir-negocio');
    if (!registration && user && new URLSearchParams(window.location.search).get('next') === 'inscribir-negocio' && !window.location.hash.includes('type=recovery')) {
      window.location.replace('/mi-cuenta/inscribir-negocio');
    }
  }, [ready, user, registration, recovering]);
  return <main className="min-h-screen bg-[#FCFBF9] pb-10 text-[#1F2937]">
    <header className="border-b border-gray-200 bg-white"><nav aria-label="Navegación de cuenta" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4"><a href="/" className="flex items-center gap-3"><img src="/logo-mercau.png" alt="Mercáu" width="44" height="44" /><strong className="text-xl text-[#D82016]">Mercáu</strong></a><a className="min-h-11 py-3 font-semibold" href={registration ? "/mi-cuenta" : "/"}>{registration ? "Mi cuenta" : "Volver al directorio"}</a></nav></header>
    {!ready ? <p role="status" className="p-6">Cargando tu cuenta...</p> : registration ? user ? <BusinessRegistration /> : <p role="status" className="p-6">Abriendo el acceso a tu cuenta...</p> : <AccountPanel user={user} />}
  </main>;
}
