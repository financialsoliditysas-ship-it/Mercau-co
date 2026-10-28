"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Heart,
  MapPin,
  Package,
  Search,
  Store,
  Truck,
  Bell,
  RefreshCw,
} from "lucide-react";
import type { DirectoryBusiness } from "@/data/directory";
import { businessPath } from "@/lib/business-public-url";
import { useAccount } from "./AccountSession";
import AccountShell from "./AccountShell";
import AccountAuth from "./AccountAuth";
import AccountProfile from "./AccountProfile";
import BusinessWorkspace from "./BusinessWorkspace";
import { useFavorites } from "./useFavorites";
import CustomerOrderCard from "@/components/CustomerOrderCard";
import type { CustomerOrder } from "@/lib/customer-order-status";
import BusinessRegistration from "@/components/BusinessRegistration";
import CatalogPhotoHelp from "@/components/CatalogPhotoHelp";
import "@/components/restaurant-pilot.css";
type Delivery = {
  public_id: string;
  service_type: string;
  pickup_name: string;
  pickup_neighborhood: string;
  delivery_neighborhood: string;
  delivery_fee: number;
  statusLabel: string;
  created_at: string;
};
type Notice = {
  id: string;
  title: string;
  body: string;
  href?: string;
  created_at: string;
  read_at?: string;
};
export default function AccountHub({ section }: { section: string }) {
  const account = useAccount(),
    { session, data, ready, recovering, request } = account;
  const userId = session?.user.id;
  const favorites = useFavorites(userId);
  const [directory, setDirectory] = useState<DirectoryBusiness[]>([]),
    [publicError, setPublicError] = useState(""),
    [resource, setResource] = useState<{
      userId: string;
      deliveries?: Delivery[];
      orders?: CustomerOrder[];
      notifications?: Notice[];
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    if (!ready || recovering || section !== "inicio") return;
    if (new URLSearchParams(window.location.search).get("next") === "inscribir-negocio") {
      window.location.replace(`/negocios/registro${window.location.hash}`);
    }
  }, [ready, recovering, section]);
  useEffect(() => {
    if (
      !ready ||
      recovering ||
      !userId ||
      !data ||
      section !== "inicio" ||
      window.location.hash.includes("type=recovery")
    )
      return;
    const next = new URLSearchParams(window.location.search).get("next");
    const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "";
    if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      window.location.replace(returnTo);
      return;
    }
    const hasBusiness = data.roles.includes("business_owner");
    window.location.replace(
      next === "inscribir-negocio"
        ? "/negocios/registro"
        : hasBusiness
          ? "/mi-cuenta/negocio"
          : "/mi-cuenta/comprador",
    );
  }, [ready, userId, recovering, section, data, session]);
  useEffect(() => {
    if (!ready || recovering || !userId || !data) return;
    const hasBusiness = data.roles.includes("business_owner");
    if (section === "negocio" && !hasBusiness) {
      window.location.replace("/mi-cuenta/comprador");
      return;
    }
  }, [ready, recovering, userId, data, session, section]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setDirectory([]);
    setPublicError("");
    fetch("/api/negocios", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then((body) => {
        if (active) setDirectory(body.businesses || []);
      })
      .catch(() => {
        if (active)
          setPublicError(
            "No se pudieron cargar los negocios. Intenta nuevamente.",
          );
      });
    try {
      const ids = JSON.parse(
        localStorage.getItem(`mercau.recent.v2.${userId}`) || "[]",
      );
      setRecent(
        Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
      );
    } catch {
      setRecent([]);
    }
    return () => {
      active = false;
    };
  }, [userId, revision]);
  useEffect(() => {
    setError("");
    if (
      !userId ||
      !["comprador", "envios", "pedidos", "notificaciones"].includes(section)
    ) {
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const paths =
      section === "comprador"
        ? ["envios", "pedidos", "notificaciones"]
        : [section];
    Promise.all(
      paths.map(
        async (path) =>
          [
            path,
            await request(`/api/mi-cuenta/${path}`, {
              signal: controller.signal,
            }),
          ] as const,
      ),
    )
      .then((values) => {
        if (active) {
          const next: {
            userId: string;
            deliveries?: Delivery[];
            orders?: CustomerOrder[];
            notifications?: Notice[];
          } = { userId };
          for (const [path, result] of values) {
            if (path === "envios") next.deliveries = result.deliveries;
            if (path === "pedidos") next.orders = result.orders;
            if (path === "notificaciones")
              next.notifications = result.notifications;
          }
          setResource(next);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, section, revision, request]);
  const current = resource?.userId === session?.user.id ? resource : null;
  const money = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n);
  const date = (value: string) =>
    new Date(value).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "medium",
      timeStyle: "short",
    });
  const actions = (
    <div className="ma-actions">
      <a className="ma-button primary" href="/#directorio">
        <Search size={18} />
        Explorar negocios
      </a>
      <a className="ma-button" href="/enviar">
        <Truck size={18} />
        Solicitar envío
      </a>
    </div>
  );
  const empty = (
    <div className="ma-empty">
      <Package size={36} />
      <h2>Aún no tienes actividad en Mercáu.</h2>
      <p>Encuentra un negocio, guarda un favorito o solicita un envío.</p>
      {actions}
      <a className="ma-text-button" href="/#directorio">
        Guardar un favorito
      </a>
    </div>
  );
  function businessItems(items: DirectoryBusiness[], allowRemove = false) {
    return (
      <div className="ma-business-grid">
        {items.map((b) => (
          <article className="ma-business-item" key={b.id}>
            {b.photoUrl ? (
              <img src={b.photoUrl} alt={b.name} />
            ) : (
              <div className="ma-business-placeholder">
                <Store size={26} />
              </div>
            )}
            <div>
              <h3>
                <a href={businessPath(b)}>{b.name}</a>
              </h3>
              <p>{b.category}</p>
              <small>{b.municipality}</small>
              {allowRemove && (
                <small>
                  {favorites.dates[b.id]
                    ? `Guardado: ${date(favorites.dates[b.id])}`
                    : "Guardado en este dispositivo"}
                </small>
              )}
            </div>
            {allowRemove ? (
              <button
                type="button"
                title="Quitar de favoritos"
                aria-label={`Quitar ${b.name} de favoritos`}
                onClick={() => favorites.toggle(b.id)}
              >
                <Heart size={20} fill="#D82016" color="#D82016" />
              </button>
            ) : (
              <a href={businessPath(b)} aria-label={`Ver ${b.name}`}>
                <ArrowUpRight size={20} />
              </a>
            )}
          </article>
        ))}
      </div>
    );
  }
  if (!ready)
    return (
      <div className="ma-loading" role="status">
        Cargando tu cuenta...
      </div>
    );
  if (!session || recovering)
    return (
      <div className="ma">
        <AccountAuth />
      </div>
    );
  if (section === "inicio")
    return (
      <div className="ma-loading" role="status">
        Abriendo tu cuenta...
      </div>
    );
  return (
    <AccountShell section={section}>
      {account.loading && !data ? (
        <p role="status">Cargando tu perfil...</p>
      ) : account.error ? (
        <div className="ma-notice error" role="alert">
          <p>{account.error}</p>
          <button className="ma-button" onClick={account.refresh}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {section === "comprador" && (
            <>
              <div className="ma-page-heading">
                <div>
                  <p className="ma-eyebrow">MI MERCÁU</p>
                  <h1>
                    Hola,{" "}
                    {data?.profile.name?.split(" ")[0] || "qué gusto verte"}
                  </h1>
                  <p>
                    <MapPin size={16} />
                    {data?.profile.municipality ||
                      "Agrega tu municipio en Mi perfil"}
                  </p>
                </div>
                {actions}
              </div>
              <div className="ma-summary">
                <a href="/mi-cuenta/favoritos">
                  <Heart size={23} />
                  <strong>{favorites.ids.length}</strong>
                  <span>Favoritos</span>
                </a>
                <a href="/mi-cuenta/envios">
                  <Truck size={23} />
                  <strong>{current?.deliveries?.length ?? "—"}</strong>
                  <span>Mis envíos</span>
                </a>
                <a href="/mi-cuenta/pedidos">
                  <Package size={23} />
                  <strong>{current?.orders?.length ?? "—"}</strong>
                  <span>Mis pedidos</span>
                </a>
              </div>
              {!loading &&
              !error &&
              current &&
              !favorites.ids.length &&
              !current.deliveries?.length &&
              !current.orders?.length ? (
                empty
              ) : (
                <section className="ma-band">
                  <h2>Tus negocios guardados</h2>
                  {businessItems(
                    directory
                      .filter((b) => favorites.ids.includes(b.id))
                      .slice(0, 4),
                  )}
                  <a className="ma-text-button" href="/mi-cuenta/favoritos">
                    Ver todos mis favoritos
                  </a>
                </section>
              )}
              <section className="ma-band">
                <div className="ma-section-heading">
                  <h2>Vistos recientemente</h2>
                  <a href="/#directorio">
                    Explorar negocios <ArrowUpRight size={16} />
                  </a>
                </div>
                {recent.length ? (
                  businessItems(
                    directory.filter((b) => recent.includes(b.id)).slice(0, 4),
                  )
                ) : (
                  <p className="ma-muted">
                    Aquí aparecerán las fichas que visites desde este
                    dispositivo.
                  </p>
                )}
              </section>
              <section className="ma-band">
                <div className="ma-section-heading">
                  <h2>Notificaciones</h2>
                  <a href="/mi-cuenta/notificaciones">Ver todas</a>
                </div>
                <p className="ma-muted">
                  {current?.notifications?.some((n) => !n.read_at)
                    ? "Tienes novedades en tu cuenta."
                    : "No tienes notificaciones nuevas."}
                </p>
              </section>
            </>
          )}
          {section === "favoritos" && (
            <>
              <div className="ma-page-heading">
                <div>
                  <p className="ma-eyebrow">A UN TOQUE</p>
                  <h1>Mis favoritos</h1>
                  <p>Los negocios que quieres tener cerca.</p>
                </div>
                <button className="ma-button" onClick={favorites.refresh}>
                  <RefreshCw size={17} />
                  Sincronizar
                </button>
              </div>
              {publicError && (
                <p className="ma-notice" role="alert">
                  {publicError}
                </p>
              )}
              {favorites.notice && (
                <p className="ma-notice">{favorites.notice}</p>
              )}
              {favorites.ids.length
                ? businessItems(
                    directory.filter((b) => favorites.ids.includes(b.id)),
                    true,
                  )
                : empty}
              <details className="ma-band">
                <summary>Recuperar favoritos del navegador anterior</summary>
                <p>
                  Importa solo si los guardaste tú. Los favoritos antiguos se
                  conservaron sin asignarlos automáticamente a otra persona.
                </p>
                <button className="ma-button" onClick={favorites.importLegacy}>
                  Importar favoritos anteriores
                </button>
              </details>
            </>
          )}
          {section === "envios" && (
            <>
              <div className="ma-page-heading">
                <div>
                  <p className="ma-eyebrow">TUS SOLICITUDES</p>
                  <h1>Mis envíos</h1>
                  <p>
                    Solicitudes hechas desde tu cuenta. No incluye contactos por
                    WhatsApp.
                  </p>
                </div>
                <a className="ma-button primary" href="/enviar">
                  Solicitar envío
                </a>
              </div>
              {current?.deliveries?.length ? (
                <div className="ma-list">
                  {current.deliveries.map((d) => (
                    <article className="ma-list-item" key={d.public_id}>
                      <div className="ma-section-heading">
                        <strong>{d.public_id}</strong>
                        <span className="ma-badge">{d.statusLabel}</span>
                      </div>
                      <p>{d.service_type}</p>
                      <p>
                        {d.pickup_name} →{" "}
                        {d.delivery_neighborhood || "Destino registrado"}
                      </p>
                      <div className="ma-section-heading">
                        <small>{date(d.created_at)}</small>
                        <strong>{money(d.delivery_fee)}</strong>
                      </div>
                      <a
                        className="ma-text-button"
                        href={`/envio/${d.public_id}`}
                      >
                        Ver seguimiento <ArrowUpRight size={16} />
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                !loading && !error && empty
              )}
              <p className="ma-muted">
                Los envíos antiguos sin cuenta asociada no se atribuyen
                automáticamente por teléfono.
              </p>
            </>
          )}
          {section === "pedidos" && (
            <>
              <div className="ma-page-heading">
                <p className="ma-eyebrow">TUS COMPRAS EN EL PILOTO</p>
                <h1>Mis pedidos</h1>
                <p>
                  Aquí solo aparecen pedidos registrados en Mercáu, no
                  conversaciones de WhatsApp.
                </p>
              </div>
              {current?.orders?.length ? (
                <div className="pilot ma-order-list">
                  {current.orders.map((order) => (
                    <CustomerOrderCard key={order.public_id} order={order} />
                  ))}
                </div>
              ) : (
                !loading && !error && empty
              )}
            </>
          )}
          {section === "notificaciones" && (
            <>
              <div className="ma-page-heading">
                <p className="ma-eyebrow">AL DÍA</p>
                <h1>Notificaciones</h1>
              </div>
              {current?.notifications?.length ? (
                <div className="ma-list">
                  {current.notifications.map((n) => (
                    <article className="ma-list-item" key={n.id}>
                      <Bell size={20} />
                      <h2>{n.title}</h2>
                      <p>{n.body}</p>
                      <small>{date(n.created_at)}</small>
                      {n.href && (
                        <a href={n.href} className="ma-text-button">
                          Ver detalle
                        </a>
                      )}
                      {!n.read_at && (
                        <button
                          className="ma-button"
                          onClick={async () => {
                            try {
                              await request("/api/mi-cuenta/notificaciones", {
                                method: "PATCH",
                                body: JSON.stringify({ id: n.id }),
                              });
                              setRevision((v) => v + 1);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Marcar como leída
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                !loading &&
                !error && (
                  <div className="ma-empty">
                    <Bell size={32} />
                    <h2>Estás al día</h2>
                    <p>No tienes notificaciones en tu cuenta.</p>
                    <a href="/mi-cuenta/comprador">Volver a Mi cuenta</a>
                  </div>
                )
              )}
            </>
          )}
          {section === "perfil" && <AccountProfile />}
          {section === "negocio" && <BusinessWorkspace directory={directory} />}
          {section === "registro" && (
            <>
              <div className="ma-page-heading">
                <p className="ma-eyebrow">NUEVO NEGOCIO</p>
                <h1>Inscribir mi negocio</h1>
                <p>
                  La ficha quedará vinculada a esta cuenta y se revisará antes
                  de publicarse.
                </p>
              </div>
              <BusinessRegistration />
            </>
          )}
          {section === "ayuda" && (
            <>
              <div className="ma-page-heading">
                <p className="ma-eyebrow">ESTAMOS PARA AYUDARTE</p>
                <h1>Ayuda de Mercáu</h1>
              </div>
              <section className="ma-help">
                <CatalogPhotoHelp />
                <h2>Tu cuenta y tus datos</h2>
                <p>
                  Puedes modificar tus datos de entrega en Mi perfil y recuperar
                  la contraseña desde la pantalla de acceso.
                </p>
                <a href="/mi-cuenta/perfil">Ir a Mi perfil</a>
                <h2>¿Tu negocio ya está inscrito?</h2>
                <p>
                  Abre la invitación privada que Mercáu envió al contacto
                  autorizado. No compartas ese enlace. No necesitas crear otra
                  cuenta.
                </p>
                <h2>Un pedido o envío</h2>
                <p>
                  Consulta el estado en Mis pedidos o Mis envíos. Conserva su
                  número para cualquier revisión.
                </p>
                <div className="ma-actions">
                  <a className="ma-button" href="/mi-cuenta/pedidos">
                    Mis pedidos
                  </a>
                  <a className="ma-button" href="/mi-cuenta/envios">
                    Mis envíos
                  </a>
                </div>
                <h2>Privacidad y tratamiento de datos</h2>
                <p>
                  Consulta los documentos legales vigentes de Mercáu antes de
                  crear o administrar tu cuenta.
                </p>
                <div className="ma-actions">
                  <a className="ma-button" href="/terminos-y-condiciones">Términos</a>
                  <a className="ma-button" href="/politica-de-tratamiento-de-datos">Datos personales</a>
                  <a className="ma-button" href="/aviso-de-privacidad">Aviso de privacidad</a>
                </div>
              </section>
            </>
          )}
          {(loading || error) && (
            <div className="ma-band">
              {loading ? (
                <p role="status">Actualizando tu actividad...</p>
              ) : (
                <p className="ma-notice error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="ma-button"
                disabled={loading}
                onClick={() => setRevision((v) => v + 1)}
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>
          )}
        </>
      )}
    </AccountShell>
  );
}
