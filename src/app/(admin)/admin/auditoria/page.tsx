"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { AuditLogSchema, ListResponseSchema, type AuditLog } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const auditListSchema = ListResponseSchema(AuditLogSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };
type UndoState = Record<string, { status: "idle" | "loading" | "error"; error?: string } | undefined>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isStripeLog = (log: AuditLog) => {
  if (log.action === "stripe_webhook") return true;
  if (isPlainObject(log.meta)) {
    return String(log.meta.provider ?? "").toLowerCase() === "stripe";
  }
  return false;
};

const getActionType = (method: string, isStripe: boolean) => {
  if (isStripe) return "Webhook Stripe";
  if (method === "POST") return "Criacao";
  if (method === "PUT" || method === "PATCH") return "Atualizacao";
  if (method === "DELETE") return "Remocao";
  return "Acao";
};

const getObjectLabel = (path: string, isStripe: boolean) => {
  if (isStripe) return "Pagamento";
  if (path.includes("/products")) return "Produto";
  if (path.includes("/categories")) return "Categoria";
  if (path.includes("/coupons")) return "Cupom";
  if (path.includes("/orders")) return "Pedido";
  if (path.includes("/inventory") || path.includes("/stock")) return "Stock";
  if (path.includes("/support")) return "Suporte";
  if (path.includes("/roles")) return "Role";
  if (path.includes("/permissions")) return "Permissao";
  if (path.includes("/users")) return "Usuario";
  if (path.includes("/branding")) return "Marca";
  return "Registro";
};

const getSubjectLabel = (meta: Record<string, unknown>, objectLabel: string, isStripe: boolean) => {
  if (isStripe) {
    const eventType = String(meta.eventType ?? "");
    return eventType ? `Evento ${eventType}` : "Stripe";
  }
  const body = isPlainObject(meta.body) ? meta.body : {};
  const prev = isPlainObject(meta.prev) ? meta.prev : {};
  if (objectLabel === "Produto") {
    return String(body.name ?? (isPlainObject(prev.product) ? prev.product.name : "")).trim() || "Produto";
  }
  if (objectLabel === "Cupom") {
    return String(body.code ?? (isPlainObject(prev.coupon) ? prev.coupon.code : "")).trim() || "Cupom";
  }
  if (objectLabel === "Categoria") {
    return String(body.name ?? "").trim() || "Categoria";
  }
  if (objectLabel === "Pedido") {
    return "Pedido";
  }
  return objectLabel;
};

const getUndoLabel = (meta: Record<string, unknown>) => {
  const method = String(meta.method ?? "");
  const path = String(meta.path ?? "");
  const normalized = path.replace(/^\/v1/, "");

  if (method === "POST" && normalized.endsWith("/products")) return "Desfazer criacao de produto";
  if (method === "POST" && normalized.endsWith("/coupons")) return "Desfazer criacao de cupom";
  if (normalized.includes("/products/") && (method === "PUT" || method === "PATCH" || method === "DELETE")) {
    return "Desfazer alteracao de produto";
  }
  if (normalized.includes("/coupons/") && (method === "PUT" || method === "DELETE")) {
    return "Desfazer alteracao de cupom";
  }
  if (normalized.endsWith("/stock/adjust") && method === "POST") return "Desfazer ajuste de stock";
  if (normalized.endsWith("/inventory/movements") && method === "POST") return "Desfazer movimento de stock";
  if (normalized.endsWith("/orders/") && method === "PATCH") return "Desfazer status de pedido";
  if (normalized.includes("/orders/") && method === "PATCH") return "Desfazer status de pedido";

  return null;
};

export default function AdminAuditPage() {
  const auth = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [undoState, setUndoState] = useState<UndoState>({});
  const [filter, setFilter] = useState<"all" | "stripe">("all");

  const fetchLogs = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/admin/audit-logs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = auditListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de auditoria");
      }
      setLogs(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchLogs();
  }, [auth.status, fetchLogs]);

  const handleUndo = async (logId: string) => {
    const token = getAccessToken();
    if (!token) {
      setUndoState((prev) => ({ ...prev, [logId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setUndoState((prev) => ({ ...prev, [logId]: { status: "loading" } }));
    try {
      await api.post(`/admin/audit-logs/${logId}/undo`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setUndoState((prev) => ({ ...prev, [logId]: { status: "idle" } }));
      fetchLogs();
    } catch (error) {
      setUndoState((prev) => ({ ...prev, [logId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  return (
    <AdminShell title="Auditoria" subtitle="Logs administrativos gerados pelo backend.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-text">Ultimas acoes</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-full border px-3 py-1 transition ${
                filter === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface/80 text-text hover:border-primary/40"
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("stripe")}
              className={`rounded-full border px-3 py-1 transition ${
                filter === "stripe"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface/80 text-text hover:border-primary/40"
              }`}
            >
              Stripe Webhook ({logs.filter((log) => isStripeLog(log)).length})
            </button>
          </div>
        </div>
        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : logs.length ? (
          <div className="mt-4 space-y-3">
            {logs
              .filter((log) => (filter === "stripe" ? isStripeLog(log) : true))
              .map((log) => {
              const meta = isPlainObject(log.meta) ? log.meta : {};
              const undoLabel = getUndoLabel(meta);
              const undone =
                isPlainObject(meta.undo) && String(meta.undo.status) === "done";
              const actionState = undoState[log.id];
              const method = String(meta.method ?? "");
              const path = String(meta.path ?? "");
              const stripe = isStripeLog(log);
              const actionType = getActionType(method, stripe);
              const objectLabel = getObjectLabel(path, stripe);
              const subjectLabel = getSubjectLabel(meta, objectLabel, stripe);
              const eventType = stripe ? String(meta.eventType ?? "") : "";
              const eventStatus = stripe ? String(meta.paymentStatus ?? meta.status ?? "") : "";

              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border bg-surface/70 p-4 transition hover:-translate-y-1 hover:shadow-soft"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text">{subjectLabel}</div>
                    <div className="text-xs text-muted">{formatDate(log.createdAt)}</div>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    Acao: {actionType} | Objeto: {objectLabel}
                  </div>
                  {stripe && (eventType || eventStatus) ? (
                    <div className="mt-1 text-xs text-muted">
                      Evento: {eventType || "-"} {eventStatus ? `| Status: ${eventStatus}` : ""}
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs text-muted">
                    Ator: {log.actor?.name || log.actor?.email || log.actorId || "-"}
                  </div>
                  {meta.path ? <div className="mt-1 text-xs text-muted">Rota: {String(meta.path)}</div> : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link href={`/admin/auditoria/${log.id}`} className="text-sm text-primary">
                      Ver detalhes
                    </Link>
                    {undoLabel && !undone ? (
                      <button
                        type="button"
                        onClick={() => handleUndo(log.id)}
                        className="rounded-full border border-border bg-surface/80 px-3 py-1 text-xs text-text transition hover:border-primary/40"
                        disabled={actionState?.status === "loading"}
                      >
                        {actionState?.status === "loading" ? "Desfazendo" : undoLabel}
                      </button>
                    ) : null}
                    {undone ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                        Desfeito
                      </span>
                    ) : null}
                    {actionState?.status === "error" ? (
                      <span className="text-xs text-amber-600">{actionState.error}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted">Nenhum log encontrado.</div>
        )}
      </section>
    </AdminShell>
  );
}
