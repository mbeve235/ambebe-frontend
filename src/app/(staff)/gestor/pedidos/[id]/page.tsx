"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  ListResponseSchema,
  OrderItemSchema,
  StaffOrderSchema,
  type Address,
  type OrderItem,
  type StaffOrder
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { getOrderItemCount, getOrderStatusInfo, getPaymentStatusInfo, getPaymentProviderLabel } from "@/lib/order-ui";
import { useAuth } from "@/hooks/use-auth";

const itemListSchema = ListResponseSchema(OrderItemSchema);

const orderStatusOptions = ["PENDING", "PAID", "SHIPPED", "CANCELED"] as const;
const paymentStatusOptions = ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"] as const;

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getItemCostPriceSnapshot(attributesSnapshot: unknown): number | null {
  if (!attributesSnapshot || typeof attributesSnapshot !== "object" || Array.isArray(attributesSnapshot)) return null;
  const source = attributesSnapshot as Record<string, unknown>;
  return toNumber(source.costPriceSnapshot ?? source.costPrice ?? source.cost ?? source.cmv);
}

function getMarginPercent(price: unknown, costPrice: number | null): string {
  const sale = toNumber(price);
  if (sale === null || sale <= 0 || costPrice === null) return "N/A";
  return `${(((sale - costPrice) / sale) * 100).toFixed(1)}%`;
}

function getPrimaryAddress(addresses?: Address[]) {
  if (!addresses?.length) return null;
  return addresses.find((address) => address.isDefault) ?? addresses[0];
}

function formatAddress(address?: Address | null) {
  if (!address) return "Nao informado";
  const parts = [address.line1, address.line2, `${address.city}, ${address.state}`, address.postalCode, address.country].filter(Boolean);
  return parts.join(" | ");
}

function formatShippingSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "Nao informado";
  const source = snapshot as Record<string, unknown>;
  const parts = [
    typeof source.line1 === "string" ? source.line1 : null,
    typeof source.line2 === "string" ? source.line2 : null,
    typeof source.city === "string" && typeof source.state === "string" ? `${source.city}, ${source.state}` : null,
    typeof source.postalCode === "string" ? source.postalCode : null,
    typeof source.country === "string" ? source.country : null
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : "Nao informado";
}

export default function StaffOrderDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const orderId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [order, setOrder] = useState<StaffOrder | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [itemsState, setItemsState] = useState<LoadState>({ status: "loading" });

  const [status, setStatus] = useState<(typeof orderStatusOptions)[number]>("PENDING");
  const [paymentStatus, setPaymentStatus] = useState<(typeof paymentStatusOptions)[number]>("PENDING");
  const [statusState, setStatusState] = useState<ActionState>({ status: "idle" });
  const [paymentState, setPaymentState] = useState<ActionState>({ status: "idle" });

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get(`/staff/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = StaffOrderSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do pedido");
      }
      setOrder(parsed.data);
      setStatus(parsed.data.status as (typeof orderStatusOptions)[number]);
      setPaymentStatus(parsed.data.paymentStatus as (typeof paymentStatusOptions)[number]);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [orderId]);

  const fetchItems = useCallback(async () => {
    if (!orderId) return;
    const token = getAccessToken();
    if (!token) {
      setItemsState({ status: "error", error: "Token ausente" });
      return;
    }

    setItemsState({ status: "loading" });
    try {
      const response = await api.get(`/staff/orders/${orderId}/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = itemListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida dos itens");
      }
      setItems(parsed.data.items);
      setItemsState({ status: "ready" });
    } catch (error) {
      setItemsState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [orderId]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchOrder();
    fetchItems();
  }, [auth.status, fetchItems, fetchOrder]);

  const handleUpdateStatus = async () => {
    if (!orderId) return;
    const token = getAccessToken();
    if (!token) {
      setStatusState({ status: "error", error: "Token ausente" });
      return;
    }

    setStatusState({ status: "loading" });
    try {
      await api.patch(
        `/staff/orders/${orderId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusState({ status: "success" });
      await fetchOrder();
    } catch (error) {
      setStatusState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdatePayment = async () => {
    if (!orderId) return;
    const token = getAccessToken();
    if (!token) {
      setPaymentState({ status: "error", error: "Token ausente" });
      return;
    }

    setPaymentState({ status: "loading" });
    try {
      await api.patch(
        `/staff/orders/${orderId}/payment-status`,
        { paymentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPaymentState({ status: "success" });
      await fetchOrder();
    } catch (error) {
      setPaymentState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const primaryAddress = getPrimaryAddress(order?.user?.addresses);
  const fallbackPhone = order?.user?.addresses?.find((address) => Boolean(address.phone))?.phone;
  const customerPhone = primaryAddress?.phone ?? fallbackPhone ?? "Nao informado";
  const customerAddress = formatAddress(primaryAddress);
  const customerSince = order?.user?.createdAt ? formatDate(order.user.createdAt) : "Nao informado";
  const addressCount = order?.user?.addresses?.length ?? 0;
  const shippingSnapshot = formatShippingSnapshot(order?.shippingAddressSnapshot);
  const statusHistory = order?.statusHistory ?? [];

  return (
    <StaffShell title="Detalhe do pedido" subtitle="Atualize status, itens e informacoes de pagamento.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/gestor/pedidos" className="text-sm text-primary">
          Voltar para pedidos
        </Link>

        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : order ? (
          <div className="mt-4 space-y-6">
            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Cliente</div>
              <div className="mt-2 text-sm text-text">
                <div>Nome: {order.customerNameSnapshot || order.user?.name || "Nao informado"}</div>
                <div>Email: {order.customerEmailSnapshot || order.user?.email || "Nao informado"}</div>
                <div>ID do cliente: {order.user?.id || "Nao informado"}</div>
                <div>Telefone: {order.customerPhoneSnapshot || customerPhone}</div>
                <div>Endereco principal: {customerAddress}</div>
                <div>Endereco no pedido: {shippingSnapshot}</div>
                <div>Enderecos cadastrados: {addressCount}</div>
                <div>Conta do cliente: {customerSince}</div>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Resumo</div>
                <div className="mt-2 text-sm text-text">
                  <div>Pedido: {order.orderNumber || order.id}</div>
                  <div>ID tecnico: {order.id}</div>
                  <div>Cliente: {order.user?.name || order.user?.email || order.userId}</div>
                  <div>Itens: {getOrderItemCount(order.items)}</div>
                  <div>Data: {formatDate(order.createdAt)}</div>
                  <div>Ultima atualizacao: {formatDate(order.updatedAt)}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={getOrderStatusInfo(order.status).variant}>
                      {getOrderStatusInfo(order.status).label}
                    </Badge>
                    <Badge variant={getPaymentStatusInfo(order.paymentStatus).variant}>
                      Pagamento: {getPaymentStatusInfo(order.paymentStatus).label}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-text">Total: {formatPrice(order.total)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Acoes do pedido</div>
                <div className="mt-3 space-y-3">
                  <Select value={status} onValueChange={(value) => setStatus(value as (typeof orderStatusOptions)[number])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderStatusOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {getOrderStatusInfo(option).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={handleUpdateStatus}>
                    Atualizar status
                  </Button>
                  {statusState.status === "error" ? (
                    <div className="text-xs text-amber-600">{statusState.error}</div>
                  ) : statusState.status === "success" ? (
                    <div className="text-xs text-success">Status atualizado.</div>
                  ) : null}

                  <Select
                    value={paymentStatus}
                    onValueChange={(value) => setPaymentStatus(value as (typeof paymentStatusOptions)[number])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentStatusOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {getPaymentStatusInfo(option).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" onClick={handleUpdatePayment}>
                    Atualizar pagamento
                  </Button>
                  {paymentState.status === "error" ? (
                    <div className="text-xs text-amber-600">{paymentState.error}</div>
                  ) : paymentState.status === "success" ? (
                    <div className="text-xs text-success">Pagamento atualizado.</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Itens</div>
              {itemsState.status === "loading" ? (
                <div className="mt-3 space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              ) : itemsState.status === "error" ? (
                <div className="mt-3 text-sm text-amber-600">{itemsState.error}</div>
              ) : items.length ? (
                <div className="mt-3 space-y-3">
                  {items.map((item) => {
                    const costPrice = getItemCostPriceSnapshot(item.attributesSnapshot);
                    const margin = getMarginPercent(item.priceSnapshot, costPrice);
                    return (
                      <div key={item.id} className="rounded-2xl border border-border bg-surface/80 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-text">{item.nameSnapshot}</div>
                            <div className="text-xs text-muted">SKU: {item.skuSnapshot}</div>
                            <div className="text-xs text-muted">Quantidade: {item.quantity}</div>
                            <div className="text-xs text-muted">
                              CMV snapshot: {costPrice === null ? "N/A" : formatPrice(costPrice)} | Margem estimada: {margin}
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted">
                            <div>Preco unitario: {formatPrice(item.priceSnapshot)}</div>
                            <div>Total: {formatPrice(Number(item.priceSnapshot) * item.quantity)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted">Nenhum item encontrado.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Pagamento</div>
              {order.payment ? (
                <div className="mt-2 text-sm text-text">
                  <div>Status: {getPaymentStatusInfo(order.payment.status).label}</div>
                  <div>Valor: {formatPrice(order.payment.amount)}</div>
                  {order.payment.provider ? (
                    <div>Provedor: {getPaymentProviderLabel(order.payment.provider) ?? order.payment.provider}</div>
                  ) : null}
                  {order.payment.externalRef ? <div>Referencia: {order.payment.externalRef}</div> : null}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted">Sem pagamento associado.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Historico de status</div>
              {statusHistory.length ? (
                <div className="mt-3 space-y-2">
                  {statusHistory.map((event) => (
                    <div key={event.id} className="rounded-xl border border-border/70 px-3 py-2 text-xs">
                      <div className="font-semibold text-text">
                        {event.type === "order.status_changed" ? "Status do pedido" : "Status de pagamento"}:{" "}
                        {event.from || "N/A"} {"->"} {event.to || "N/A"}
                      </div>
                      <div className="text-muted">
                        {formatDate(event.createdAt)} | {event.actor?.name || event.actor?.email || "Sistema"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted">Sem alteracoes de status registradas.</div>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </StaffShell>
  );
}
