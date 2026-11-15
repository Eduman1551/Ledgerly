"use client";
// App-wide client state: who the current demo persona is, and whether the
// user has AI switched on (when a key is configured on the server).
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@/lib/db/schema";

export { HOME_BY_ROLE } from "@/lib/roles";

export type Persona = { id: string; name: string; role: Role };

type AppState = {
  user: Persona;
  personas: Persona[];
  switchUser: (id: string, goTo?: string) => void;
  aiConfigured: boolean;
  aiModel: string;
  aiEnabled: boolean; // configured AND not switched off by the user
  setAiEnabled: (on: boolean) => void;
};

const AppContext = createContext<AppState | null>(null);

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
};

export function AppProvider(props: { user: Persona; personas: Persona[]; aiConfigured: boolean; aiModel: string; aiOff: boolean; children: ReactNode }) {
  const router = useRouter();
  const [aiOff, setAiOff] = useState(props.aiOff);

  const switchUser = useCallback(
    (id: string, goTo?: string) => {
      setCookie("ledgerly_user", id);
      if (goTo) router.push(goTo);
      router.refresh();
    },
    [router],
  );

  const setAiEnabled = useCallback((on: boolean) => {
    setCookie("ledgerly_ai", on ? "on" : "off");
    setAiOff(!on);
  }, []);

  const value = useMemo<AppState>(
    () => ({ user: props.user, personas: props.personas, switchUser, aiConfigured: props.aiConfigured, aiModel: props.aiModel, aiEnabled: props.aiConfigured && !aiOff, setAiEnabled }),
    [props.user, props.personas, props.aiConfigured, props.aiModel, aiOff, switchUser, setAiEnabled],
  );
  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
