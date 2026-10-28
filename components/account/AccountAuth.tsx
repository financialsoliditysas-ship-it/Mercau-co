"use client";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, ArrowLeft, ShoppingBag, Store } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { directoryMunicipalities } from "@/data/directory";
import { useAccount } from "./AccountSession";
import BirthDateField from "./BirthDateField";
import { birthDateError, isBirthDateMessage } from "@/lib/account-age";
import { trackPublicMetric } from "@/lib/marketing-attribution";
const terms = process.env.NEXT_PUBLIC_TERMS_URL || "/terminos-y-condiciones",
  privacy =
    process.env.NEXT_PUBLIC_PRIVACY_URL ||
    "/politica-de-tratamiento-de-datos";
export default function AccountAuth({ businessOnly = false }: { businessOnly?: boolean }) {
  const { recovering } = useAccount();
  const [mode, setMode] = useState<"login" | "register" | "recover">(businessOnly ? "register" : "login"),
    [intent, setIntent] = useState<"buyer" | "business" | "">("");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [phone, setPhone] = useState(""),
    [birthDate, setBirthDate] = useState(""),
    [municipality, setMunicipality] = useState("Nechí"),
    [sector, setSector] = useState("");
  const [show, setShow] = useState(false),
    [accepted, setAccepted] = useState(false),
    [authorized, setAuthorized] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  function returnPath() {
    const candidate = new URLSearchParams(window.location.search).get("returnTo") || "";
    return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "";
  }
  useEffect(() => {
    if (businessOnly) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");
    if (params.get("intent") === "buyer") setIntent("buyer");
  }, [businessOnly]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) {
      setNotice("El acceso a cuentas no está configurado en esta vista.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      if (recovering) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        window.location.replace(businessOnly ? "/negocios/registro" : returnPath() || "/mi-cuenta/comprador");
        return;
      }
      if (mode === "register") {
        const ageError = birthDateError(birthDate);
        if (ageError) throw new Error(ageError);
        const selectedIntent = businessOnly ? "business" : intent;
        if (!selectedIntent || !accepted || !authorized)
          throw new Error("Completa el perfil y ambas autorizaciones.");
        if (!terms || !privacy)
          throw new Error(
            "El nuevo registro está pendiente de los documentos legales de Mercáu. Puedes entrar con una cuenta existente.",
          );
        const digits = phone.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
        if (!/^3\d{9}$/.test(digits))
          throw new Error("Escribe un celular colombiano de 10 dígitos.");
        const destination = returnPath();
        const next = selectedIntent === "business"
          ? "?next=inscribir-negocio"
          : destination
            ? `?returnTo=${encodeURIComponent(destination)}`
            : "";
        const { error, data } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: businessOnly
              ? `${window.location.origin}/negocios/registro?continuar=negocio`
              : `${window.location.origin}/mi-cuenta${next}`,
            data: {
              name: name.trim(),
              birth_date: birthDate,
              account_intent: selectedIntent === "business" ? "business" : "personal",
              delivery_profile: {
                name: name.trim(),
                phone: `+57${digits}`,
                municipality,
                neighborhood: sector.trim(),
                address: "",
                instructions: "",
              },
              consent: {
                terms: true,
                privacy: true,
                terms_url: terms,
                privacy_url: privacy,
              },
            },
          },
        });
        if (error) throw error;
        localStorage.setItem("mercau:signup-pending:v1", new Date().toISOString());
        trackPublicMetric("Registro usuario iniciado", {
          notes: `intent=${selectedIntent}`
        });
        setPassword("");
        if (data.session) {
          trackPublicMetric("Cuenta confirmada", {
            notes: `intent=${selectedIntent}`
          });
          localStorage.removeItem("mercau:signup-pending:v1");
          window.location.assign(
            businessOnly
              ? "/negocios/registro"
              : selectedIntent === "business"
              ? "/negocios/registro"
              : destination || "/mi-cuenta/comprador",
          );
          return;
        }
        setNotice(
          "Revisa tu correo para confirmar la cuenta. Si ya tienes una, entra o recupera tu contraseña.",
        );
      } else if (mode === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: businessOnly
              ? `${window.location.origin}/negocios/registro?continuar=negocio`
              : `${window.location.origin}/mi-cuenta` },
        );
        if (error) throw error;
        setNotice(
          "Si existe una cuenta con este correo, recibirás instrucciones para recuperar el acceso.",
        );
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setPassword("");
        if (businessOnly) window.location.assign("/negocios/registro");
        else {
          const destination = returnPath();
          if (destination) window.location.assign(destination);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setNotice(
        /^(Completa|Escribe|El nuevo)/.test(message) ||
          isBirthDateMessage(message)
          ? message
          : "No pudimos completar el acceso. Revisa correo, contraseña y confirmación del correo, o intenta más tarde.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ma-auth">
      <div className="ma-auth-intro">
        <img src="/logo-mercau.png" alt="Mercáu" width="64" height="64" />
        <p className="ma-eyebrow">TU CUENTA MERCÁU</p>
        <h1>
          Todo lo tuyo,
          <br />
          en un solo lugar.
        </h1>
        <p>Tus favoritos, tus envíos y tu negocio.</p>
        <a href="/">
          <ArrowLeft size={18} /> Volver al directorio
        </a>
      </div>
      <section className="ma-auth-form">
        {!recovering && (
          <div className="ma-segment" aria-label="Acceso">
            {(["login", "register"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setNotice("");
                  setPassword("");
                }}
              >
                {value === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            ))}
          </div>
        )}
        <h2>
          {recovering
            ? "Nueva contraseña"
            : mode === "register"
              ? "Crea tu cuenta"
              : mode === "recover"
                ? "Recupera tu acceso"
                : "Qué bueno verte de nuevo"}
        </h2>
        <form onSubmit={submit} className="ma-form">
          {mode === "register" && !recovering && (
            <>
              {!businessOnly && <fieldset className="ma-intents">
                <legend>¿Cómo quieres usar Mercáu?</legend>
                {[
                  {
                    id: "buyer",
                    Icon: ShoppingBag,
                    title: "Soy comprador",
                    description:
                      "Quiero buscar negocios, guardar favoritos y solicitar productos o servicios.",
                  },
                  {
                    id: "business",
                    Icon: Store,
                    title: "Soy dueño de negocio",
                    description:
                      "Quiero administrar la ficha de mi negocio, recibir clientes y gestionar entregas.",
                  },
                ].map(({ id, Icon, title, description }) => (
                  <label key={id} className={intent === id ? "selected" : ""}>
                    <input
                      type="radio"
                      required
                      name="intent"
                      checked={intent === id}
                      onChange={() => setIntent(id as "buyer" | "business")}
                    />
                    <Icon size={22} />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>}
              <label>
                Nombre completo
                <input
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Teléfono o WhatsApp
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={30}
                />
              </label>
              <BirthDateField value={birthDate} onChange={setBirthDate} />
            </>
          )}
          {!recovering && (
            <label>
              Correo electrónico
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
              />
            </label>
          )}
          {(recovering || mode !== "recover") && (
            <label>
              Contraseña
              <div className="ma-password">
                <input
                  required
                  type={show ? "text" : "password"}
                  minLength={recovering || mode === "register" ? 8 : undefined}
                  maxLength={128}
                  autoComplete={
                    recovering || mode === "register"
                      ? "new-password"
                      : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={
                    show ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={show}
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
          )}
          {mode === "register" && !recovering && (
            <>
              <div className="ma-form-grid">
                <label>
                  Municipio
                  <select
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                  >
                    {directoryMunicipalities.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Barrio o sector
                  <input
                    required
                    maxLength={120}
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                  />
                </label>
              </div>
              <label className="ma-check">
                <input
                  required
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  Acepto{" "}
                  <a href={terms} target="_blank" rel="noreferrer">
                    los términos y condiciones
                  </a>
                </span>
              </label>
              <label className="ma-check">
                <input
                  required
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />
                <span>
                  Autorizo{" "}
                  <a href={privacy} target="_blank" rel="noreferrer">
                    el tratamiento de mis datos
                  </a>
                </span>
              </label>
            </>
          )}
          <button className="ma-button primary" disabled={busy} type="submit">
            {busy
              ? "Un momento..."
              : recovering
                ? "Guardar contraseña"
                : mode === "register"
                  ? "Crear mi cuenta"
                  : mode === "recover"
                    ? "Enviar instrucciones"
                    : "Entrar a Mercáu"}
          </button>
        </form>
        {!recovering && (
          <button
            className="ma-text-button"
            type="button"
            onClick={() => {
              setMode(mode === "recover" ? "login" : "recover");
              setNotice("");
            }}
          >
            {mode === "recover" ? "Volver a entrar" : "Olvidé mi contraseña"}
          </button>
        )}
        {notice && (
          <p role="status" className="ma-notice">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
}
