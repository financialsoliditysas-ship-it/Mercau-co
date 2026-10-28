"use client";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useAccount } from "./AccountSession";
import { emptyAccountProfile } from "@/lib/account-model";
import { directoryMunicipalities } from "@/data/directory";
import { getSupabaseBrowserClient } from "@/lib/supabase";
export default function AccountProfile() {
  const { data, session, request, refresh } = useAccount(),
    [profile, setProfile] = useState(emptyAccountProfile),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState("");
  useEffect(() => {
    if (data) {
      setProfile({ ...emptyAccountProfile, ...data.profile });
      setVersion(data.version);
    }
    setEmail(session?.user.email || "");
    setPassword("");
  }, [data, session?.user.id, session?.user.email]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await request("/api/mi-cuenta", {
        method: "PATCH",
        body: JSON.stringify({ profile, version }),
      });
      setVersion(result.version);
      setNotice("Tus datos quedaron guardados.");
      // Refresh the SDK metadata also used by the existing checkout.
      try {
        const refreshed =
          await getSupabaseBrowserClient()?.auth.refreshSession();
        if (refreshed?.error)
          setNotice(
            "Tus datos quedaron guardados. Vuelve a entrar para usarlos en próximos pedidos.",
          );
      } catch {
        setNotice(
          "Tus datos quedaron guardados. Vuelve a entrar para usarlos en próximos pedidos.",
        );
      }
      refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function credentials(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw Error();
      const { error } = await client.auth.updateUser({
        ...(email !== session?.user.email ? { email } : {}),
        ...(password ? { password } : {}),
      });
      if (error) throw error;
      setPassword("");
      setNotice(
        "Solicitud guardada. Revisa el correo si cambiaste la dirección de acceso.",
      );
    } catch {
      setNotice(
        "No se pudo actualizar el acceso. Inicia sesión nuevamente e intenta otra vez.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="ma-page-heading">
        <p className="ma-eyebrow">MI PERFIL</p>
        <h1>Tus datos, a tu manera</h1>
        <p>Completa una dirección cuando la necesites para una entrega.</p>
      </div>
      <form className="ma-form ma-profile-form" onSubmit={save}>
        <h2>Información personal</h2>
        <div className="ma-form-grid">
          {(
            [
              ["name", "Nombre completo", true],
              ["phone", "Teléfono", false],
              ["whatsapp", "WhatsApp", false],
              ["neighborhood", "Barrio o sector", false],
            ] as const
          ).map(([key, label, required]) => (
            <label key={key}>
              {label}
              <input
                required={required}
                value={profile[key]}
                maxLength={key === "phone" || key === "whatsapp" ? 30 : 120}
                type={key === "phone" || key === "whatsapp" ? "tel" : "text"}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          <label>
            Municipio
            <select
              required
              value={profile.municipality}
              onChange={(e) =>
                setProfile((p) => ({ ...p, municipality: e.target.value }))
              }
            >
              <option value="">Selecciona</option>
              {directoryMunicipalities.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <h2>Direcciones de entrega</h2>
        <label>
          Dirección principal (opcional)
          <input
            value={profile.address}
            maxLength={240}
            onChange={(e) =>
              setProfile((p) => ({ ...p, address: e.target.value }))
            }
          />
        </label>
        <label>
          Referencia para llegar
          <input
            maxLength={400}
            value={profile.instructions}
            onChange={(e) =>
              setProfile((p) => ({ ...p, instructions: e.target.value }))
            }
          />
        </label>
        {profile.addresses.map((address, index) => (
          <div key={index} className="ma-address-row">
            <label>
              Nombre
              <input
                required
                maxLength={40}
                value={address.label}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    addresses: p.addresses.map((a, i) =>
                      i === index ? { ...a, label: e.target.value } : a,
                    ),
                  }))
                }
              />
            </label>
            <label>
              Dirección
              <input
                required
                maxLength={240}
                value={address.address}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    addresses: p.addresses.map((a, i) =>
                      i === index ? { ...a, address: e.target.value } : a,
                    ),
                  }))
                }
              />
            </label>
            <label>
              Municipio
              <select
                value={address.municipality}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    addresses: p.addresses.map((a, i) =>
                      i === index ? { ...a, municipality: e.target.value } : a,
                    ),
                  }))
                }
              >
                {directoryMunicipalities.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <button
              title="Eliminar dirección"
              aria-label={`Eliminar dirección ${index + 1}`}
              type="button"
              onClick={() =>
                setProfile((p) => ({
                  ...p,
                  addresses: p.addresses.filter((_, i) => i !== index),
                }))
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ma-button"
          disabled={profile.addresses.length >= 5}
          onClick={() =>
            setProfile((p) => ({
              ...p,
              addresses: [
                ...p.addresses,
                {
                  label: "",
                  address: "",
                  municipality: p.municipality || "Nechí",
                },
              ],
            }))
          }
        >
          <Plus size={18} />
          Agregar dirección
        </button>
        <h2>Preferencias de notificaciones</h2>
        {(
          [
            ["orders", "Actualizaciones de pedidos"],
            ["deliveries", "Actualizaciones de envíos"],
            ["marketing", "Novedades y promociones"],
          ] as const
        ).map(([key, label]) => (
          <label className="ma-check" key={key}>
            <input
              type="checkbox"
              checked={profile.notifications[key]}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  notifications: {
                    ...p.notifications,
                    [key]: e.target.checked,
                  },
                }))
              }
            />
            {label}
          </label>
        ))}
        <p className="ma-muted">
          Estas preferencias se guardan en tu cuenta. No activan un servicio
          nuevo de correo o WhatsApp.
        </p>
        <button type="submit" className="ma-button primary" disabled={busy}>
          Guardar mis datos
        </button>
      </form>
      <form
        className="ma-form ma-profile-form ma-divider"
        onSubmit={credentials}
      >
        <h2>Acceso y seguridad</h2>
        <label>
          Correo electrónico
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Nueva contraseña
          <div className="ma-password">
            <input
              minLength={8}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <button
          className="ma-button"
          disabled={busy || (!password && email === session?.user.email)}
        >
          Actualizar acceso
        </button>
      </form>
      <section className="ma-divider">
        <h2>Privacidad</h2>
        <p>
          Para consultar, corregir o solicitar la eliminación de tus datos, usa
          la ayuda de Mercáu.
        </p>
        <a href="/mi-cuenta/ayuda" className="ma-text-button">
          Consultar ayuda y privacidad
        </a>
      </section>
      {notice && (
        <p className="ma-notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
