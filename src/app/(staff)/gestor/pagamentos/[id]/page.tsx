"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { PaymentWithOrderSchema, type PaymentWithOrder } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export default function StaffPaymentDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const paymentId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [payment, setPayment] = useState<PaymentWithOrder | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const fetchPayment = useCallback(async () => {
    if (!paymentId) return;
    const token = getAccessToken();
    if (!token) {
      setState("error");
      setError("Token ausente");
      return;
    }

    setState("loading");
    try {
      const response = await api.get(`/staff/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = PaymentWithOrderSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do pagamento");
      }
      setPayment(parsed.data);
      setState("ready");
    } catch (err) {
      setState("error");
      setError(getApiErrorMessage(err));
    }
  }, [paymentId]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchPayment();
  }, [auth.status, fetchPayment]);

  const badgeVariant = payment?.status === "CAPTURED" ? "success" : "warning";

  return (
    <StaffShell title="Detalhe do pagamento" subtitle="Acompanhe status e pedido associado.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/gestor/pagamentos" className="text-sm text-primary">
          Voltar para pagamentos
        </Link>

        {state === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{error}</div>
        ) : payment ? (
          <div className="mt-4 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-muted">Pagamento</div>
                <div className="text-lg font-semibold text-text">{payment.id}</div>
              </div>
              <Badge variant={badgeVariant}>{payment.status}</Badge>
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Dados</div>
              <div className="mt-2 text-sm text-text">
                <div>Valor: {formatPrice(payment.amount)}</div>
                <div>Data: {formatDate(payment.createdAt)}</div>
                <div>Pedido: {payment.order?.id ?? payment.orderId}</div>
                {payment.provider ? <div>Provedor: {payment.provider}</div> : null}
                {payment.externalRef ? <div>Referencia: {payment.externalRef}</div> : null}
              </div>
            </div>

            {payment.order ? (
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Resumo do pedido</div>
                <div className="mt-2 text-sm text-text">
                  <div>Status: {payment.order.status}</div>
                  <div>Pagamento: {payment.order.paymentStatus}</div>
                  <div>Total: {formatPrice(payment.order.total)}</div>
                  <div>Data: {formatDate(payment.order.createdAt)}</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </StaffShell>
  );
}
