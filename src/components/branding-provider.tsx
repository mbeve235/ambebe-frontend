"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { BrandingSchema, type Branding } from "@/lib/api-schema";
import { resolveAssetUrl } from "@/lib/format";

type BrandingState = {
  status: "loading" | "ready" | "error";
  data: Branding | null;
  error?: string;
  refresh: () => void;
};

const BrandingContext = createContext<BrandingState | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<BrandingState, "refresh">>({
    status: "loading",
    data: null
  });

  const refresh = useCallback(() => {
    setState({ status: "loading", data: null });
    api
      .get("/store/branding")
      .then((response) => {
        const parsed = BrandingSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida da marca");
        }
        setState({ status: "ready", data: parsed.data });
      })
      .catch((error) => {
        setState({ status: "error", data: null, error: getApiErrorMessage(error) });
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!state.data?.faviconUrl) return;
    const href = resolveAssetUrl(state.data.faviconUrl);
    if (!href) return;

    const ensureLink = (rel: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    ensureLink("icon");
    ensureLink("shortcut icon");
  }, [state.data?.faviconUrl]);

  const value = useMemo(
    () => ({
      ...state,
      refresh
    }),
    [refresh, state]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      status: "loading" as const,
      data: null,
      error: undefined,
      refresh: () => {}
    };
  }
  return context;
}
