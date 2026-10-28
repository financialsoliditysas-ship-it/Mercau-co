"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
const guestKey = "mercau.favorites.guest.v2";
export function readFavoriteIds(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? Array.from(
          new Set(
            value.filter(
              (id: unknown): id is string =>
                typeof id === "string" && /^rec[A-Za-z0-9]{14}$/.test(id),
            ),
          ),
        )
      : [];
  } catch {
    return [];
  }
}
export function useFavorites(userId?: string) {
  const key = userId ? `mercau.favorites.user.${userId}` : guestKey;
  const lock = useRef<symbol | null>(null);
  const [result, setResult] = useState<{
      key: string;
      ids: string[];
      dates: Record<string, string>;
    } | null>(null),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setNotice("");
    const local = readFavoriteIds(key);
    setResult({ key, ids: local, dates: {} });
    const operation = Symbol();
    lock.current = operation;
    async function sync() {
      if (!userId) return;
      const client = getSupabaseBrowserClient();
      if (!client) return;
      const { data, error } = await client
        .from("favorites")
        .select("business_id,created_at")
        .eq("user_id", userId);
      if (error)
        throw new Error(
          "No se pudieron sincronizar tus favoritos. Conservamos los guardados en este dispositivo.",
        );
      if (!active) return;
      const guest = readFavoriteIds(guestKey),
        pendingAdds = readFavoriteIds(`${key}.pending-adds`),
        pendingRemoves = readFavoriteIds(`${key}.pending-removes`);
      const remote = new Set(
          (data || [])
            .map((row) => String(row.business_id))
            .filter((id) => !pendingRemoves.includes(id)),
        ),
        missing = [...new Set([...guest, ...pendingAdds])].filter(
          (id) => !remote.has(id),
        );
      if (pendingRemoves.length) {
        const removed = await client
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .in("business_id", pendingRemoves);
        if (removed.error)
          throw new Error(
            "No se pudieron sincronizar los favoritos eliminados.",
          );
      }
      if (missing.length) {
        const saved = await client.from("favorites").upsert(
          missing.map((business_id) => ({ business_id, user_id: userId })),
          { onConflict: "user_id,business_id", ignoreDuplicates: true },
        );
        if (saved.error)
          throw new Error(
            "No se pudieron guardar todos los favoritos. Intenta sincronizar nuevamente.",
          );
      }
      if (!active) return;
      const ids = [
        ...new Set([...Array.from(remote), ...pendingAdds, ...guest]),
      ];
      localStorage.setItem(key, JSON.stringify(ids));
      localStorage.removeItem(guestKey);
      localStorage.removeItem(`${key}.pending-adds`);
      localStorage.removeItem(`${key}.pending-removes`);
      setResult({
        key,
        ids,
        dates: Object.fromEntries(
          (data || []).map((row) => [row.business_id, row.created_at]),
        ),
      });
    }
    sync()
      .catch((error) => {
        if (active) setNotice(error.message);
      })
      .finally(() => {
        if (lock.current === operation) lock.current = null;
      });
    return () => {
      active = false;
    };
  }, [key, userId, revision]);
  const ids = result?.key === key ? result.ids : [];
  async function toggle(id: string) {
    if (lock.current || !/^rec[A-Za-z0-9]{14}$/.test(id)) return;
    const operation = Symbol();
    lock.current = operation;
    try {
      const added = !ids.includes(id),
        next = added ? [...ids, id] : ids.filter((value) => value !== id);
      localStorage.setItem(key, JSON.stringify(next));
      setResult({ key, ids: next, dates: result?.dates || {} });
      if (userId) {
        const pendingKey = `${key}.pending-${added ? "adds" : "removes"}`,
          opposite = `${key}.pending-${added ? "removes" : "adds"}`;
        localStorage.setItem(
          pendingKey,
          JSON.stringify([...new Set([...readFavoriteIds(pendingKey), id])]),
        );
        localStorage.setItem(
          opposite,
          JSON.stringify(
            readFavoriteIds(opposite).filter((value) => value !== id),
          ),
        );
        const client = getSupabaseBrowserClient();
        if (!client) return;
        const response = added
          ? await client
              .from("favorites")
              .upsert(
                { business_id: id, user_id: userId },
                { onConflict: "user_id,business_id", ignoreDuplicates: true },
              )
          : await client
              .from("favorites")
              .delete()
              .eq("user_id", userId)
              .eq("business_id", id);
        if (response.error)
          setNotice(
            "El cambio quedó en este dispositivo; no se pudo sincronizar.",
          );
        else
          localStorage.setItem(
            pendingKey,
            JSON.stringify(
              readFavoriteIds(pendingKey).filter((value) => value !== id),
            ),
          );
      }
    } catch {
      setNotice("El cambio no pudo sincronizarse. Intenta nuevamente.");
    } finally {
      if (lock.current === operation) lock.current = null;
    }
  }
  function importLegacy() {
    const legacy = readFavoriteIds("mercau.favoriteBusinessIds");
    const merged = [...new Set([...ids, ...legacy])];
    localStorage.setItem(key, JSON.stringify(merged));
    if (userId)
      localStorage.setItem(
        `${key}.pending-adds`,
        JSON.stringify([
          ...new Set([...readFavoriteIds(`${key}.pending-adds`), ...legacy]),
        ]),
      );
    setResult({ key, ids: merged, dates: result?.dates || {} });
    setRevision((v) => v + 1);
  }
  return {
    ids,
    dates: result?.key === key ? result.dates : {},
    notice,
    toggle,
    refresh: () => setRevision((v) => v + 1),
    importLegacy,
  };
}
