"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { ListResponseSchema, StaffOrderSchema, type StaffOrder } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { getOrderItemCount, getOrderStatusInfo, getPaymentStatusInfo } from "@/lib/order-ui";
import { useAuth } from "@/hooks/use-auth";

const orderListSchema = ListResponseSchema(StaffOrderSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function AdminOrdersPage() {
  const auth = useAuth();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const fetchOrders = useCallback(async (filters?: { email?: string; status?: string; paymentStatus?: string }) => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/staff/orders", {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
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

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [orders]);

  const handleFilter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchOrders({
      email: emailFilter.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      paymentStatus: paymentFilter === "all" ? undefined : paymentFilter
    });
  };

  const handleClear = async () => {
    setEmailFilter("");
    setStatusFilter("all");
    setPaymentFilter("all");
    await fetchOrders();
  };

  return (
    <AdminShell title="Pedidos" subtitle="Acompanhe pedidos e pagamentos em tempo real.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="text-sm font-semibold text-text">Filtros</div>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={handleFilter}>
          <div className="min-w-[220px]">
            <div className="text-xs text-muted">Email do cliente</div>
            <Input
              value={emailFilter}
              onChange={(event) => setEmailFilter(event.target.value)}
              placeholder="cliente@email.com"
            />
          </div>
          <div className="min-w-[200px]">
            <div className="text-xs text-muted">Status do pedido</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {["PENDING", "PAID", "SHIPPED", "CANCELED"].map((option) => (
                  <SelectItem key={option} value={option}>
                    {getOrderStatusInfo(option).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <div className="text-xs text-muted">Pagamento</div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"].map((option) => (
                  <SelectItem key={option} value={option}>
                    {getPaymentStatusInfo(option).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Aplicar filtros</Button>
          <Button type="button" variant="ghost" onClick={handleClear}>
            Limpar
          </Button>
        </form>

        <div className="mt-6 text-sm font-semibold text-text">Pedidos recentes</div>
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
              const statusInfo = getOrderStatusInfo(order.status);
              const paymentInfo = getPaymentStatusInfo(order.paymentStatus);
              const itemCount = getOrderItemCount(order.items);
              const orderNumber = order.id.slice(0, 8).toUpperCase();
              return (
                <div key={order.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-text">Pedido #{orderNumber}</div>
                      <div className="text-xs text-muted">
                        Cliente: {order.user?.name || order.user?.email || order.userId}
                      </div>
                      <div className="text-xs text-muted">Itens: {itemCount}</div>
                      <div className="text-xs text-muted">Data: {formatDate(order.createdAt)}</div>
                      {statusInfo.hint ? (
                        <div className="text-xs text-muted">Estado do pedido: {statusInfo.hint}</div>
                      ) : null}
                      {paymentInfo.hint ? (
                        <div className="text-xs text-muted">Pagamento: {paymentInfo.hint}</div>
                      ) : null}
                      <Link href={`/admin/pedidos/${order.id}`} className="text-xs text-primary">
                        Ver detalhes
                      </Link>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      <Badge variant={paymentInfo.variant}>Pagamento: {paymentInfo.label}</Badge>
                      <div className="text-sm font-semibold text-text">{formatPrice(order.total)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted">Nenhum pedido encontrado.</div>
        )}
      </section>
    </AdminShell>
  );
}
