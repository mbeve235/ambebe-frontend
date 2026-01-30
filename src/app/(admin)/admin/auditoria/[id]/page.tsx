"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { AuditLogSchema, type AuditLog } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export default function AdminAuditDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const logId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [log, setLog] = useState<AuditLog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<"idle" | "loading" | "error">("idle");
  const [undoError, setUndoError] = useState<string | null>(null);

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

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
    if (normalized.includes("/orders/") && method === "PATCH") return "Desfazer status de pedido";

    return null;
  };

  const isStripeLog = (value: AuditLog) => {
    if (value.action === "stripe_webhook") return true;
    if (isPlainObject(value.meta)) {
      return String(value.meta.provider ?? "").toLowerCase() === "stripe";
    }
    return false;
  };

  const getActionType = (method: string, stripe: boolean) => {
    if (stripe) return "Webhook Stripe";
    if (method === "POST") return "Criacao";
    if (method === "PUT" || method === "PATCH") return "Atualizacao";
    if (method === "DELETE") return "Remocao";
    return "Acao";
  };

  const getObjectLabel = (path: string, stripe: boolean) => {
    if (stripe) return "Pagamento";
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

  const getSubjectLabel = (meta: Record<string, unknown>, objectLabel: string, stripe: boolean) => {
    if (stripe) {
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

  const fetchLog = useCallback(async () => {
    if (!logId) return;
    const token = getAccessToken();
    if (!token) {
      setState("error");
      setError("Token ausente");
      return;
    }

    setState("loading");
    try {
      const response = await api.get(`/admin/audit-logs/${logId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = AuditLogSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do log");
      }
      setLog(parsed.data);
      setState("ready");
    } catch (err) {
      setState("error");
      setError(getApiErrorMessage(err));
    }
  }, [logId]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchLog();
  }, [auth.status, fetchLog]);

  const handleUndo = async () => {
    if (!log) return;
    const token = getAccessToken();
    if (!token) {
      setUndoState("error");
      setUndoError("Token ausente");
      return;
    }

    setUndoState("loading");
    setUndoError(null);
    try {
      await api.post(`/admin/audit-logs/${log.id}/undo`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setUndoState("idle");
      fetchLog();
    } catch (err) {
      setUndoState("error");
      setUndoError(getApiErrorMessage(err));
    }
  };

  return (
    <AdminShell title="Detalhe do log" subtitle="Auditoria completa da acao.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/admin/auditoria" className="text-sm text-primary">
          Voltar para auditoria
        </Link>

        {state === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{error}</div>
        ) : log ? (
          <div className="mt-4 space-y-6 text-sm text-text">
            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Resumo</div>
              <div className="mt-3 space-y-1 text-sm text-text">
                {isPlainObject(log.meta) ? (
                  <>
                    {(() => {
                      const stripe = isStripeLog(log);
                      const path = String(log.meta.path ?? "");
                      const eventType = String(log.meta.eventType ?? "");
                      const paymentStatus = String(log.meta.paymentStatus ?? log.meta.status ?? "");
                      return (
                        <>
                          <div>Objeto: {getObjectLabel(path, stripe)}</div>
                          <div>Acao: {getActionType(String(log.meta.method ?? ""), stripe)}</div>
                          <div>Tipo: {getSubjectLabel(log.meta, getObjectLabel(path, stripe), stripe)}</div>
                          {stripe ? (
                            <>
                              <div>Evento: {eventType || "-"}</div>
                              {paymentStatus ? <div>Status: {paymentStatus}</div> : null}
                              {log.meta.orderId ? <div>Pedido: {String(log.meta.orderId)}</div> : null}
                              {log.meta.paymentId ? <div>Pagamento: {String(log.meta.paymentId)}</div> : null}
                            </>
                          ) : null}
                        </>
                      );
                    })()}
                  </>
                ) : null}
                <div>Ator: {log.actor?.name || log.actor?.email || log.actorId || "-"}</div>
                <div>Data: {formatDate(log.createdAt)}</div>
              </div>
            </div>

            {isPlainObject(log.meta) ? (
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Detalhes da acao</div>
                <div className="mt-3 space-y-2 text-xs text-muted">
                  {log.meta.method ? <div>Metodo: {String(log.meta.method)}</div> : null}
                  {log.meta.path ? <div>Rota: {String(log.meta.path)}</div> : null}
                  {log.meta.status ? <div>Status: {String(log.meta.status)}</div> : null}
                  {log.meta.durationMs ? <div>Duracao: {String(log.meta.durationMs)}ms</div> : null}
                </div>
              </div>
            ) : null}

            {isPlainObject(log.meta) && log.meta.body ? (
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Dados enviados</div>
                <pre className="mt-2 overflow-auto rounded-2xl border border-border bg-surface/80 p-4 text-xs">
{JSON.stringify(log.meta.body, null, 2)}
                </pre>
              </div>
            ) : null}

            {isPlainObject(log.meta) && log.meta.prev ? (
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Estado anterior</div>
                <pre className="mt-2 overflow-auto rounded-2xl border border-border bg-surface/80 p-4 text-xs">
{JSON.stringify(log.meta.prev, null, 2)}
                </pre>
              </div>
            ) : null}

            {isPlainObject(log.meta) && log.meta.undo ? (
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Desfazer</div>
                <pre className="mt-2 overflow-auto rounded-2xl border border-border bg-surface/80 p-4 text-xs">
{JSON.stringify(log.meta.undo, null, 2)}
                </pre>
              </div>
            ) : null}

            {(() => {
              if (!isPlainObject(log.meta)) return null;
              const undoLabel = getUndoLabel(log.meta);
              const undone = isPlainObject(log.meta.undo) && String(log.meta.undo.status) === "done";
              if (!undoLabel || undone) return null;
              return (
                <div className="rounded-2xl border border-border bg-surface/70 p-4">
                  <div className="text-sm font-semibold text-text">Desfazer</div>
                  <p className="mt-2 text-xs text-muted">Use esta acao apenas se tiver certeza do impacto.</p>
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="mt-4 rounded-full border border-border bg-surface/80 px-4 py-2 text-xs text-text transition hover:border-primary/40"
                    disabled={undoState === "loading"}
                  >
                    {undoState === "loading" ? "Desfazendo" : undoLabel}
                  </button>
                  {undoState === "error" && undoError ? (
                    <div className="mt-2 text-xs text-amber-600">{undoError}</div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
