"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { StaffDashboardSchema, type StaffDashboard } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

type LoadState = { status: "loading" | "ready" | "error"; error?: string };
type PeriodKey = "day" | "month" | "quarter";
type SalesWindow = "24h" | "7d" | "30d";

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

function Metric({ title, value, helper }: { title: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/80 p-4">
      <div className="text-xs text-muted">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-text">{value}</div>
      {helper ? <div className="mt-1 text-xs text-muted">{helper}</div> : null}
    </div>
  );
}

function severityVariant(level: "high" | "medium" | "low") {
  if (level === "high") return "warning";
  if (level === "medium") return "neutral";
  return "success";
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

function StaffOverviewPageContent() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [window, setWindow] = useState<SalesWindow>("7d");
  const [data, setData] = useState<StaffDashboard | null>(null);

  useEffect(() => {
    const p = searchParams.get("period");
    const w = searchParams.get("window");
    const nextPeriod: PeriodKey = p === "day" || p === "quarter" || p === "month" ? p : "month";
    const nextWindow: SalesWindow = w === "24h" || w === "30d" || w === "7d" ? w : "7d";
    setPeriod(nextPeriod);
    setWindow(nextWindow);
  }, [searchParams]);

  const updateDashboardFilters = (next: { period?: PeriodKey; window?: SalesWindow }) => {
    const params = new URLSearchParams(searchParams.toString());
    const finalPeriod = next.period ?? period;
    const finalWindow = next.window ?? window;
    params.set("period", finalPeriod);
    params.set("window", finalWindow);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Sessao invalida." });
      return;
    }

    setState({ status: "loading" });
    api
      .get("/staff/dashboard", {
        params: { period, window },
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((response) => {
        const parsed = StaffDashboardSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida do dashboard.");
        }
        setData(parsed.data);
        setState({ status: "ready" });
      })
      .catch((error) => {
        setState({ status: "error", error: getApiErrorMessage(error) });
      });
  }, [auth.status, period, window]);

  const maxCategoryRevenue = useMemo(() => {
    if (!data || !data.salesHealth.categoryMix.length) return 1;
    return Math.max(...data.salesHealth.categoryMix.map((item) => Number(item.revenue)), 1);
  }, [data]);

  return (
    <StaffShell title="Cockpit de gestao" subtitle="Operacional, tatico e financeiro no mesmo fluxo de decisao.">
      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text">Filtros globais</div>
              <div className="text-xs text-muted">Periodo e janela afetam todas as secoes analiticas.</div>
            </div>
            {data?.meta ? (
              <div className="text-xs text-muted">
                Atualizado em {formatDate(data.meta.generatedAt)} | Versao {data.meta.metricVersion}
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={period === p.value ? "default" : "outline"}
                onClick={() => updateDashboardFilters({ period: p.value })}
              >
                {p.label}
              </Button>
            ))}
            {WINDOWS.map((w) => (
              <Button
                key={w.value}
                size="sm"
                variant={window === w.value ? "default" : "outline"}
                onClick={() => updateDashboardFilters({ window: w.value })}
              >
                {w.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {state.status === "loading" ? (
        <LoadingGrid />
      ) : state.status === "error" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{state.error}</div>
      ) : data ? (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">1) Prioridades operacionais</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Link href="/gestor/estoque"><Metric title="Ruptura critica" value={String(data.cockpit.criticalStockCount)} /></Link>
              <Link href="/gestor/pedidos?preset=delayed"><Metric title="Pedidos atrasados" value={String(data.cockpit.delayedOrdersCount)} /></Link>
              <Metric title="Receita reconhecida (hoje)" value={formatPrice(data.cockpit.recognizedRevenueToday)} />
              <Metric title="Receita reconhecida (mes)" value={formatPrice(data.cockpit.recognizedRevenueMonth)} />
              <Link href="/gestor/pedidos?paymentStatus=PENDING"><Metric title="Pipeline a receber" value={formatPrice(data.cockpit.receivablesPipeline)} /></Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.cockpit.actions.map((action) => (
                <Link key={action.id} href={action.href} className="rounded-2xl border border-border bg-surface/80 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-text">{action.label}</div>
                    <Badge variant={severityVariant(action.severity)}>{action.severity}</Badge>
                  </div>
                  <div className="mt-2 text-xl font-semibold text-text">{action.count}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">2) Saude comercial</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Receita reconhecida" value={formatPrice(data.salesHealth.recognizedRevenue)} helper={`Delta vs periodo anterior: ${data.salesHealth.deltaPct >= 0 ? "+" : ""}${data.salesHealth.deltaPct.toFixed(1)}%`} />
              <Metric title="Receita autorizada (nao reconhecida)" value={formatPrice(data.salesHealth.authorizedRevenue)} />
              <Metric title="Ticket medio reconhecido" value={formatPrice(data.salesHealth.avgTicketRecognized)} />
              <Metric title="Taxa de sucesso de pedidos" value={`${data.salesHealth.successRatePct.toFixed(1)}%`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Receita bruta" value={formatPrice(data.salesHealth.revenueGross)} />
              <Metric title="Receita liquida" value={formatPrice(data.salesHealth.revenueNet)} />
              <Metric title="CMV" value={formatPrice(data.salesHealth.cmv)} />
              <Metric title="Lucro bruto" value={formatPrice(data.salesHealth.grossProfit)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Taxas gateway" value={formatPrice(data.salesHealth.gatewayFees)} />
              <Metric title="Impostos estimados" value={formatPrice(data.salesHealth.taxes)} />
              <Metric title="Frete subsidiado" value={formatPrice(data.salesHealth.freightSubsidy)} />
              <Metric title="Lucro operacional" value={formatPrice(data.salesHealth.operationalProfit)} helper={`Lucro liquido estimado: ${formatPrice(data.salesHealth.netProfit)}`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="text-sm font-semibold text-text">Mix por categoria</div>
                <div className="mt-3 space-y-2">
                  {data.salesHealth.categoryMix.map((item) => (
                    <Link key={item.label} href={`/gestor/produtos?category=${encodeURIComponent(item.label)}`} className="block text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">{item.label} ({item.sharePct.toFixed(1)}%)</span>
                        <span className="font-semibold text-text">{formatPrice(item.revenue)} | {item.deltaPct >= 0 ? "+" : ""}{item.deltaPct.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-border">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(6, (Number(item.revenue) / maxCategoryRevenue) * 100)}%` }} />
                      </div>
                    </Link>
                  ))}
                  {!data.salesHealth.categoryMix.length ? <div className="text-xs text-muted">Sem dados no periodo.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="text-sm font-semibold text-text">Receita reconhecida por canal</div>
                <div className="mt-3 space-y-2">
                  {data.salesHealth.channelMix.map((item) => (
                    <Link key={item.label} href={`/gestor/pedidos?channel=${encodeURIComponent(item.label)}`} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-xs">
                      <span className="text-muted">{item.label}</span>
                      <span className="font-semibold text-text">{formatPrice(item.revenue)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">3) Operacao de pedidos</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link href="/gestor/pedidos?preset=pending"><Metric title="Pendentes" value={String(data.operations.pendingOrders)} /></Link>
              <Link href="/gestor/pedidos?preset=delayed"><Metric title="Atrasados" value={String(data.operations.delayedOrders)} /></Link>
              <Link href="/gestor/pedidos?preset=problem"><Metric title="Com problema" value={String(data.operations.problemOrders)} /></Link>
              <Link href="/gestor/pedidos?paymentStatus=REFUNDED"><Metric title="Reembolsos" value={formatPrice(data.operations.refunds.total)} helper={`${data.operations.refunds.count} ocorrencias`} /></Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-text">Fila pendente</div><Link href="/gestor/pedidos?preset=pending" className="text-xs text-primary">Ver tudo</Link></div>
                <div className="space-y-2">
                  {data.operations.topPending.map((order) => (
                    <Link key={order.id} href={`/gestor/pedidos/${order.id}`} className="block rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">#{order.id.slice(0, 8).toUpperCase()}</div><div className="text-muted">{formatPrice(order.total)}</div></Link>
                  ))}
                  {!data.operations.topPending.length ? <div className="text-xs text-muted">Sem pendencias.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 text-sm font-semibold text-text">Atrasos</div>
                <div className="space-y-2">
                  {data.operations.topDelayed.map((order) => (
                    <Link key={order.id} href={`/gestor/pedidos/${order.id}`} className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><div className="font-semibold text-text">#{order.id.slice(0, 8).toUpperCase()}</div><div className="text-muted">{formatDate(order.createdAt)}</div></Link>
                  ))}
                  {!data.operations.topDelayed.length ? <div className="text-xs text-muted">Sem atrasos relevantes.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 text-sm font-semibold text-text">Problemas</div>
                <div className="space-y-2">
                  {data.operations.topProblem.map((order) => (
                    <Link key={order.id} href={`/gestor/pedidos/${order.id}`} className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><div className="font-semibold text-text">#{order.id.slice(0, 8).toUpperCase()}</div><div className="text-muted">{formatPrice(order.total)}</div></Link>
                  ))}
                  {!data.operations.topProblem.length ? <div className="text-xs text-muted">Sem pedidos criticos.</div> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">4) Inventario e ruptura</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric title="Valor de estoque" value={formatPrice(data.inventory.totalStockValue)} />
              <Link href="/gestor/estoque"><Metric title="Ruptura critica" value={String(data.inventory.criticalCount)} /></Link>
              <Link href="/gestor/estoque"><Metric title="Estoque em risco" value={String(data.inventory.warningCount)} /></Link>
              <Link href={`/gestor/produtos?preset=low-performance&window=${window}`}><Metric title="Alta saida (24h)" value={String(data.inventory.fastMovingCount)} /></Link>
              <Metric title="Limiar dinamico 24h" value={`${data.inventory.fastMovingThreshold24h} un`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-text">Itens em ruptura</div><Link href="/gestor/estoque" className="text-xs text-primary">Reabastecer</Link></div>
                <div className="space-y-2">
                  {data.inventory.criticalItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><span className="text-text">{item.variant?.name || item.variantId}</span><Badge variant="warning">Urgente</Badge></div>
                  ))}
                  {!data.inventory.criticalItems.length ? <div className="text-xs text-muted">Sem itens em ruptura.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 text-sm font-semibold text-text">Produtos de alta saida (24h)</div>
                <div className="space-y-2">
                  {data.inventory.fastMoving.map((item) => (
                    <Link key={item.id} href={`/gestor/produtos?productId=${item.id}`} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-xs"><span className="text-text">{item.name}</span><Badge variant="neutral">{item.qty} un</Badge></Link>
                  ))}
                  {!data.inventory.fastMoving.length ? <div className="text-xs text-muted">Sem destaque de saida no periodo.</div> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">5) Rentabilidade e caixa</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Receita hoje" value={formatPrice(data.finance.revenueToday)} />
              <Metric title="Receita semana" value={formatPrice(data.finance.revenueWeek)} />
              <Metric title="Receita mes" value={formatPrice(data.finance.revenueMonth)} />
              <Metric title="Lucro liquido realizado (mes)" value={formatPrice(data.finance.profitModel.realizedNetProfitMonth)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Lucro bruto (mes)" value={formatPrice(data.finance.grossEstimateMonth)} />
              <Metric title="Recebido (capturado)" value={formatPrice(data.finance.capturedPayments)} />
              <Metric title="Pipeline a receber" value={formatPrice(data.finance.pipelinePayments)} />
              <Metric title="Projecao de lucro (mes)" value={formatPrice(data.finance.projNet)} helper={`Receita projetada: ${formatPrice(data.finance.projRevenue)}`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="Pedidos projetados restantes" value={data.finance.profitModel.projectedOrdersRemaining.toFixed(1)} />
              <Metric title="Ticket projetado" value={formatPrice(data.finance.profitModel.projectedTicket)} />
              <Metric title="Crescimento recente" value={`${data.finance.profitModel.recentGrowthPct.toFixed(1)}%`} />
              <Metric title="Cancelamento medio" value={`${data.finance.profitModel.averageCancelRatePct.toFixed(1)}%`} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">6) Produtos e mix</div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface/80 p-5 lg:col-span-2">
                <div className="mb-3 text-sm font-semibold text-text">Top produtos no recorte</div>
                <div className="space-y-2">
                  {data.products.topProducts.map((product) => (
                    <Link key={product.id} href={`/gestor/produtos?productId=${product.id}`} className="block rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">{product.name}</div><div className="text-muted">Qtd: {product.qty} | Receita: {formatPrice(product.revenue)} | Lucro estimado: {formatPrice(product.profitEstimate)}</div></Link>
                  ))}
                  {!data.products.topProducts.length ? <div className="text-xs text-muted">Sem vendas no recorte atual.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-text">Produtos sem venda</div><Link href={`/gestor/produtos?preset=low-performance&window=${window}`} className="text-xs text-primary">Ver lista</Link></div>
                <div className="space-y-2">
                  {data.products.lowPerformance.slice(0, 8).map((product) => (
                    <Link key={product.id} href={`/gestor/produtos?productId=${product.id}`} className="block rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">{product.name}</div><div className="text-muted">Nenhuma venda no recorte.</div></Link>
                  ))}
                  {!data.products.lowPerformance.length ? <div className="text-xs text-muted">Sem produtos zerados no periodo.</div> : null}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/80 p-5">
              <div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold text-text">Produtos com maior potencial bruto estimado</div><Link href="/gestor/produtos?preset=high-margin" className="text-xs text-primary">Ver lista</Link></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {data.products.highMarginEstimated.slice(0, 8).map((product) => (
                  <Link key={product.id} href={`/gestor/produtos?productId=${product.id}`} className="block rounded-xl border border-border/70 px-3 py-2 text-xs"><div className="font-semibold text-text">{product.name}</div><div className="text-muted">Preco: {formatPrice(product.price)} | Bruto estimado: {formatPrice(product.grossEstimate)}</div></Link>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold text-text">7) Projecoes e risco</div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 text-sm font-semibold text-text">Previsao de demanda</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric title="30 dias" value={formatPrice(data.forecast.demand30)} />
                  <Metric title="60 dias" value={formatPrice(data.forecast.demand60)} />
                  <Metric title="90 dias" value={formatPrice(data.forecast.demand90)} />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-5">
                <div className="mb-3 text-sm font-semibold text-text">Tendencia por categoria</div>
                <div className="space-y-2">
                  {data.forecast.categoryTrend.map((item) => (
                    <Link key={item.label} href={`/gestor/produtos?category=${encodeURIComponent(item.label)}`} className="block rounded-xl border border-border/70 px-3 py-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted">{item.label}</span><span className="font-semibold text-text">{formatPrice(item.revenue)}</span></div>
                      <div className="text-muted">Variacao vs periodo anterior: {item.deltaPct >= 0 ? "+" : ""}{item.deltaPct.toFixed(1)}%</div>
                    </Link>
                  ))}
                  {!data.forecast.categoryTrend.length ? <div className="text-xs text-muted">Sem dados de tendencia.</div> : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </StaffShell>
  );
}

export default function StaffOverviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <StaffOverviewPageContent />
    </Suspense>
  );
}
