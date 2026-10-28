"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { directoryMunicipalities } from "@/data/directory";
import "./account-panel.css";
import BirthDateField from "./account/BirthDateField";
import { birthDateError, isBirthDateMessage } from "@/lib/account-age";

const empty = { name: "", phone: "", address: "", municipality: "", neighborhood: "", instructions: "" };

export default function AccountPanel({ user }: { user: User | null }) {
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [profile, setProfile] = useState(empty);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [restaurantManager, setRestaurantManager] = useState(false);
  const [intent, setIntent] = useState<'personal' | 'business'>('personal');
  const [businessAccesses, setBusinessAccesses] = useState<{ business_id: string; business_name: string }[]>([]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('next') === 'inscribir-negocio') setIntent('business');
  }, []);
  useEffect(() => {
    let active = true;
    setRestaurantManager(false);
    setBusinessAccesses([]);
    if (user) getSupabaseBrowserClient()?.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const response = await fetch('/api/piloto/restaurante?mode=manager', { cache: 'no-store', headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (active) setRestaurantManager(response.ok);
    }).catch(() => {});
    if (user) getSupabaseBrowserClient()?.from('business_admins').select('business_id,business_name').eq('user_id', user.id).eq('status', 'Activo').then(({ data, error }) => {
      if (active && !error) setBusinessAccesses(data || []);
    });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    const data = user?.user_metadata?.delivery_profile || {};
    setProfile(Object.fromEntries(Object.keys(empty).map(key => [key, typeof data[key] === "string" ? data[key] : key === 'name' && typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : ""])) as typeof empty);
    setEmail(user?.email || "");
    setPassword("");
  }, [user]);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    const subscription = client?.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) { setNotice("La conexión de cuentas no está disponible."); return; }
    setBusy(true); setNotice("");
    try {
      if (recovery) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setRecovery(false); setPassword(""); setNotice("Contraseña actualizada.");
      } else if (user || mode === "register") {
        const digits = profile.phone.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
        if (user && digits && !/^3\d{9}$/.test(digits)) throw new Error("Ingresa un celular colombiano de 10 dígitos.");
        const data = user
          ? { delivery_profile: { ...profile, name: profile.name.trim(), phone: digits ? `+57${digits}` : '', address: profile.address.trim() } }
          : { name: profile.name.trim(), account_intent: intent, delivery_profile: { ...profile, name: profile.name.trim(), address: profile.address.trim() } };
        if (user) {
          const { error } = await client.auth.updateUser({ data });
          if (error) throw error;
          setNotice("Tus datos y tu dirección quedaron guardados.");
        } else {
          const ageError = birthDateError(birthDate);
          if (ageError) throw new Error(ageError);
          const next = intent === 'business' ? '?next=inscribir-negocio' : '';
          window.history.replaceState(null, '', `/mi-cuenta${next}`);
          const { data: result, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: {...data, birth_date: birthDate}, emailRedirectTo: `${window.location.origin}/mi-cuenta${next}` } });
          if (error) throw error;
          setPassword("");
          setNotice(result.session ? "Cuenta creada." : "Revisa tu correo para confirmar el registro. Si ya tienes cuenta, entra o recupera tu contraseña.");
        }
      } else if (mode === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/mi-cuenta` });
        if (error) throw error;
        setNotice("Si el correo tiene una cuenta, recibirás instrucciones para recuperar el acceso.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword("");
      }
    } catch (error) {
      setNotice(error instanceof Error && (error.message.startsWith("Ingresa") || isBirthDateMessage(error.message)) ? error.message : "No se pudo completar la solicitud. Revisa tus datos, la confirmación del correo o intenta más tarde.");
    } finally { setBusy(false); }
  }
  const showProfile = !recovery && !!user;
  const showName = !recovery && (!!user || mode === 'register');
  const hasBusiness = businessAccesses.length > 0 || restaurantManager;
  const wantsBusiness = user?.user_metadata?.account_intent === 'business';
  return <section id="cuenta" className="account-panel">
    <header className="account-heading"><div><p>MI CUENTA</p><h2>{user ? `Hola${profile.name ? `, ${profile.name.split(" ")[0]}` : ""}` : "Tu cuenta en Mercáu"}</h2><span>{user ? user.email : "Una sola cuenta para tus pedidos, favoritos y negocio."}</span></div>{user && <button type="button" disabled={busy} onClick={async () => { await getSupabaseBrowserClient()?.auth.signOut(); setNotice(""); }}>Cerrar sesión</button>}</header>
    <div className="account-layout">
      {user && !recovery && <nav className="account-navigation" aria-label="Opciones de mi cuenta">
        <a href="/#favoritos">Mis favoritos <span>Volver a los negocios guardados</span></a>
        <a href="/mi-cuenta/pedidos">Mis pedidos <span>Consultar el estado de mis pedidos</span></a>
        <a href="#mis-datos">Mis datos y dirección <span>Datos de contacto y entrega</span></a>
        {hasBusiness && <a href="/mi-negocio">Panel de mi negocio <span>{businessAccesses.map(b => b.business_name).filter(Boolean).join(' · ') || 'Administrar mi ficha'}</span></a>}
        {restaurantManager && <a href="/piloto/restaurante">Recibir pedidos de prueba <span>Aceptar y gestionar pedidos del Restaurante Mercado</span></a>}
        {wantsBusiness && <a href="/mi-cuenta/inscribir-negocio">{hasBusiness ? 'Registrar otro negocio' : 'Registrar mi negocio'} <span>Solicitud de publicación gratuita</span></a>}
      </nav>}
      <div className="account-form-area">
        {!user && !recovery && <div className="account-tabs" aria-label="Acceso a la cuenta">{([['login','Entrar'],['register','Crear cuenta']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setNotice(""); setPassword(""); }}>{label}</button>)}</div>}
        <h3 id="mis-datos">{recovery ? "Nueva contraseña" : user ? "Mis datos y dirección de entrega" : mode === "register" ? "Crea tu cuenta" : mode === "recover" ? "Recupera tu acceso" : "Bienvenido de nuevo"}</h3>
        <form onSubmit={submit} className="account-form">
          {!user && !recovery && mode === 'register' && <fieldset className="account-wide account-intent"><legend>¿Para qué quieres usar Mercáu?</legend>
            <label><input type="radio" name="accountIntent" value="personal" checked={intent === 'personal'} onChange={() => setIntent('personal')} />Quiero pedir y guardar favoritos</label>
            <label><input type="radio" name="accountIntent" value="business" checked={intent === 'business'} onChange={() => setIntent('business')} />Quiero registrar mi negocio</label>
          </fieldset>}
          {showName && <>
            <label>Nombre completo<input required maxLength={100} autoComplete="name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /></label>
            {showProfile && <label>Celular / WhatsApp<input type="tel" maxLength={20} autoComplete="tel" placeholder="300 123 4567" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} /></label>}
          </>}
          {!user && !recovery && <label className="account-wide">Correo electrónico<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
          {!user && !recovery && mode === 'register' && <BirthDateField value={birthDate} onChange={setBirthDate} className="account-wide"/>}
          {(!user && mode !== "recover" || recovery) && <label className="account-wide">Contraseña<input type="password" required minLength={mode === 'register' || recovery ? 8 : undefined} maxLength={128} autoComplete={mode === "register" || recovery ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /></label>}
          {(showProfile || !recovery && mode === 'register') && <>
            <label>Municipio<select required={!user} value={profile.municipality} onChange={e => setProfile(p => ({ ...p, municipality: e.target.value }))}><option value="">Selecciona tu municipio</option>{directoryMunicipalities.map(m => <option key={m}>{m}</option>)}</select></label>
            <label>Barrio o sector<input maxLength={120} autoComplete="address-level3" value={profile.neighborhood} onChange={e => setProfile(p => ({ ...p, neighborhood: e.target.value }))} /></label>
            <label className="account-wide">Dirección de entrega<input required={!user} maxLength={240} autoComplete="street-address" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} /></label>
            <label className="account-wide">Referencia para llegar (opcional)<input maxLength={400} value={profile.instructions} onChange={e => setProfile(p => ({ ...p, instructions: e.target.value }))} /></label>
          </>}
          <button className="account-primary account-wide" disabled={busy} type="submit">{busy ? "Procesando..." : recovery ? "Guardar contraseña" : user ? "Guardar mis datos" : mode === "register" ? "Crear mi cuenta" : mode === "recover" ? "Enviar instrucciones" : "Entrar"}</button>
        </form>
        {!user && !recovery && <button className="account-recover" type="button" onClick={() => { setMode(mode === "recover" ? "login" : "recover"); setNotice(""); }}>{mode === "recover" ? "Volver a entrar" : "Olvidé mi contraseña"}</button>}
        {notice && <p className="account-notice" role="status">{notice}</p>}
      </div>
    </div>
  </section>;
}
