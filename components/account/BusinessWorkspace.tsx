"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Store,
  ArrowUpRight,
  Plus,
  Camera,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { DirectoryBusiness } from "@/data/directory";
import { directoryMunicipalities } from "@/data/directory";
import { businessPath } from "@/lib/business-public-url";
import { businessCompletion } from "@/lib/account-model";
import { catalogNoun } from "@/lib/catalog-validation";
import { useAccount } from "./AccountSession";
import BusinessEditor from "@/components/BusinessEditor";
import BusinessOrdersLink from "@/components/BusinessOrdersLink";
import BusinessGalleryEditor from "./BusinessGalleryEditor";
import SpecialHoursEditor, { type SpecialHours } from "./SpecialHoursEditor";
type Period = { start: string; end: string };
type Day = { closed: boolean; periods: Period[] };
type Settings = {
  schedule?: Day[];
  specialHours?: SpecialHours;
  logistics?: {
    mode: string;
    available: boolean;
    municipalities: string[];
    hours: string;
    products: string;
    notes: string;
    conditions: string;
  };
  references?: string;
  website?: string;
  contactPreference?: string;
  phone?: string;
  temporaryClosed?: boolean;
  closedUntil?: string;
};
type Detail = {
  editable?: boolean;
  business: DirectoryBusiness | null;
  status: string;
  settings: Settings;
  version: number;
  reviewRequestedAt?: string;
};
type Activity = {
  measuredSince: string | null;
  summary: { views: number; whatsapp: number; calls: number };
  favorites: number;
  requestsCount: number;
  requests: {
    public_id: string;
    statusLabel: string;
    created_at: string;
    customer: string;
    sector?: string;
    address?: string;
    phone?: string;
    mapsUrl?: string;
    description: string;
  }[];
};
const days = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const emptyLog = {
  mode: "none",
  available: false,
  municipalities: ["Nechí"],
  hours: "",
  products: "",
  notes: "",
  conditions: "",
};
export default function BusinessWorkspace({
  directory,
}: {
  directory: DirectoryBusiness[];
}) {
  const { data, session, request, refresh } = useAccount();
  const accesses = data?.businesses || [];
  const userId = session?.user.id;
  const accessKey = accesses.map((a) => a.business_id).join(",");
  const [id, setId] = useState(""),
    [tab, setTab] = useState("Resumen"),
    [result, setResult] = useState<{
      id: string;
      userId: string;
      detail: Detail;
    } | null>(null),
    [settings, setSettings] = useState<Settings>({}),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [period, setPeriod] = useState(30),
    [activity, setActivity] = useState<{
      id: string;
      userId: string;
      data: Activity;
    } | null>(null);
  const sectionRef=useRef<HTMLDivElement|null>(null);
  const scrollAfterTabChange=useRef(false);
  const revealSection=useCallback(()=>{
    const target=sectionRef.current;
    if(!target)return;
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top=Math.max(0,window.scrollY+target.getBoundingClientRect().top-16);
    window.scrollTo({top,behavior:reduceMotion?'auto':'smooth'});
    window.setTimeout(()=>target.focus({preventScroll:true}),reduceMotion?0:400);
  },[]);
  useEffect(() => {
    setId(accessKey.split(",")[0] || "");
    setResult(null);
    setActivity(null);
    setSettings({});
    setNotice("");
    setTab("Resumen");
  }, [userId, accessKey]);
  const access = accesses.find((a) => a.business_id === id),
    allowed = access?.status === "Activo";
  useEffect(() => {
    if (!id || !allowed || !userId) return;
    let active = true;
    setNotice("");
    setResult(null);
    request(`/api/mi-cuenta/negocio/${id}`)
      .then((detail) => {
        if (active) {
          setResult({ id, userId, detail });
          setSettings(detail.settings);
          setVersion(detail.version);
        }
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, allowed, userId, revision, request]);
  useEffect(() => {
    if (
      !id ||
      !allowed ||
      !userId ||
      !["Estadísticas", "Recogidas y entregas"].includes(tab)
    )
      return;
    let active = true;
    setActivity(null);
    request(`/api/mi-cuenta/negocio/${id}/actividad?days=${period}`)
      .then((body) => {
        if (active) setActivity({ id, userId, data: body });
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, allowed, userId, tab, period, request]);
  const detail =
    result?.id === id && result.userId === session?.user.id
      ? result.detail
      : null;
  const business = detail?.business || directory.find((b) => b.id === id),
    stats =
      activity?.id === id && activity.userId === session?.user.id
        ? activity.data
        : null;
  const completion = business ? businessCompletion(business) : null;
  async function save(review = false, continueTo?: string) {
    setBusy(true);
    setNotice("");
    try {
      const saved = await request(`/api/mi-cuenta/negocio/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ settings, version, requestReview: review }),
      });
      setVersion(saved.version);
      setNotice(
        review
          ? "La revisión quedó solicitada en Mercáu."
          : "Configuración guardada.",
      );
      if (continueTo) goToTab(continueTo);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function dayChange(index: number, day: Day) {
    setSettings((current) => ({
      ...current,
      schedule: (
        current.schedule || days.map(() => ({ closed: true, periods: [] }))
      ).map((value, i) => (i === index ? day : value)),
    }));
  }
  const tabs = [
    "Resumen",
    "Información pública",
    "Fotos y logo",
    "Categorías",
    "Horarios",
    "Productos o servicios",
    "Contacto y WhatsApp",
    "Entregas",
    "Recogidas y entregas",
    "Estadísticas",
    "Configuración",
    "Ayuda",
  ];
  const tabIndex=tabs.indexOf(tab);
  const previousTab=tabIndex>0?tabs[tabIndex-1]:null;
  const nextTab=tabIndex<tabs.length-1?tabs[tabIndex+1]:null;
  function goToTab(value:string){
    setNotice("");
    if(value===tab){revealSection();return;}
    scrollAfterTabChange.current=true;
    setTab(value);
  }
  useEffect(()=>{
    if(!scrollAfterTabChange.current)return;
    scrollAfterTabChange.current=false;
    let secondFrame=0;
    const firstFrame=window.requestAnimationFrame(()=>{secondFrame=window.requestAnimationFrame(revealSection);});
    return()=>{window.cancelAnimationFrame(firstFrame);if(secondFrame)window.cancelAnimationFrame(secondFrame);};
  },[tab,revealSection]);
  return (
    <>
      <div className="ma-page-heading">
        <div>
          <p className="ma-eyebrow">TU NEGOCIO EN MERCÁU</p>
          <h1>Panel de mi negocio</h1>
        </div>
        <a className="ma-button" href="/negocios/registro">
          <Plus size={17} />
          {accesses.length ? "Registrar otro negocio" : "Registrar mi negocio"}
        </a>
        {id && allowed && (
          <a className="ma-button primary" href={`/mi-negocio/${id}/catalogo`}>
            <Plus size={17} />
            Agregar primer producto o plato
          </a>
        )}
      </div>
      {!accesses.length ? (
        <div className="ma-empty">
          <Store size={36} />
          <h2>Hagamos visible tu negocio</h2>
          <p>
            Registra un negocio nuevo o abre la invitación privada de la ficha
            que ya tienes. Esta cuenta también puede seguir usándose como
            comprador.
          </p>
          <a className="ma-button primary" href="/negocios/registro">
            Registrar mi negocio
          </a>
          <a href="/mi-cuenta/ayuda" className="ma-text-button">
            Ya está inscrito: cómo reclamarlo
          </a>
        </div>
      ) : (
        <>
          <label className="ma-role-select">
            Negocio
            <select
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setSettings({});
                setNotice("");
              }}
            >
              {accesses.map((a) => (
                <option key={a.business_id} value={a.business_id}>
                  {directory.find((b) => b.id === a.business_id)?.name ||
                    a.business_name}
                </option>
              ))}
            </select>
          </label>
          {!allowed ? (
            <div className="ma-notice error">
              <h2>Acceso {access?.status || "no disponible"}</h2>
              <p>
                Esta ficha no admite cambios con tu permiso actual. Contacta a
                Mercáu para revisar el acceso.
              </p>
            </div>
          ) : !detail ? (
            <p role="status">{notice || "Cargando tu negocio..."}</p>
          ) : detail.editable === false ? (
            <p role="alert" className="ma-notice error">
              Ficha {detail.status.toLowerCase()}. No admite cambios en este
              estado. Contacta a Mercáu para revisar la ficha.
            </p>
          ) : (
            <>
              <div className="ma-business-heading ma-band">
                {business?.photoUrl ? (
                  <img src={business.photoUrl} alt={business.name} />
                ) : (
                  <Camera size={36} />
                )}
                <div>
                  <span className="ma-badge">{detail.status}</span>
                  <h2>{business?.name || access.business_name}</h2>
                  <p className="ma-muted">
                    {business?.municipality || "Ficha pendiente de publicación"}
                  </p>
                </div>
                {business && (
                  <a
                    href={businessPath(business)}
                    target="_blank"
                    rel="noreferrer"
                    className="ma-button"
                  >
                    Ver mi página
                    <ArrowUpRight size={16} />
                  </a>
                )}
              </div>
              <label className="ma-business-mobile-menu">
                Sección de mi negocio
                <select
                  aria-label="Sección de mi negocio"
                  value={tab}
                  onChange={(e) => {
                    goToTab(e.target.value);
                  }}
                >
                  {tabs.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <nav
                className="ma-business-tabs"
                aria-label="Secciones de mi negocio"
              >
                {tabs.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={tab === value}
                    onClick={() => {
                      goToTab(value);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </nav>
              <div ref={sectionRef} tabIndex={-1} className="scroll-mt-4 outline-none">
              {tab === "Resumen" && (
                <>
                  <h2>Tu ficha, lista para tus clientes</h2>
                  {completion ? (
                    <>
                      <div
                        className="ma-progress"
                        role="progressbar"
                        aria-label="Información completada"
                        aria-valuenow={completion.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${completion.percent}%` }} />
                      </div>
                      <p>
                        <strong>
                          {completion.percent} % de información completada
                        </strong>
                      </p>
                      {completion.pending.length ? (
                        <p className="ma-muted">
                          Te falta: {completion.pending.join(", ")}.
                        </p>
                      ) : (
                        <p className="ma-muted">
                          <CheckCircle2 size={16} /> Tu información principal
                          está completa.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="ma-notice">
                      Tu inscripción está pendiente de publicación. Conservamos
                      la vinculación a tu cuenta.
                    </p>
                  )}
                  <div className="ma-actions ma-band">
                    <button
                      className="ma-button primary"
                      onClick={() => goToTab("Información pública")}
                    >
                      Editar ficha
                    </button>
                    <button
                      className="ma-button"
                      onClick={() => goToTab("Fotos y logo")}
                    >
                      Fotos y logo
                    </button>
                    <button
                      className="ma-button"
                      onClick={() => goToTab("Entregas")}
                    >
                      Configurar entregas
                    </button>
                  </div>
                  <BusinessOrdersLink businessId={id} />
                </>
              )}
              {[
                "Información pública",
                "Fotos y logo",
                "Contacto y WhatsApp",
                "Categorías",
              ].includes(tab) &&
                business && (
                  <BusinessEditor
                    key={`${id}-${tab}`}
                    businessId={id}
                    section={
                      tab === "Fotos y logo"
                        ? "photos"
                        : tab === "Contacto y WhatsApp"
                          ? "contact"
                          : tab === "Categorías"
                            ? "categories"
                            : "information"
                    }
                    onSaved={() => {
                      setNotice("Cambios guardados en la ficha pública.");
                      setRevision((v) => v + 1);
                    }}
                    onSaveAndContinue={nextTab?()=>goToTab(nextTab):undefined}
                    onCancel={() => goToTab("Resumen")}
                    onPhotoUpdated={() => setRevision((v) => v + 1)}
                  />
                )}
              {[
                "Información pública",
                "Fotos y logo",
                "Contacto y WhatsApp",
              ].includes(tab) &&
                !business && (
                  <p className="ma-notice">
                    La edición pública estará disponible después de revisar y
                    publicar la inscripción.
                  </p>
                )}
              {tab === "Fotos y logo" && business && (
                <BusinessGalleryEditor
                  businessId={id}
                  onUpdated={() => setRevision((v) => v + 1)}
                />
              )}
              {tab === "Contacto y WhatsApp" && (
                <div className="ma-form ma-divider">
                  <h2>Otros canales de contacto</h2>
                  <label>
                    Teléfono para llamadas (opcional)
                    <input
                      type="tel"
                      maxLength={25}
                      value={settings.phone || ""}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, phone: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Canal preferido
                    <select
                      value={settings.contactPreference || "whatsapp"}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          contactPreference: e.target.value,
                        }))
                      }
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="phone">Llamadas</option>
                    </select>
                  </label>
                  <button
                    className="ma-button primary"
                    disabled={busy}
                    onClick={() => save()}
                  >
                    Guardar canales de contacto
                  </button>
                  <button className="ma-button" disabled={busy} onClick={()=>nextTab&&save(false,nextTab)}>
                    Guardar y continuar
                  </button>
                </div>
              )}
              {tab === "Horarios" && (
                <div className="ma-form">
                  <h2>Horario por día</h2>
                  <p className="ma-muted">
                    Horario actual: {business?.hours || "Pendiente"}. Se
                    conserva hasta que guardes un horario estructurado.
                  </p>
                  {days.map((name, index) => {
                    const day = settings.schedule?.[index] || {
                      closed: true,
                      periods: [],
                    };
                    return (
                      <div className="ma-schedule-day" key={name}>
                        <strong>{name}</strong>
                        <label className="ma-check">
                          <input
                            type="checkbox"
                            checked={day.closed}
                            onChange={(e) =>
                              dayChange(index, {
                                closed: e.target.checked,
                                periods: e.target.checked
                                  ? []
                                  : [{ start: "09:00", end: "18:00" }],
                              })
                            }
                          />
                          Cerrado
                        </label>
                        <div>
                          {!day.closed &&
                            day.periods.map((p, i) => (
                              <div className="ma-time-pair" key={i}>
                                <input
                                  type="time"
                                  aria-label={`Apertura ${name} ${i + 1}`}
                                  value={p.start}
                                  onChange={(e) =>
                                    dayChange(index, {
                                      ...day,
                                      periods: day.periods.map((v, n) =>
                                        n === i
                                          ? { ...v, start: e.target.value }
                                          : v,
                                      ),
                                    })
                                  }
                                />
                                <span>a</span>
                                <input
                                  type="time"
                                  aria-label={`Cierre ${name} ${i + 1}`}
                                  value={p.end}
                                  onChange={(e) =>
                                    dayChange(index, {
                                      ...day,
                                      periods: day.periods.map((v, n) =>
                                        n === i
                                          ? { ...v, end: e.target.value }
                                          : v,
                                      ),
                                    })
                                  }
                                />
                              </div>
                            ))}
                          {!day.closed && day.periods.length < 2 && (
                            <button
                              type="button"
                              className="ma-text-button"
                              onClick={() =>
                                dayChange(index, {
                                  ...day,
                                  periods: [
                                    ...day.periods,
                                    { start: "19:00", end: "22:00" },
                                  ],
                                })
                              }
                            >
                              Agregar segundo horario
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <SpecialHoursEditor
                    value={settings.specialHours || []}
                    onChange={(value) =>
                      setSettings((s) => ({ ...s, specialHours: value }))
                    }
                  />
                  <label className="ma-check">
                    <input
                      type="checkbox"
                      checked={!!settings.temporaryClosed}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          temporaryClosed: e.target.checked,
                        }))
                      }
                    />
                    Cierre temporal o vacaciones
                  </label>
                  {settings.temporaryClosed && (
                    <label>
                      Hasta (opcional)
                      <input
                        type="date"
                        value={settings.closedUntil || ""}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            closedUntil: e.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  <div className="ma-actions">
                    <button
                      className="ma-button primary"
                      disabled={busy}
                      onClick={() => save()}
                    >
                      Guardar horarios
                    </button>
                    <button
                      className="ma-button"
                      disabled={busy}
                      onClick={() => save(false, "Entregas")}
                    >
                      Guardar y continuar
                    </button>
                  </div>
                </div>
              )}
              {tab === "Productos o servicios" && (
                <section>
                  <h2>Mi {business ? catalogNoun(business.category).toLocaleLowerCase("es-CO") : "catálogo"}</h2>
                  <p>
                    Administra los productos y sus fotos en el catálogo de tu
                    negocio.
                  </p>
                  {business ? (
                    <a
                      className="ma-button primary"
                      href={`/mi-negocio/${id}/catalogo`}
                    >
                      Abrir mi {business ? catalogNoun(business.category).toLocaleLowerCase("es-CO") : "catálogo"} <ArrowUpRight size={16} />
                    </a>
                  ) : (
                    <p className="ma-notice">
                      El catálogo se habilitará cuando la ficha esté publicada.
                    </p>
                  )}
                </section>
              )}
              {tab === "Entregas" && (
                <div className="ma-form">
                  <h2>¿Cómo entregas tus pedidos?</h2>
                  <label>
                    Modalidad
                    <select
                      aria-label="Modalidad"
                      value={settings.logistics?.mode || ""}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          logistics: {
                            ...(s.logistics || emptyLog),
                            mode: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="" disabled>
                        Selecciona una opción
                      </option>
                      <option value="none">No tengo domicilios</option>
                      <option value="own">Tengo domiciliario propio</option>
                      <option value="mercau">
                        Quiero utilizar la red logística de Mercáu
                      </option>
                      <option value="both">Utilizo ambas opciones</option>
                    </select>
                  </label>
                  {settings.logistics &&
                    ["mercau", "both"].includes(settings.logistics.mode) && (
                      <>
                        <label className="ma-check">
                          <input
                            type="checkbox"
                            checked={settings.logistics.available}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                logistics: {
                                  ...s.logistics!,
                                  available: e.target.checked,
                                },
                              }))
                            }
                          />
                          Disponible para recogidas con Mercáu
                        </label>
                        <fieldset>
                          <legend>Municipios</legend>
                          {directoryMunicipalities.map((m) => (
                            <label className="ma-check" key={m}>
                              <input
                                type="checkbox"
                                checked={settings.logistics!.municipalities.includes(
                                  m,
                                )}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    logistics: {
                                      ...s.logistics!,
                                      municipalities: e.target.checked
                                        ? [...s.logistics!.municipalities, m]
                                        : s.logistics!.municipalities.filter(
                                            (v) => v !== m,
                                          ),
                                    },
                                  }))
                                }
                              />
                              {m}
                            </label>
                          ))}
                        </fieldset>
                        {(
                          [
                            ["hours", "Horarios de recogida"],
                            ["products", "Tipo de productos"],
                            ["notes", "Observaciones"],
                            ["conditions", "Condiciones de entrega"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <textarea
                              rows={2}
                              maxLength={500}
                              value={settings.logistics![key]}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  logistics: {
                                    ...s.logistics!,
                                    [key]: e.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        ))}
                      </>
                    )}
                  <p className="ma-muted">
                    Configurar una modalidad no confirma disponibilidad de
                    mensajeros ni habilita nuevos municipios operativos.
                  </p>
                  <button
                    className="ma-button primary"
                    disabled={busy || !settings.logistics}
                    onClick={() => save()}
                  >
                    Guardar entregas
                  </button>
                  <button className="ma-button" disabled={busy || !settings.logistics} onClick={()=>nextTab&&save(false,nextTab)}>
                    Guardar y continuar
                  </button>
                </div>
              )}
              {["Recogidas y entregas", "Estadísticas"].includes(tab) && (
                <>
                  <label className="ma-role-select">
                    Periodo
                    <select
                      value={period}
                      onChange={(e) => setPeriod(Number(e.target.value))}
                    >
                      {[7, 30, 90].map((p) => (
                        <option key={p} value={p}>
                          Últimos {p} días
                        </option>
                      ))}
                    </select>
                  </label>
                  {!stats ? (
                    <p role="status">{notice || "Cargando actividad..."}</p>
                  ) : tab === "Estadísticas" ? (
                    <>
                      <h2 className="ma-band">Tu negocio en cifras</h2>
                      {!stats.measuredSince && (
                        <p className="ma-notice">
                          Todavía no hay eventos medidos en este periodo. No se
                          reconstruyen visitas históricas ni conversaciones de
                          WhatsApp.
                        </p>
                      )}
                      <div className="ma-summary">
                        <div>
                          <strong>{stats.summary.views}</strong>
                          <p>Visitas medidas a la ficha</p>
                        </div>
                        <div>
                          <strong>{stats.summary.whatsapp}</strong>
                          <p>Clics en WhatsApp</p>
                        </div>
                        <div>
                          <strong>{stats.summary.calls}</strong>
                          <p>Clics para llamar</p>
                        </div>
                      </div>
                      <p>
                        Tu negocio fue guardado {stats.favorites} veces en
                        cuentas durante este periodo.
                      </p>
                      <p>
                        {stats.requestsCount} recogidas y entregas asociadas.
                      </p>
                      <p className="ma-muted">
                        Un clic no confirma una llamada ni una conversación. Se
                        muestran datos agregados, sin identidades ni búsquedas
                        de compradores.
                      </p>
                    </>
                  ) : stats.requests.length ? (
                    <div className="ma-list ma-band">
                      {stats.requests.map((r) => (
                        <article className="ma-list-item" key={r.public_id}>
                          <div className="ma-section-heading">
                            <strong>{r.public_id}</strong>
                            <span className="ma-badge">{r.statusLabel}</span>
                          </div>
                          <p>
                            {r.customer} · {r.sector}
                          </p>
                          <p>{r.description}</p>
                          {r.address && <p>{r.address}</p>}
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              className="ma-text-button"
                            >
                              Contacto de entrega
                            </a>
                          )}
                          {r.mapsUrl && (
                            <a
                              href={r.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ma-text-button"
                            >
                              Abrir entrega en Google Maps
                            </a>
                          )}
                          <small>
                            {new Date(r.created_at).toLocaleString("es-CO", {
                              timeZone: "America/Bogota",
                            })}
                          </small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="ma-empty">
                      <TruckIcon />
                      <h2>Aún no tienes recogidas ni entregas</h2>
                      <p>
                        Aparecerán las solicitudes asociadas a esta ficha, no
                        las de otros negocios.
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "Configuración" && (
                <div className="ma-form">
                  <h2>Configuración de la ficha</h2>
                  <label>
                    Sitio web
                    <input
                      type="url"
                      value={settings.website || ""}
                      maxLength={240}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, website: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Referencias del establecimiento
                    <textarea
                      value={settings.references || ""}
                      maxLength={500}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          references: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="ma-actions">
                    <button
                      className="ma-button primary"
                      disabled={busy}
                      onClick={() => save()}
                    >
                      Guardar cambios
                    </button>
                    <button className="ma-button" disabled={busy} onClick={()=>nextTab&&save(false,nextTab)}>
                      Guardar y continuar
                    </button>
                    <button
                      className="ma-button"
                      disabled={busy}
                      onClick={() => {
                        setSettings(detail.settings);
                        setNotice("Cambios descartados.");
                      }}
                    >
                      Cancelar
                    </button>
                    {!business && (
                      <button
                        className="ma-button"
                        disabled={busy}
                        onClick={() => save(true)}
                      >
                        Solicitar revisión
                      </button>
                    )}
                  </div>
                  {business && (
                    <p className="ma-muted">
                      Los cambios autorizados de una ficha publicada se guardan
                      directamente. No necesitas solicitar revisión de nuevo.
                    </p>
                  )}
                </div>
              )}
              {tab === "Ayuda" && (
                <section>
                  <h2>Administrar tu negocio</h2>
                  <p>
                    Tu acceso está asociado a esta cuenta. La invitación privada
                    no debe compartirse.
                  </p>
                  <p>
                    Para cambios de propietario, suspensiones o datos
                    protegidos, solicita revisión a Mercáu.
                  </p>
                  <a className="ma-text-button" href="/mi-cuenta/ayuda">
                    Abrir ayuda de Mi cuenta
                  </a>
                </section>
              )}
              <nav className="ma-band mt-6 flex flex-col gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Navegación entre secciones del negocio">
                <button type="button" className="ma-button" disabled={!previousTab} onClick={()=>previousTab&&goToTab(previousTab)}>
                  <ArrowLeft size={17}/>
                  {previousTab?`Anterior: ${previousTab}`:'Primera sección'}
                </button>
                <p className="ma-muted text-center text-sm font-bold">Sección {tabIndex+1} de {tabs.length}</p>
                <button type="button" className="ma-button primary" disabled={!nextTab} onClick={()=>nextTab&&goToTab(nextTab)}>
                  {nextTab?`Siguiente: ${nextTab}`:'Última sección'}
                  <ArrowRight size={17}/>
                </button>
              </nav>
              </div>
            </>
          )}
          {notice && (
            <p className="ma-notice" role="status">
              {notice}
            </p>
          )}
          <button
            className="ma-text-button"
            onClick={() => {
              setRevision((v) => v + 1);
              refresh();
            }}
          >
            <RefreshCw size={16} />
            Actualizar mi negocio
          </button>
        </>
      )}
    </>
  );
}
function TruckIcon() {
  return <Store size={30} />;
}
