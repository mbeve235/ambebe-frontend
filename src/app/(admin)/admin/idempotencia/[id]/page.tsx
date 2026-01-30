"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { IdempotencyKeySchema, type IdempotencyKey } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getIdempotencySummary } from "@/lib/idempotency";
import { useAuth } from "@/hooks/use-auth";

export default function AdminIdempotencyDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const keyId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [item, setItem] = useState<IdempotencyKey | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const summary = item ? getIdempotencySummary(item) : null;

  const fetchItem = useCallback(async () => {
    if (!keyId) return;
    const token = getAccessToken();
    if (!token) {
      setState("error");
      setError("Token ausente");
      return;
    }

    setState("loading");
    try {
      const response = await api.get(`/admin/idempotency-keys/${keyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = IdempotencyKeySchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida da chave");
      }
      setItem(parsed.data);
      setState("ready");
    } catch (err) {
      setState("error");
      setError(getApiErrorMessage(err));
    }
  }, [keyId]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchItem();
  }, [auth.status, fetchItem]);

  return (
    <AdminShell title="Detalhe de idempotencia" subtitle="Visualize o payload armazenado pelo backend.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/admin/idempotencia" className="text-sm text-primary">
          Voltar para idempotencia
        </Link>

        {state === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{error}</div>
        ) : item && summary ? (
          <div className="mt-4 space-y-4 text-sm text-text">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold text-text">{summary.title}</div>
              <Badge variant="neutral">{summary.kindLabel}</Badge>
            </div>
            {summary.highlight ? <div className="text-sm text-muted">{summary.highlight}</div> : null}
            {summary.details.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {summary.details.map((detail) => (
                  <div key={detail.label} className="rounded-2xl border border-border bg-surface/70 p-3">
                    <div className="text-xs text-muted">{detail.label}</div>
                    <div className="text-sm font-semibold text-text">{detail.value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/70 p-3">
                <div className="text-xs text-muted">Criado</div>
                <div className="text-sm font-semibold text-text">{formatDate(item.createdAt)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 p-3">
                <div className="text-xs text-muted">Expira</div>
                <div className="text-sm font-semibold text-text">{formatDate(item.expiresAt)}</div>
              </div>
            </div>

            <details className="rounded-2xl border border-border bg-surface/60 p-4 text-xs text-muted">
              <summary className="cursor-pointer text-sm font-semibold text-text">Detalhes tecnicos</summary>
              <div className="mt-3 space-y-2">
                <div>Chave: {item.key}</div>
                <div>Usuario: {item.userId}</div>
                <div>Hash da requisicao: {item.requestHash}</div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-semibold text-text">Resposta completa</div>
                <pre className="mt-2 overflow-auto rounded-2xl border border-border bg-surface/70 p-4 text-xs">
{JSON.stringify(item.responseBody, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
