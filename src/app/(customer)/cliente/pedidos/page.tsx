"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomerShell } from "@/components/customer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { AddressSchema, ListResponseSchema, OrderSchema, type Address, type Order } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { getOrderItemCount, getOrderStatusInfo, getPaymentStatusInfo } from "@/lib/order-ui";
import { buildWhatsappOrderMessage, buildWhatsappUrl } from "@/lib/whatsapp";
import { useAuth } from "@/hooks/use-auth";

const orderListSchema = ListResponseSchema(OrderSchema);
const addressListSchema = ListResponseSchema(AddressSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "error"; error?: string };

export default function CustomerOrdersPage() {
  const auth = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [actionState, setActionState] = useState<Record<string, ActionState | undefined>>({});
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);

  const fetchOrders = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/account/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = orderListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de pedidos");
      }
      setOrders(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchOrders();
  }, [auth.status, fetchOrders]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) return;
    api
      .get("/account/addresses", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        const parsed = addressListSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida de enderecos");
        }
        const preferred = parsed.data.items.find((item) => item.isDefault) ?? parsed.data.items[0] ?? null;
        setDefaultAddress(preferred);
      })
      .catch(() => undefined);
  }, [auth.status]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [orders]);

  const handleCancel = async (orderId: string) => {
    const token = getAccessToken();
    if (!token) {
      setActionState((prev) => ({ ...prev, [orderId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [orderId]: { status: "loading" } }));
    try {
      const response = await api.post(`/account/orders/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = OrderSchema.safeParse(response.data);
      if (parsed.success) {
        setOrders((prev) => prev.map((item) => (item.id === orderId ? parsed.data : item)));
      }
      setActionState((prev) => ({ ...prev, [orderId]: { status: "idle" } }));
    } catch (error) {
      setActionState((prev) => ({ ...prev, [orderId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleWhatsapp = (order: Order) => {
    const message = buildWhatsappOrderMessage(order, {
      name: auth.user?.name ?? auth.user?.email ?? undefined,
      phone: defaultAddress?.phone ?? undefined,
      address: defaultAddress ?? undefined
    });
    const whatsappUrl = buildWhatsappUrl(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP, message);
    if (!whatsappUrl) {
      setActionState((prev) => ({ ...prev, [order.id]: { status: "error", error: "Whatsapp nao configurado" } }));
      return;
    }
    window.open(whatsappUrl, "_blank");
  };

  return (
    <CustomerShell title="Pedidos" subtitle="Acompanhe seus pedidos e status em tempo real.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="rounded-2xl border border-border bg-surface/70 p-4 text-sm text-text">
          <div className="text-sm font-semibold text-text">Guia rapido</div>
          <div className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-2">
            <div>
              <span className="font-semibold text-text">Aguardando pagamento:</span> finalize o pagamento para iniciar o envio.
            </div>
            <div>
              <span className="font-semibold text-text">Pago:</span> pagamento confirmado, separando o pedido.
            </div>
            <div>
              <span className="font-semibold text-text">Enviado:</span> pedido em transporte.
            </div>
            <div>
              <span className="font-semibold text-text">Cancelado:</span> pedido encerrado sem envio.
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm font-semibold text-text">Historico de pedidos</div>
        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : orders.length ? (
          <div className="mt-4 space-y-4">
            {sortedOrders.map((order) => {
              const action = actionState[order.id];
              const orderNumber = order.id.slice(0, 8).toUpperCase();
              const statusInfo = getOrderStatusInfo(order.status);
              const paymentInfo = getPaymentStatusInfo(order.paymentStatus);
              const itemCount = getOrderItemCount(order.items);
              const discountTotal = Number(order.discountTotal ?? 0);
              const isFinalized = order.status === "SHIPPED" || order.status === "CANCELED";
              const hasPending =
                order.status === "PENDING" ||
                order.paymentStatus === "PENDING" ||
                order.paymentStatus === "AUTHORIZED";
              return (
                <div key={order.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-text">Pedido #{orderNumber}</div>
                      <div className="mt-1 text-xs text-muted">Criado: {formatDate(order.createdAt)}</div>
                      <div className="text-xs text-muted">Itens: {itemCount}</div>
                      {order.couponCode ? <div className="text-xs text-muted">Cupom: {order.couponCode}</div> : null}
                      {statusInfo.hint ? (
                        <div className="text-xs text-muted">Estado do pedido: {statusInfo.hint}</div>
                      ) : null}
                      {paymentInfo.hint ? (
                        <div className="text-xs text-muted">Pagamento: {paymentInfo.hint}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      <Badge variant={paymentInfo.variant}>Pagamento: {paymentInfo.label}</Badge>
                      <div className="text-sm font-semibold text-text">{formatPrice(order.total)}</div>
                      {discountTotal > 0 ? (
                        <div className="text-xs text-success">Desconto: {formatPrice(discountTotal)}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Link href={`/cliente/pedidos/${order.id}`} className="text-sm text-primary">
                        Ver detalhes
                      </Link>
                      {!isFinalized && hasPending && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleWhatsapp(order)}>
                          WhatsApp
                        </Button>
                      )}
                      {order.status === "PENDING" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(order.id)}
                          disabled={action?.status === "loading"}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {action?.status === "error" ? (
                    <div className="mt-2 text-xs text-amber-600">{action.error}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted">Nenhum pedido encontrado.</div>
        )}
      </section>
    </CustomerShell>
  );
}
