"use client";
import { ReactNode, useState } from "react";
import {
  Home,
  Search,
  Heart,
  Truck,
  ShoppingBag,
  Bell,
  UserRound,
  LifeBuoy,
  LogOut,
  Menu,
  Store,
  ArrowLeft,
} from "lucide-react";
import { useAccount } from "./AccountSession";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { BuyerProfileFrame } from "@/components/buyer/BuyerChrome";
export default function AccountShell({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const { data, session } = useAccount(),
    [expanded, setExpanded] = useState(false),
    [error, setError] = useState("");
  const hasBusiness = Boolean(data?.roles.includes("business_owner"));
  const owner = hasBusiness;
  const homeHref = owner ? "/mi-cuenta/negocio" : "/mi-cuenta/comprador";
  const links = [
    {
      label: "Inicio",
      href: "/mi-cuenta/comprador",
      section: "comprador",
      Icon: Home,
    },
    {
      label: "Explorar negocios",
      href: "/#directorio",
      section: "explorar",
      Icon: Search,
    },
    {
      label: "Favoritos",
      href: "/mi-cuenta/favoritos",
      section: "favoritos",
      Icon: Heart,
    },
    {
      label: "Mis envíos",
      href: "/mi-cuenta/envios",
      section: "envios",
      Icon: Truck,
    },
    {
      label: "Mis pedidos",
      href: "/mi-cuenta/pedidos",
      section: "pedidos",
      Icon: ShoppingBag,
    },
    {
      label: "Notificaciones",
      href: "/mi-cuenta/notificaciones",
      section: "notificaciones",
      Icon: Bell,
    },
    {
      label: "Mi perfil",
      href: "/mi-cuenta/perfil",
      section: "perfil",
      Icon: UserRound,
    },
    {
      label: "Ayuda",
      href: "/mi-cuenta/ayuda",
      section: "ayuda",
      Icon: LifeBuoy,
    },
  ];
  if(section === "perfil" && !owner)return <BuyerProfileFrame>{children}</BuyerProfileFrame>;
  return (
    <div className="ma">
      <header className="ma-topbar">
        <a href="/" className="ma-brand">
          <img src="/logo-mercau.png" alt="Mercáu" width="42" height="42" />
          <strong>Mi cuenta</strong>
        </a>
        <div className="ma-top-actions">
          <a href={homeHref} className="ma-account-link">
            <ArrowLeft size={16} />
            Mi cuenta
          </a>
          <span className="ma-user-name">
            {data?.profile.name || session?.user.email}
          </span>
          <button
            type="button"
            title="Abrir menú"
            aria-label="Abrir menú de mi cuenta"
            aria-expanded={expanded}
            className="ma-menu-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      <div className="ma-layout">
        <aside className={`ma-sidebar ${expanded ? "open" : ""}`}>
          <nav aria-label="Menú de mi cuenta">
            {owner && (
              <>
                <a
                  aria-current={section === "negocio" ? "page" : undefined}
                  href={homeHref}
                >
                  <Store size={19} />
                  {hasBusiness ? "Panel de mi negocio" : "Registrar mi negocio"}
                </a>
                <a href="/mi-cuenta/perfil">
                  <UserRound size={19} />
                  Mi perfil
                </a>
                <a href="/mi-cuenta/ayuda">
                  <LifeBuoy size={19} />
                  Ayuda
                </a>
              </>
            )}
            {links.filter(link => !owner || !["ayuda", "perfil"].includes(link.section)).map(({ Icon, ...link }) => (
                <a
                  key={link.section}
                  href={link.href}
                  aria-current={section === link.section ? "page" : undefined}
                >
                  <Icon size={19} />
                  {link.label}
                </a>
              ))}
          </nav>
          <div className="ma-sidebar-bottom">
            <button
              type="button"
              onClick={async () => {
                const result = await getSupabaseBrowserClient()?.auth.signOut();
                if (result?.error)
                  setError("No se pudo cerrar sesión. Intenta nuevamente.");
              }}
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </aside>
        <main className="ma-content">
          {error && (
            <p role="alert" className="ma-notice error">
              {error}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
