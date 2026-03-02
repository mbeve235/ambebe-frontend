"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
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

function StaffOrdersPageContent() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [orderFilter, setOrderFilter] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [minTotalFilter, setMinTotalFilter] = useState("");
  const [maxTotalFilter, setMaxTotalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const preset = searchParams.get("preset") || "";
  const channelFilter = searchParams.get("channel") || "";

  const channelFromProvider = (provider?: string | null) => {
    const p = (provider || "").toUpperCase();
    if (p.includes("MPESA") || p.includes("EMOLA")) return "Mobile";
    if (p.includes("PAYPAL")) return "Marketplace";
    if (p.includes("FACEBOOK") || p.includes("INSTAGRAM")) return "Social";
    if (p.includes("STRIPE") || p.includes("COD")) return "Site";
    return "Other";
  };

  const fetchOrders = useCallback(async (filters?: Record<string, string | number | undefined>) => {
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
      setPage(parsed.data.page ?? 1);
      setLimit(parsed.data.limit ?? 20);
      setTotal(parsed.data.total ?? parsed.data.items.length);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const orderId = searchParams.get("orderId") || "";
    const name = searchParams.get("name") || "";
    const phone = searchParams.get("phone") || "";
    const email = searchParams.get("email") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const minTotal = searchParams.get("minTotal") || "";
    const maxTotal = searchParams.get("maxTotal") || "";
    const status = searchParams.get("status") || "all";
    const paymentStatus = searchParams.get("paymentStatus") || "all";
    const pageParam = Number(searchParams.get("page") || "1");
    const limitParam = Number(searchParams.get("limit") || "20");
    setOrderFilter(orderId);
    setCustomerNameFilter(name);
    setPhoneFilter(phone);
    setEmailFilter(email);
    setDateFromFilter(dateFrom);
    setDateToFilter(dateTo);
    setMinTotalFilter(minTotal);
    setMaxTotalFilter(maxTotal);
    setStatusFilter(status);
    setPaymentFilter(paymentStatus);
    fetchOrders({
      orderId: orderId.trim() || undefined,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minTotal: minTotal || undefined,
      maxTotal: maxTotal || undefined,
      status: status === "all" ? undefined : status,
      paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20
    });
  }, [auth.status, fetchOrders, searchParams]);

  const sortedOrders = useMemo(() => {
    const now = Date.now();
    const filtered = orders.filter((order) => {
      if (channelFilter && channelFromProvider(order.payment?.provider) !== channelFilter) {
        return false;
      }
      if (preset === "pending") {
        return order.status === "PENDING" || order.paymentStatus === "PENDING";
      }
      if (preset === "problem") {
        return order.paymentStatus === "FAILED" || order.paymentStatus === "REFUNDED";
      }
      if (preset === "delayed") {
        const createdAt = new Date(order.createdAt).getTime();
        const ageHours = (now - createdAt) / (1000 * 60 * 60);
        return order.status !== "SHIPPED" && order.status !== "CANCELED" && ageHours >= 48;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [orders, preset, channelFilter]);

  const handleFilter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    const orderId = orderFilter.trim();
    if (orderId) next.set("orderId", orderId);
    else next.delete("orderId");

    const name = customerNameFilter.trim();
    if (name) next.set("name", name);
    else next.delete("name");

    const phone = phoneFilter.trim();
    if (phone) next.set("phone", phone);
    else next.delete("phone");

    const email = emailFilter.trim();
    if (email) next.set("email", email);
    else next.delete("email");

    if (dateFromFilter) next.set("dateFrom", dateFromFilter);
    else next.delete("dateFrom");

    if (dateToFilter) next.set("dateTo", dateToFilter);
    else next.delete("dateTo");

    const minTotal = minTotalFilter.trim();
    if (minTotal) next.set("minTotal", minTotal);
    else next.delete("minTotal");

    const maxTotal = maxTotalFilter.trim();
    if (maxTotal) next.set("maxTotal", maxTotal);
    else next.delete("maxTotal");

    if (statusFilter !== "all") next.set("status", statusFilter);
    else next.delete("status");

    if (paymentFilter !== "all") next.set("paymentStatus", paymentFilter);
    else next.delete("paymentStatus");

    next.set("page", "1");

    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  };

  const goToPage = (targetPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(Math.max(1, targetPage)));
    router.replace(`${pathname}?${next.toString()}`);
  };

  const handleClear = () => {
    setOrderFilter("");
    setCustomerNameFilter("");
    setPhoneFilter("");
    setEmailFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setMinTotalFilter("");
    setMaxTotalFilter("");
    setStatusFilter("all");
    setPaymentFilter("all");
    router.replace(pathname);
  };

  return (
    <StaffShell title="Pedidos" subtitle="Acompanhe pedidos, pagamento e prioridades operacionais.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="text-sm font-semibold text-text">Filtros</div>
        {preset || channelFilter || orderFilter || customerNameFilter || phoneFilter || emailFilter || dateFromFilter || dateToFilter || minTotalFilter || maxTotalFilter ? (
          <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-text">
            Contexto aplicado:
            {preset ? ` preset=${preset}` : ""}
            {channelFilter ? ` canal=${channelFilter}` : ""}
            {orderFilter ? ` pedido=${orderFilter}` : ""}
            {" | "}
            <Link href="/gestor/pedidos" className="text-primary">
              Limpar contexto
            </Link>
          </div>
        ) : null}
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={handleFilter}>
          <div className="min-w-[220px]">
            <div className="text-xs text-muted">Pedido (numero ou ID)</div>
            <Input
              value={orderFilter}
              onChange={(event) => setOrderFilter(event.target.value)}
              placeholder="Ex: 38f96d6b ou UUID completo"
            />
          </div>
          <div className="min-w-[220px]">
            <div className="text-xs text-muted">Email do cliente</div>
            <Input
              value={emailFilter}
              onChange={(event) => setEmailFilter(event.target.value)}
              placeholder="cliente@email.com"
            />
          </div>
          <div className="min-w-[220px]">
            <div className="text-xs text-muted">Nome do cliente</div>
            <Input
              value={customerNameFilter}
              onChange={(event) => setCustomerNameFilter(event.target.value)}
              placeholder="Nome"
            />
          </div>
          <div className="min-w-[200px]">
            <div className="text-xs text-muted">Telefone</div>
            <Input
              value={phoneFilter}
              onChange={(event) => setPhoneFilter(event.target.value)}
              placeholder="+258..."
            />
          </div>
          <div className="min-w-[170px]">
            <div className="text-xs text-muted">De</div>
            <Input type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} />
          </div>
          <div className="min-w-[170px]">
            <div className="text-xs text-muted">Ate</div>
            <Input type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} />
          </div>
          <div className="min-w-[140px]">
            <div className="text-xs text-muted">Min total</div>
            <Input type="number" min="0" step="0.01" value={minTotalFilter} onChange={(event) => setMinTotalFilter(event.target.value)} />
          </div>
          <div className="min-w-[140px]">
            <div className="text-xs text-muted">Max total</div>
            <Input type="number" min="0" step="0.01" value={maxTotalFilter} onChange={(event) => setMaxTotalFilter(event.target.value)} />
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
        ) : sortedOrders.length ? (
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
                      <div className="text-sm font-semibold text-text">
                        Pedido {order.orderNumber ? `#${order.orderNumber}` : `#${orderNumber}`}
                      </div>
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
                      <Link href={`/gestor/pedidos/${order.id}`} className="text-xs text-primary">
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
            <div className="mt-2 flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-xs text-muted">
              <div>
                Pagina {page} | Itens por pagina {limit} | Total {total}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                  Anterior
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => goToPage(page + 1)}
                  disabled={page * limit >= total}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted">Nenhum pedido encontrado.</div>
        )}
      </section>
    </StaffShell>
  );
}

export default function StaffOrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <StaffOrdersPageContent />
    </Suspense>
  );
}
