"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  CategorySchema,
  ListResponseSchema,
  PaymentWithOrderSchema,
  ProductSchema,
  StaffOrderSchema,
  StockItemSchema,
  type Category,
  type PaymentWithOrder,
  type Product,
  type StaffOrder,
  type StockItem
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const categoryListSchema = ListResponseSchema(CategorySchema);
const productListSchema = ListResponseSchema(ProductSchema);
const stockListSchema = ListResponseSchema(StockItemSchema);
const orderListSchema = ListResponseSchema(StaffOrderSchema);
const paymentListSchema = ListResponseSchema(PaymentWithOrderSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };
type PeriodKey = "day" | "month" | "quarter";
type SalesWindow = "24h" | "7d" | "30d";

type DashboardData = {
  categories: Category[];
  products: Product[];
  stockItems: StockItem[];
  orders: StaffOrder[];
  payments: PaymentWithOrder[];
};

const STOCK_MIN = 5;

const PERIODS: Array<{ value: PeriodKey; label: string }> = [
  { value: "day", label: "Hoje" },
  { value: "month", label: "Mes" },
  { value: "quarter", label: "Trimestre" }
];

const WINDOWS: Array<{ value: SalesWindow; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" }
];

const toNumber = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const toDate = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const isRevenueOrder = (o: StaffOrder) =>
  o.status === "PAID" || o.status === "SHIPPED" || o.paymentStatus === "CAPTURED" || o.paymentStatus === "AUTHORIZED";
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function periodRange(period: PeriodKey, now: Date, offset = 0) {
  if (period === "day") {
    const s = addDays(startOfDay(now), offset);
    return { start: s, end: addDays(s, 1) };
  }
  if (period === "month") {
    const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { start: s, end: new Date(s.getFullYear(), s.getMonth() + 1, 1) };
  }
  const qStart = Math.floor(now.getMonth() / 3) * 3 + offset * 3;
  const s = new Date(now.getFullYear(), qStart, 1);
  return { start: s, end: new Date(s.getFullYear(), s.getMonth() + 3, 1) };
}

function channelFromProvider(provider?: string | null) {
  const p = (provider || "").toUpperCase();
  if (p.includes("MPESA") || p.includes("EMOLA")) return "Mobile";
  if (p.includes("PAYPAL")) return "Marketplace";
  if (p.includes("FACEBOOK") || p.includes("INSTAGRAM")) return "Redes sociais";
  if (p.includes("STRIPE") || p.includes("COD")) return "Site";
  return "Outros";
}

function Metric({ title, value, helper }: { title: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/80 p-4">
      <div className="text-xs text-muted">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-text">{value}</div>
      {helper ? <div className="mt-1 text-xs text-muted">{helper}</div> : null}
    </div>
  );
}

export default function StaffOverviewPage() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [window, setWindow] = useState<SalesWindow>("7d");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Sessao invalida." });
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    setState({ status: "loading" });
    Promise.allSettled([
      api.get("/staff/categories", { headers }),
      api.get("/staff/products", { headers }),
      api.get("/staff/inventory/stock-items", { headers }),
      api.get("/staff/orders", { headers }),
      api.get("/staff/payments", { headers })
    ])
      .then(([c, p, s, o, pay]) => {
        if (c.status !== "fulfilled" || p.status !== "fulfilled" || s.status !== "fulfilled" || o.status !== "fulfilled" || pay.status !== "fulfilled") {
          throw new Error("Falha ao carregar dashboard.");
        }
        const cp = categoryListSchema.safeParse(c.value.data);
        const pp = productListSchema.safeParse(p.value.data);
        const sp = stockListSchema.safeParse(s.value.data);
        const op = orderListSchema.safeParse(o.value.data);
        const pap = paymentListSchema.safeParse(pay.value.data);
        if (!cp.success || !pp.success || !sp.success || !op.success || !pap.success) {
          throw new Error("Resposta invalida.");
        }
        setData({
          categories: cp.data.items,
          products: pp.data.items,
          stockItems: sp.data.items,
          orders: op.data.items,
          payments: pap.data.items
        });
        setState({ status: "ready" });
      })
      .catch((err) => setState({ status: "error", error: getApiErrorMessage(err) }));
  }, [auth.status]);

  const m = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const curr = periodRange(period, now);
    const prev = periodRange(period, now, -1);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const inCurr = data.orders.filter((o) => {
      const d = toDate(o.createdAt);
      return d ? d >= curr.start && d < curr.end : false;
    });
    const inPrev = data.orders.filter((o) => {
      const d = toDate(o.createdAt);
      return d ? d >= prev.start && d < prev.end : false;
    });
    const revCurr = inCurr.filter(isRevenueOrder);
    const revPrev = inPrev.filter(isRevenueOrder);
    const sales = revCurr.reduce((sum, o) => sum + toNumber(o.total), 0);
    const prevSales = revPrev.reduce((sum, o) => sum + toNumber(o.total), 0);
    const expected = prevSales > 0 ? prevSales * 1.05 : sales * 0.9;
    const delta = expected > 0 ? ((sales - expected) / expected) * 100 : 0;
    const ticket = revCurr.length ? sales / revCurr.length : 0;
    const conv = inCurr.length ? (revCurr.length / inCurr.length) * 100 : 0;

    const salesByCategoryMap = new Map<string, number>();
    const productById = new Map(data.products.map((p) => [p.id, p]));
    for (const o of revCurr) {
      for (const item of o.items ?? []) {
        const amount = toNumber(item.priceSnapshot) * toNumber(item.quantity);
        const prod = item.productId ? productById.get(item.productId) : null;
        const cat = prod?.categories?.[0]?.category?.name || "Sem categoria";
        salesByCategoryMap.set(cat, (salesByCategoryMap.get(cat) || 0) + amount);
      }
    }
    const salesByCategory = Array.from(salesByCategoryMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    const channelMap = new Map<string, number>();
    for (const p of data.payments) {
      const d = toDate(p.createdAt);
      if (!d || d < curr.start || d >= curr.end) continue;
      const channel = channelFromProvider(p.provider);
      channelMap.set(channel, (channelMap.get(channel) || 0) + toNumber(p.amount));
    }
    const channels = ["Site", "Mobile", "Marketplace", "Redes sociais", "Outros"].map((label) => ({ label, value: channelMap.get(label) || 0 }));

    const inventoryValue = data.stockItems.reduce((sum, item) => sum + toNumber(item.variant?.price) * item.onHand, 0);
    const criticalStock = data.stockItems.filter((i) => i.onHand <= 0);
    const warningStock = data.stockItems.filter((i) => i.onHand > 0 && i.onHand <= STOCK_MIN);

    const fastMap = new Map<string, number>();
    for (const o of data.orders) {
      const d = toDate(o.createdAt);
      if (!d || d < dayAgo) continue;
      for (const item of o.items ?? []) {
        const key = item.productId || item.nameSnapshot;
        fastMap.set(key, (fastMap.get(key) || 0) + toNumber(item.quantity));
      }
    }
    const fastMoving = Array.from(fastMap.entries()).map(([id, qty]) => ({ id, qty, name: productById.get(id)?.name || id })).filter((i) => i.qty >= 50).sort((a, b) => b.qty - a.qty).slice(0, 6);

    const pendingOrders = data.orders.filter((o) => o.status === "PENDING" || o.paymentStatus === "PENDING" || o.paymentStatus === "AUTHORIZED");
    const problemOrders = data.orders.filter((o) => o.paymentStatus === "FAILED" || o.paymentStatus === "REFUNDED" || o.status === "CANCELED");
    const delayedOrders = data.orders.filter((o) => {
      const d = toDate(o.createdAt);
      if (!d) return false;
      return o.status !== "SHIPPED" && o.status !== "CANCELED" && (now.getTime() - d.getTime()) / (1000 * 60 * 60) >= 48;
    });
    const refunds = data.payments.filter((p) => p.status === "REFUNDED");
    const refundTotal = refunds.reduce((sum, p) => sum + toNumber(p.amount), 0);

    const salesStart = window === "24h" ? dayAgo : window === "7d" ? sevenAgo : thirtyAgo;
    const prodPerf = new Map<string, { name: string; qty: number; revenue: number; price: number }>();
    for (const o of data.orders) {
      const d = toDate(o.createdAt);
      if (!d || d < salesStart) continue;
      for (const item of o.items ?? []) {
        const id = item.productId || `x:${item.nameSnapshot}`;
        const currP = prodPerf.get(id) || { name: productById.get(id)?.name || item.nameSnapshot || "Produto", qty: 0, revenue: 0, price: toNumber(productById.get(id)?.basePrice) };
        currP.qty += toNumber(item.quantity);
        currP.revenue += toNumber(item.priceSnapshot) * toNumber(item.quantity);
        prodPerf.set(id, currP);
      }
    }
    const topProducts = Array.from(prodPerf.entries()).map(([id, p]) => ({ id, ...p, profit: p.revenue * NET_MARGIN_RATE })).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const lowPerformance = data.products.map((p) => ({ id: p.id, name: p.name, sold: prodPerf.get(p.id)?.qty || 0 })).filter((p) => p.sold === 0).slice(0, 8);
    const highMargin = data.products.map((p) => ({ id: p.id, name: p.name, price: toNumber(p.basePrice), margin: toNumber(p.basePrice) * GROSS_MARGIN_RATE })).sort((a, b) => b.margin - a.margin).slice(0, 8);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const todayStart = startOfDay(now);
    const weekStart = addDays(todayStart, -6);
    const revenueToday = data.orders.filter((o) => { const d = toDate(o.createdAt); return d ? d >= todayStart && isRevenueOrder(o) : false; }).reduce((s, o) => s + toNumber(o.total), 0);
    const revenueWeek = data.orders.filter((o) => { const d = toDate(o.createdAt); return d ? d >= weekStart && isRevenueOrder(o) : false; }).reduce((s, o) => s + toNumber(o.total), 0);
    const revenueMonth = data.orders.filter((o) => { const d = toDate(o.createdAt); return d ? d >= monthStart && d < monthEnd && isRevenueOrder(o) : false; }).reduce((s, o) => s + toNumber(o.total), 0);
    const gross = revenueMonth * GROSS_MARGIN_RATE;
    const net = revenueMonth * NET_MARGIN_RATE;
    const received = data.payments.filter((p) => p.status === "CAPTURED").reduce((s, p) => s + toNumber(p.amount), 0);
    const pendingPay = data.payments.filter((p) => p.status === "PENDING" || p.status === "AUTHORIZED").reduce((s, p) => s + toNumber(p.amount), 0);
    const projRevenue = (revenueMonth / Math.max(1, now.getDate())) * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projNet = projRevenue * NET_MARGIN_RATE;

    const trendByCategory = salesByCategory.map((item) => ({ label: item.label, value: item.value }));
    const avgDaily = data.orders.filter((o) => { const d = toDate(o.createdAt); return d ? d >= thirtyAgo && isRevenueOrder(o) : false; }).reduce((s, o) => s + toNumber(o.total), 0) / 30;
    const forecast30 = avgDaily * 30;
    const forecast60 = avgDaily * 60;
    const forecast90 = avgDaily * 90;

    return {
      sales,
      expected,
      delta,
      ticket,
      conv,
      salesByCategory,
      channels,
      inventoryValue,
      criticalStock,
      warningStock,
      fastMoving,
      pendingOrders,
      problemOrders,
      delayedOrders,
      refundTotal,
      refundCount: refunds.length,
      topProducts,
      lowPerformance,
      highMargin,
      revenueToday,
      revenueWeek,
      revenueMonth,
      gross,
      net,
      received,
      pendingPay,
      projRevenue,
      projNet,
      trendByCategory,
      forecast30,
      forecast60,
      forecast90
    };
  }, [data, period, window]);

  return (
    <StaffShell title="Dashboard visual do gestor" subtitle="Foco em vendas, estoque, pedidos e lucro para decisoes de negocio.">
      {state.status === "loading" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="rounded-2xl border border-border p-4"><Skeleton className="h-4 w-20" /><Skeleton className="mt-3 h-8 w-24" /></div>)}</div>
      ) : state.status === "error" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{state.error}</div>
      ) : m ? (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-text">Visao geral de vendas e desempenho</div>
              <div className="flex flex-wrap gap-2">{PERIODS.map((p) => <Button key={p.value} size="sm" variant={period === p.value ? "default" : "outline"} onClick={() => setPeriod(p.value)}>{p.label}</Button>)}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Total de vendas" value={formatPrice(m.sales)} helper={`${m.delta >= 0 ? "+" : ""}${m.delta.toFixed(1)}% vs esperado`} />
              <Metric title="Ticket medio" value={formatPrice(m.ticket)} />
              <Metric title="Taxa de conversao" value={`${m.conv.toFixed(1)}%`} helper="Proxy: pedidos pagos/pedidos totais" />
              <Metric title="Pagamentos pendentes" value={formatPrice(m.pendingPay)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="text-sm font-semibold text-text">Vendas por categoria</div>
                <div className="mt-3 space-y-2">
                  {m.salesByCategory.map((c) => <div key={c.label} className="text-xs"><div className="flex justify-between"><span className="text-muted">{c.label}</span><span className="font-semibold text-text">{formatPrice(c.value)}</span></div><div className="mt-1 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(5, (c.value / Math.max(...m.salesByCategory.map((x) => x.value), 1)) * 100)}%` }} /></div></div>)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="text-sm font-semibold text-text">Vendas por canal</div>
                <div className="mt-3 space-y-2">{m.channels.map((c) => <div key={c.label} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-xs"><span className="text-muted">{c.label}</span><span className="font-semibold text-text">{formatPrice(c.value)}</span></div>)}</div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">Gestao de estoque</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Valor total do estoque" value={formatPrice(m.inventoryValue)} />
              <Metric title="Itens criticos" value={String(m.criticalStock.length)} />
              <Metric title="Itens em atencao" value={String(m.warningStock.length)} />
              <Metric title="Produtos escoando rapido" value={String(m.fastMoving.length)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="flex items-center justify-between"><div className="text-sm font-semibold text-text">Estoque critico</div><Link href="/gestor/estoque" className="text-xs text-primary">Reabastecer</Link></div>
                <div className="mt-3 space-y-2">{m.criticalStock.slice(0, 8).map((i) => <div key={i.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><span className="text-text">{i.variant?.name || i.variantId}</span><Badge variant="warning">Urgente</Badge></div>)}{!m.criticalStock.length ? <div className="text-xs text-muted">Sem itens em ruptura.</div> : null}</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="text-sm font-semibold text-text">Produtos com alta saida (24h)</div>
                <div className="mt-3 space-y-2">{m.fastMoving.map((i) => <div key={i.id} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-xs"><span className="text-text">{i.name}</span><Badge variant="warning">{i.qty} un</Badge></div>)}{!m.fastMoving.length ? <div className="text-xs text-muted">Sem produtos acima de 50 unidades.</div> : null}</div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">Pedidos pendentes e acoes necessarias</div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface/80 p-5"><div className="text-sm font-semibold text-text">Pendentes</div><div className="mt-3 space-y-2">{m.pendingOrders.slice(0, 6).map((o) => <Link key={o.id} href={`/gestor/pedidos/${o.id}`} className="block rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">#{o.id.slice(0, 8).toUpperCase()}</div><div className="text-muted">{formatPrice(o.total)}</div></Link>)}{!m.pendingOrders.length ? <div className="text-xs text-muted">Nenhum pedido pendente.</div> : null}</div></div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5"><div className="text-sm font-semibold text-text">Com problema</div><div className="mt-3 space-y-2">{m.problemOrders.slice(0, 6).map((o) => <Link key={o.id} href={`/gestor/pedidos/${o.id}`} className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><div className="font-semibold text-text">#{o.id.slice(0, 8).toUpperCase()}</div><div className="text-muted">{formatPrice(o.total)}</div></Link>)}{!m.problemOrders.length ? <div className="text-xs text-muted">Sem problemas criticos.</div> : null}</div></div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5"><div className="text-sm font-semibold text-text">Atrasados</div><div className="mt-3 space-y-2">{m.delayedOrders.slice(0, 6).map((o) => <Link key={o.id} href={`/gestor/pedidos/${o.id}`} className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><div className="font-semibold text-text">#{o.id.slice(0, 8).toUpperCase()}</div><div className="text-muted">{formatDate(o.createdAt)}</div></Link>)}{!m.delayedOrders.length ? <div className="text-xs text-muted">Sem atrasos relevantes.</div> : null}</div></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric title="Reembolsos (valor)" value={formatPrice(m.refundTotal)} />
              <Metric title="Reembolsos (quantidade)" value={String(m.refundCount)} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-text">Produtos em destaque e performantes</div>
              <div className="flex flex-wrap gap-2">{WINDOWS.map((w) => <Button key={w.value} size="sm" variant={window === w.value ? "default" : "outline"} onClick={() => setWindow(w.value)}>{w.label}</Button>)}</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/80 p-5"><div className="text-sm font-semibold text-text">Top vendidos</div><div className="mt-3 space-y-2">{m.topProducts.slice(0, 8).map((p) => <div key={p.id} className="rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">{p.name}</div><div className="text-muted">Qtd: {p.qty} | Receita: {formatPrice(p.revenue)} | Lucro: {formatPrice(p.profit)}</div></div>)}</div></div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5"><div className="text-sm font-semibold text-text">Baixa performance / margem alta</div><div className="mt-3 space-y-2">{m.lowPerformance.slice(0, 4).map((p) => <div key={p.id} className="rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">{p.name}</div><div className="text-muted">Sem vendas no recorte atual.</div></div>)}{m.highMargin.slice(0, 4).map((p) => <div key={p.id} className="rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">{p.name}</div><div className="text-muted">Preco: {formatPrice(p.price)} | Margem proxy: {formatPrice(p.margin)}</div></div>)}</div></div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">Financeiro</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Faturamento hoje" value={formatPrice(m.revenueToday)} />
              <Metric title="Faturamento semana" value={formatPrice(m.revenueWeek)} />
              <Metric title="Faturamento mes" value={formatPrice(m.revenueMonth)} />
              <Metric title="Lucro liquido estimado" value={formatPrice(m.net)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Lucro bruto estimado" value={formatPrice(m.gross)} />
              <Metric title="Pagamentos recebidos" value={formatPrice(m.received)} />
              <Metric title="Pagamentos pendentes" value={formatPrice(m.pendingPay)} />
              <Metric title="Projecao lucro mes" value={formatPrice(m.projNet)} helper={`Receita projetada: ${formatPrice(m.projRevenue)}`} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">Alertas, tendencias e previsoes</div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="text-sm font-semibold text-text">Alertas criticos</div>
                <div className="mt-3 space-y-2 text-xs">
                  <Link href="/gestor/estoque" className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">Estoque critico: {m.criticalStock.length} itens</Link>
                  <Link href="/gestor/pedidos" className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">Pedidos com problema: {m.problemOrders.length}</Link>
                  <Link href="/gestor/pedidos" className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">Pedidos atrasados: {m.delayedOrders.length}</Link>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="text-sm font-semibold text-text">Previsao de demanda</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Metric title="30 dias" value={formatPrice(m.forecast30)} />
                  <Metric title="60 dias" value={formatPrice(m.forecast60)} />
                  <Metric title="90 dias" value={formatPrice(m.forecast90)} />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/80 p-5">
              <div className="text-sm font-semibold text-text">Tendencia por categoria</div>
              <div className="mt-3 space-y-2">
                {m.trendByCategory.map((c) => (
                  <div key={c.label} className="text-xs">
                    <div className="flex justify-between"><span className="text-muted">{c.label}</span><span className="font-semibold text-text">{formatPrice(c.value)}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(5, (c.value / Math.max(...m.trendByCategory.map((x) => x.value), 1)) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </StaffShell>
  );
}
