"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { IdempotencyKeySchema, ListResponseSchema, type IdempotencyKey } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getIdempotencySummary } from "@/lib/idempotency";
import { useAuth } from "@/hooks/use-auth";

const idempotencyListSchema = ListResponseSchema(IdempotencyKeySchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function AdminIdempotencyPage() {
  const auth = useAuth();
  const [items, setItems] = useState<IdempotencyKey[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [userId, setUserId] = useState("");
  const [key, setKey] = useState("");

  const fetchItems = useCallback(
    async (query?: { userId?: string; key?: string }) => {
      const token = getAccessToken();
      if (!token) {
        setState({ status: "error", error: "Token ausente" });
        return;
      }

      setState({ status: "loading" });
      try {
        const response = await api.get("/admin/idempotency-keys", {
          headers: { Authorization: `Bearer ${token}` },
          params: query
        });
        const parsed = idempotencyListSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida de idempotencia");
        }
        setItems(parsed.data.items);
        setState({ status: "ready" });
      } catch (error) {
        setState({ status: "error", error: getApiErrorMessage(error) });
      }
    },
    []
  );

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchItems();
  }, [auth.status, fetchItems]);

  const handleFilter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchItems({ userId: userId || undefined, key: key || undefined });
  };

  return (
    <AdminShell title="Idempotencia" subtitle="Chaves de idempotencia registradas pelo backend.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="text-sm font-semibold text-text">Filtro</div>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleFilter}>
          <div className="min-w-[220px]">
            <div className="text-xs text-muted">Cliente (ID)</div>
            <Input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="min-w-[220px]">
            <div className="text-xs text-muted">Chave de idempotencia</div>
            <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="Opcional" />
          </div>
          <Button type="submit">Buscar</Button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="text-sm font-semibold text-text">Resultados</div>
        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : items.length ? (
          <div className="mt-4 space-y-3">
            {items.map((item) => {
              const summary = getIdempotencySummary(item);
              const detailsLine = summary.details.map((detail) => `${detail.label}: ${detail.value}`).join(" • ");
              return (
                <Link
                  key={item.id}
                  href={`/admin/idempotencia/${item.id}`}
                  className="block rounded-2xl border border-border bg-surface/70 p-4 transition hover:-translate-y-1 hover:shadow-soft"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-text">{summary.title}</div>
                    <Badge variant="neutral">{summary.kindLabel}</Badge>
                  </div>
                  {summary.highlight ? (
                    <div className="text-xs text-muted">{summary.highlight}</div>
                  ) : null}
                  {detailsLine ? <div className="text-xs text-muted">{detailsLine}</div> : null}
                  <div className="text-xs text-muted">Criado: {formatDate(item.createdAt)}</div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted">Nenhum registro encontrado.</div>
        )}
      </section>
    </AdminShell>
  );
}
