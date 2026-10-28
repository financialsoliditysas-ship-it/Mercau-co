"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AccountProfile } from "@/lib/account-model";
type AccountData = {
  profile: AccountProfile;
  version: number;
  roles: string[];
  businesses: { business_id: string; business_name: string; status: string }[];
};
type State = {
  session: Session | null;
  ready: boolean;
  recovering: boolean;
  data: AccountData | null;
  error: string;
  loading: boolean;
  refresh: () => void;
  request: (path: string, options?: RequestInit) => Promise<any>;
};
const Context = createContext<State | null>(null);
export function AccountSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [recovering, setRecovering] = useState(false);
  const [result, setResult] = useState<{
      userId: string;
      data: AccountData;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setReady(true);
      return;
    }
    let active = true;
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        setResult(null);
        setRecovering(false);
      }
    });
    client.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const userId = session?.user.id;
  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const client = getSupabaseBrowserClient(),
        current = client ? (await client.auth.getSession()).data.session : null;
      if (!current || current.user.id !== userId)
        throw new Error("Tu sesión cambió. Entra nuevamente.");
      const response = await fetch(path, {
        ...options,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          Authorization: `Bearer ${current.access_token}`,
        },
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Tu sesión terminó. Entra nuevamente."
            : body.error || "No se pudo completar la operación.",
        );
      return body;
    },
    [userId],
  );
  useEffect(() => {
    if (!userId) {
      setResult(null);
      setLoading(false);
      return;
    }
    let active = true;
    const abort = new AbortController();
    setError("");
    setLoading(true);
    request("/api/mi-cuenta", { signal: abort.signal })
      .then((data) => {
        if (active) setResult({ userId, data });
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [userId, revision, request]);
  const data =
    result?.userId === session?.user.id ? result?.data || null : null;
  return (
    <Context.Provider
      value={{
        session,
        ready,
        recovering,
        data,
        error,
        loading,
        refresh: () => setRevision((v) => v + 1),
        request,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAccount() {
  const value = useContext(Context);
  if (!value) throw new Error("AccountSession is required");
  return value;
}
