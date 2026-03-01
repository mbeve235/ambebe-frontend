"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { ListResponseSchema, ProductSchema, StockItemSchema, type Product, type StockItem } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const stockListSchema = ListResponseSchema(StockItemSchema);
const productListSchema = ListResponseSchema(ProductSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

type VariantOption = { id: string; label: string };

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getVariantCostPrice(variant: StockItem["variant"]): number | null {
  if (!variant) return null;
  const direct = toNumber(variant.costPrice);
  if (direct !== null) return direct;
  if (!variant.attributes || typeof variant.attributes !== "object" || Array.isArray(variant.attributes)) return null;
  const attrs = variant.attributes as Record<string, unknown>;
  return toNumber(attrs.costPrice ?? attrs.cost ?? attrs.cmv);
}

function getMarginPercent(price: unknown, costPrice: number | null): string {
  const sale = toNumber(price);
  if (sale === null || sale <= 0 || costPrice === null) return "N/A";
  return `${(((sale - costPrice) / sale) * 100).toFixed(1)}%`;
}

function getStockStatus(onHand: number) {
  if (onHand <= 0) return { label: "Ruptura", variant: "warning" as const };
  if (onHand <= 5) return { label: "Em risco", variant: "neutral" as const };
  return { label: "Saudavel", variant: "success" as const };
}

export default function StaffStockPage() {
  const auth = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variantState, setVariantState] = useState<LoadState>({ status: "loading" });
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [createState, setCreateState] = useState<ActionState>({ status: "idle" });

  const fetchStockItems = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/staff/inventory/stock-items", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = stockListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do estoque");
      }
      setItems(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  const fetchVariants = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setVariantState({ status: "error", error: "Token ausente" });
      return;
    }

    setVariantState({ status: "loading" });
    try {
      const response = await api.get("/staff/products", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = productListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de produtos");
      }

      const options = parsed.data.items.flatMap((product: Product) =>
        product.variants.map((variant) => ({
          id: variant.id,
          label: `${product.name} - ${variant.name} (${variant.sku})`
        }))
      );

      setVariantOptions(options);
      if (!selectedVariant && options.length) {
        setSelectedVariant(options[0].id);
      }
      setVariantState({ status: "ready" });
    } catch (error) {
      setVariantState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [selectedVariant]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchStockItems();
    fetchVariants();
  }, [auth.status, fetchStockItems, fetchVariants]);

  const handleCreateStock = async () => {
    const token = getAccessToken();
    if (!token) {
      setCreateState({ status: "error", error: "Token ausente" });
      return;
    }

    if (!selectedVariant) {
      setCreateState({ status: "error", error: "Selecione uma variante" });
      return;
    }

    setCreateState({ status: "loading" });
    try {
      await api.post(
        "/staff/inventory/stock-items",
        { variantId: selectedVariant },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCreateState({ status: "success" });
      await fetchStockItems();
    } catch (error) {
      setCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  return (
    <StaffShell title="Estoque" subtitle="Monitore saldo, risco de ruptura e ajustes.">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Produtos no estoque</div>
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : items.length ? (
            <div className="mt-4 space-y-4">
              {items.map((item) => {
                const stockStatus = getStockStatus(item.onHand);
                const costPrice = getVariantCostPrice(item.variant);
                const margin = getMarginPercent(item.variant?.price, costPrice);
                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-text">
                          {item.variant?.name ?? "Variante"}
                        </div>
                        <div className="text-xs text-muted">SKU: {item.variant?.sku ?? item.variantId}</div>
                        <div className="text-xs text-muted">Quantidade atual: {item.onHand}</div>
                        <div className="text-xs text-muted">
                          CMV: {costPrice === null ? "N/A" : formatPrice(costPrice)} | Margem estimada: {margin}
                        </div>
                        <div className="text-xs text-muted">Atualizado: {formatDate(item.updatedAt)}</div>
                        <Link href={`/gestor/estoque/${item.id}`} className="text-xs text-primary">
                          Abrir e ajustar
                        </Link>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                        <div className="rounded-full border border-border px-3 py-1 text-xs text-text">
                          {item.onHand} un.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhum item de estoque encontrado.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Adicionar produto ao controle</div>
          <div className="mt-4 space-y-3">
            {variantState.status === "loading" ? (
              <Skeleton className="h-10 w-full" />
            ) : variantState.status === "error" ? (
              <div className="text-sm text-amber-600">{variantState.error}</div>
            ) : variantOptions.length ? (
              <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a variante" />
                </SelectTrigger>
                <SelectContent>
                  {variantOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted">Nenhuma variante disponivel.</div>
            )}

            <Button type="button" onClick={handleCreateStock} disabled={createState.status === "loading"}>
              {createState.status === "loading" ? "Salvando" : "Adicionar ao estoque"}
            </Button>

            {createState.status === "success" ? (
              <div className="text-xs text-success">Item criado ou ja existente.</div>
            ) : null}
            {createState.status === "error" ? (
              <div className="text-xs text-amber-600">{createState.error}</div>
            ) : null}
          </div>
        </div>
      </section>
    </StaffShell>
  );
}
