"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  CategorySchema,
  ListResponseSchema,
  PaymentWithOrderSchema,
  ProductSchema,
  StaffOrderSchema,
  StockItemSchema
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const categoryListSchema = ListResponseSchema(CategorySchema);
const productListSchema = ListResponseSchema(ProductSchema);
const stockListSchema = ListResponseSchema(StockItemSchema);
const orderListSchema = ListResponseSchema(StaffOrderSchema);
const paymentListSchema = ListResponseSchema(PaymentWithOrderSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type OverviewCounts = {
  categories: number;
  products: number;
  stock: number;
  orders: number;
  payments: number;
};

export default function StaffOverviewPage() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [counts, setCounts] = useState<OverviewCounts | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      api.get("/staff/categories", { headers }),
      api.get("/staff/products", { headers }),
      api.get("/staff/inventory/stock-items", { headers }),
      api.get("/staff/orders", { headers }),
      api.get("/staff/payments", { headers })
    ])
      .then(([catRes, prodRes, stockRes, orderRes, payRes]) => {
        if (
          catRes.status !== "fulfilled" ||
          prodRes.status !== "fulfilled" ||
          stockRes.status !== "fulfilled" ||
          orderRes.status !== "fulfilled" ||
          payRes.status !== "fulfilled"
        ) {
          throw new Error("Falha ao carregar dados do gestor");
        }

        const catParsed = categoryListSchema.safeParse(catRes.value.data);
        const prodParsed = productListSchema.safeParse(prodRes.value.data);
        const stockParsed = stockListSchema.safeParse(stockRes.value.data);
        const orderParsed = orderListSchema.safeParse(orderRes.value.data);
        const payParsed = paymentListSchema.safeParse(payRes.value.data);

        if (!catParsed.success || !prodParsed.success || !stockParsed.success || !orderParsed.success || !payParsed.success) {
          throw new Error("Resposta invalida do painel gestor");
        }

        setCounts({
          categories: catParsed.data.items.length,
          products: prodParsed.data.items.length,
          stock: stockParsed.data.items.length,
          orders: orderParsed.data.items.length,
          payments: payParsed.data.items.length
        });
        setState({ status: "ready" });
      })
      .catch((error) => {
        setState({ status: "error", error: getApiErrorMessage(error) });
      });
  }, [auth.status]);

  return (
    <StaffShell title="Resumo do gestor" subtitle="Visao geral de catalogo, estoque e pedidos.">
      {state.status === "loading" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`staff-skeleton-${index}`} className="rounded-2xl border border-border bg-surface/70 p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {state.error}
        </div>
      ) : counts ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-text">Prioridades do dia</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-soft">
                <div className="text-xs text-muted">Pedidos</div>
                <div className="mt-3 text-2xl font-semibold text-text">{counts.orders}</div>
                <Link href="/gestor/pedidos" className="mt-3 inline-block text-sm text-primary">
                  Ver pedidos
                </Link>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-soft">
                <div className="text-xs text-muted">Estoque</div>
                <div className="mt-3 text-2xl font-semibold text-text">{counts.stock}</div>
                <Link href="/gestor/estoque" className="mt-3 inline-block text-sm text-primary">
                  Ver estoque
                </Link>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-soft">
                <div className="text-xs text-muted">Produtos</div>
                <div className="mt-3 text-2xl font-semibold text-text">{counts.products}</div>
                <Link href="/gestor/produtos" className="mt-3 inline-block text-sm text-primary">
                  Gerenciar produtos
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-text">Outros indicadores</div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="text-xs text-muted">Categorias</div>
                <div className="mt-2 text-xl font-semibold text-text">{counts.categories}</div>
                <Link href="/gestor/categorias" className="mt-2 inline-block text-xs text-primary">
                  Gerenciar categorias
                </Link>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="text-xs text-muted">Pagamentos</div>
                <div className="mt-2 text-xl font-semibold text-text">{counts.payments}</div>
                <Link href="/gestor/pagamentos" className="mt-2 inline-block text-xs text-primary">
                  Ver pagamentos
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </StaffShell>
  );
}
