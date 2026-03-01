"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { ListResponseSchema, PaymentWithOrderSchema, type PaymentWithOrder } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { getPaymentProviderLabel, getPaymentStatusInfo } from "@/lib/order-ui";
import { useAuth } from "@/hooks/use-auth";

const paymentListSchema = ListResponseSchema(PaymentWithOrderSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function StaffPaymentsPage() {
  const auth = useAuth();
  const [payments, setPayments] = useState<PaymentWithOrder[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchPayments = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/staff/payments", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = paymentListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de pagamentos");
      }
      setPayments(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchPayments();
  }, [auth.status, fetchPayments]);

  return (
    <StaffShell title="Pagamentos" subtitle="Monitore transacoes e conciliacao por pedido.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="text-sm font-semibold text-text">Transacoes de pagamento</div>
        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : payments.length ? (
          <div className="mt-4 space-y-4">
            {payments.map((payment) => {
              const paymentInfo = getPaymentStatusInfo(payment.status);
              return (
                <div key={payment.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-text">Pagamento {payment.id.slice(0, 8)}</div>
                      <div className="text-xs text-muted">Pedido: {payment.order?.id ?? payment.orderId}</div>
                      <div className="text-xs text-muted">Valor: {formatPrice(payment.amount)}</div>
                      <div className="text-xs text-muted">
                        Provedor: {getPaymentProviderLabel(payment.provider) ?? payment.provider ?? "Nao informado"}
                      </div>
                      <div className="text-xs text-muted">Data: {formatDate(payment.createdAt)}</div>
                      <Link href={`/gestor/pagamentos/${payment.id}`} className="text-xs text-primary">
                        Ver detalhes
                      </Link>
                    </div>
                    <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted">Nenhum pagamento encontrado.</div>
        )}
      </section>
    </StaffShell>
  );
}
