"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { BrandingSchema, type Branding } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { resolveAssetUrl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function AdminBrandingPage() {
  const auth = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoState, setLogoState] = useState<LoadState>({ status: "ready" });
  const [faviconState, setFaviconState] = useState<LoadState>({ status: "ready" });

  const loadBranding = useCallback(() => {
    setState({ status: "loading" });
    api
      .get("/store/branding")
      .then((response) => {
        const parsed = BrandingSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida da marca");
        }
        setBranding(parsed.data);
        setState({ status: "ready" });
      })
      .catch((error) => {
        setState({ status: "error", error: getApiErrorMessage(error) });
      });
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    loadBranding();
  }, [auth.status, loadBranding]);

  const uploadAsset = async (type: "logo" | "favicon") => {
    const token = getAccessToken();
    if (!token) {
      const error = "Token ausente";
      type === "logo" ? setLogoState({ status: "error", error }) : setFaviconState({ status: "error", error });
      return;
    }

    const file = type === "logo" ? logoFile : faviconFile;
    if (!file) {
      const error = "Selecione um arquivo antes de enviar";
      type === "logo" ? setLogoState({ status: "error", error }) : setFaviconState({ status: "error", error });
      return;
    }

    type === "logo" ? setLogoState({ status: "loading" }) : setFaviconState({ status: "loading" });
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post(`/admin/branding/${type}`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      type === "logo" ? setLogoState({ status: "ready" }) : setFaviconState({ status: "ready" });
      type === "logo" ? setLogoFile(null) : setFaviconFile(null);
      loadBranding();
    } catch (error) {
      const message = getApiErrorMessage(error);
      type === "logo" ? setLogoState({ status: "error", error: message }) : setFaviconState({ status: "error", error: message });
    }
  };

  const logoUrl = branding?.logoUrl ? resolveAssetUrl(branding.logoUrl) : "";
  const faviconUrl = branding?.faviconUrl ? resolveAssetUrl(branding.faviconUrl) : "";

  return (
    <AdminShell title="Marca" subtitle="Atualize a logo e o favicon usados no storefront.">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Logo principal</div>
          <p className="mt-2 text-sm text-muted">PNG, JPG, WEBP ou SVG. Tamanho maximo 2MB.</p>

          {state.status === "loading" ? (
            <div className="mt-4">
              <Skeleton className="h-24 w-24" />
            </div>
          ) : logoUrl ? (
            <div className="mt-4 h-24 w-24 overflow-hidden rounded-2xl border border-border bg-surface/70">
              <img src={logoUrl} alt="Logo atual" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhuma logo enviada.</div>
          )}

          <div className="mt-4 space-y-3">
            <Input type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} />
            <Button onClick={() => uploadAsset("logo")} disabled={logoState.status === "loading"}>
              {logoState.status === "loading" ? "Enviando" : "Enviar logo"}
            </Button>
            {logoState.status === "error" ? (
              <div className="text-xs text-amber-600">{logoState.error}</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Favicon</div>
          <p className="mt-2 text-sm text-muted">PNG, SVG ou ICO. Tamanho maximo 2MB.</p>

          {state.status === "loading" ? (
            <div className="mt-4">
              <Skeleton className="h-16 w-16" />
            </div>
          ) : faviconUrl ? (
            <div className="mt-4 h-16 w-16 overflow-hidden rounded-xl border border-border bg-surface/70">
              <img src={faviconUrl} alt="Favicon atual" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhum favicon enviado.</div>
          )}

          <div className="mt-4 space-y-3">
            <Input type="file" accept="image/*" onChange={(event) => setFaviconFile(event.target.files?.[0] ?? null)} />
            <Button onClick={() => uploadAsset("favicon")} disabled={faviconState.status === "loading"}>
              {faviconState.status === "loading" ? "Enviando" : "Enviar favicon"}
            </Button>
            {faviconState.status === "error" ? (
              <div className="text-xs text-amber-600">{faviconState.error}</div>
            ) : null}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
