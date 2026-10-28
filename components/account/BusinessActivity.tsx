"use client";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
export default function BusinessActivity({
  businessId,
}: {
  businessId: string;
}) {
  useEffect(() => {
    const send = (event: string) =>
      fetch(`/api/negocios/${businessId}/actividad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
        keepalive: true,
      }).catch(() => {});
    send("profile_view");
    getSupabaseBrowserClient()
      ?.auth.getSession()
      .then(({ data }) => {
        const key = `mercau.recent.v2.${data.session?.user.id || "guest"}`;
        try {
          const previous = JSON.parse(localStorage.getItem(key) || "[]");
          localStorage.setItem(
            key,
            JSON.stringify(
              [
                businessId,
                ...(Array.isArray(previous)
                  ? previous.filter(
                      (id) => typeof id === "string" && id !== businessId,
                    )
                  : []),
              ].slice(0, 12),
            ),
          );
        } catch {
          /* Recent views are optional. */
        }
      })
      .catch(() => {});
    const click = (event: MouseEvent) => {
      const a = (event.target as Element)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (
        href.startsWith("https://wa.me/") &&
        !href.startsWith("https://wa.me/?")
      )
        send("whatsapp_click");
      if (href.startsWith("tel:")) send("call_click");
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [businessId]);
  return null;
}
