"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { CategorySchema, ListResponseSchema, ProductSchema, StaffOrderSchema, type Category, type Product, type StaffOrder } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const productListSchema = ListResponseSchema(ProductSchema);
const categoryListSchema = ListResponseSchema(CategorySchema);
const orderListSchema = ListResponseSchema(StaffOrderSchema);

const statusOptions = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

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

function getVariantCostPrice(variant: Product["variants"][number]): number | null {
  const direct = toNumber(variant.costPrice);
  if (direct !== null) return direct;
  if (!variant.attributes || typeof variant.attributes !== "object" || Array.isArray(variant.attributes)) return null;
  const attrs = variant.attributes as Record<string, unknown>;
  return toNumber(attrs.costPrice ?? attrs.cost ?? attrs.cmv);
}

function formatMarginPercent(price: unknown, costPrice: number | null): string {
  const sale = toNumber(price);
  if (sale === null || sale <= 0 || costPrice === null) return "N/A";
  return `${(((sale - costPrice) / sale) * 100).toFixed(1)}%`;
}

function StaffProductsPageContent() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [categoryState, setCategoryState] = useState<LoadState>({ status: "loading" });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("DRAFT");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [variantSku, setVariantSku] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantCostPrice, setVariantCostPrice] = useState("");
  const [variantAttributes, setVariantAttributes] = useState("{}");

  const [createState, setCreateState] = useState<ActionState>({ status: "idle" });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/staff/products", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = productListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de produtos");
      }
      setProducts(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const response = await api.get("/staff/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = orderListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de pedidos");
      }
      setOrders(parsed.data.items);
    } catch {
      setOrders([]);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setCategoryState({ status: "error", error: "Token ausente" });
      return;
    }

    setCategoryState({ status: "loading" });
    try {
      const response = await api.get("/staff/categories", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = categoryListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de categorias");
      }
      setCategories(parsed.data.items);
      setCategoryState({ status: "ready" });
    } catch (error) {
      setCategoryState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchProducts();
    fetchCategories();
    fetchOrders();
  }, [auth.status, fetchCategories, fetchOrders, fetchProducts]);

  const preset = searchParams.get("preset") || "";
  const categoryFilter = searchParams.get("category") || "";
  const productIdFilter = searchParams.get("productId") || "";
  const windowFilter = searchParams.get("window") || "7d";

  const visibleProducts = useMemo(() => {
    let list = [...products];

    if (categoryFilter) {
      const normalized = categoryFilter.toLowerCase();
      list = list.filter((product) =>
        product.categories.some((cat) => cat.category.name.toLowerCase() === normalized)
      );
    }

    if (productIdFilter) {
      list = list.filter((product) => product.id === productIdFilter);
    }

    if (preset === "high-margin") {
      list = [...list].sort((a, b) => Number(b.basePrice) - Number(a.basePrice));
    }

    if (preset === "low-performance") {
      const now = Date.now();
      const windowMs =
        windowFilter === "24h" ? 24 * 60 * 60 * 1000 : windowFilter === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const start = now - windowMs;
      const soldMap = new Map<string, number>();
      for (const order of orders) {
        const orderTime = new Date(order.createdAt).getTime();
        if (Number.isNaN(orderTime) || orderTime < start) continue;
        for (const item of order.items ?? []) {
          if (!item.productId) continue;
          soldMap.set(item.productId, (soldMap.get(item.productId) || 0) + Number(item.quantity || 0));
        }
      }
      list = list.filter((product) => (soldMap.get(product.id) || 0) === 0);
    }

    return list;
  }, [categoryFilter, orders, preset, productIdFilter, products, windowFilter]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setCreateState({ status: "error", error: "Token ausente" });
      return;
    }

    const baseValue = Number(basePrice);
    const variantValue = Number(variantPrice);
    const hasCostValue = variantCostPrice.trim().length > 0;
    const costValue = hasCostValue ? Number(variantCostPrice) : undefined;
    if (Number.isNaN(baseValue) || Number.isNaN(variantValue) || (hasCostValue && Number.isNaN(costValue))) {
      setFormError("Preco invalido");
      return;
    }
    if (typeof costValue === "number" && costValue < 0) {
      setFormError("Custo nao pode ser negativo");
      return;
    }

    let attributes: Record<string, unknown> = {};
    if (variantAttributes.trim()) {
      try {
        attributes = JSON.parse(variantAttributes) as Record<string, unknown>;
      } catch {
        setFormError("Atributos precisam ser JSON valido");
        return;
      }
    }

    setFormError(null);
    setCreateState({ status: "loading" });
    try {
      await api.post(
        "/staff/products",
        {
          name,
          slug,
          description: description || undefined,
          basePrice: baseValue,
          status,
          categoryIds: selectedCategories.length ? selectedCategories : undefined,
          variants: [
            {
              sku: variantSku,
              name: variantName,
              price: variantValue,
              costPrice: costValue,
              attributes
            }
          ]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setName("");
      setSlug("");
      setDescription("");
      setBasePrice("");
      setStatus("DRAFT");
      setSelectedCategories([]);
      setVariantSku("");
      setVariantName("");
      setVariantPrice("");
      setVariantCostPrice("");
      setVariantAttributes("{}");
      setCreateState({ status: "success" });
      await fetchProducts();
    } catch (error) {
      setCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  return (
    <StaffShell title="Produtos" subtitle="Gerencie catalogo e variantes com o backend real.">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Produtos cadastrados</div>
          {preset || categoryFilter || productIdFilter ? (
            <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-text">
              Contexto ativo:
              {preset ? ` preset=${preset}` : ""}
              {categoryFilter ? ` categoria=${categoryFilter}` : ""}
              {productIdFilter ? ` produto=${productIdFilter.slice(0, 8)}` : ""}
              {" | "}
              <Link href="/gestor/produtos" className="text-primary">
                limpar contexto
              </Link>
            </div>
          ) : null}
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : visibleProducts.length ? (
            <div className="mt-4 space-y-4">
              {visibleProducts.map((product) => {
                const badgeVariant =
                  product.status === "ACTIVE" ? "success" : product.status === "ARCHIVED" ? "neutral" : "warning";
                const variantsWithCost = product.variants
                  .map((variant) => ({
                    price: toNumber(variant.price),
                    costPrice: getVariantCostPrice(variant)
                  }))
                  .filter((entry) => entry.price !== null && entry.price > 0 && entry.costPrice !== null);
                const avgCost =
                  variantsWithCost.length > 0
                    ? variantsWithCost.reduce((sum, item) => sum + (item.costPrice ?? 0), 0) / variantsWithCost.length
                    : null;
                const avgMargin =
                  variantsWithCost.length > 0
                    ? variantsWithCost.reduce(
                        (sum, item) => sum + ((((item.price ?? 0) - (item.costPrice ?? 0)) / (item.price ?? 1)) * 100),
                        0
                      ) / variantsWithCost.length
                    : null;
                const sampleVariant = product.variants[0];
                const sampleVariantCost = sampleVariant ? getVariantCostPrice(sampleVariant) : null;
                return (
                  <div key={product.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-text">{product.name}</div>
                        <div className="text-xs text-muted">Slug: {product.slug}</div>
                        <div className="text-xs text-muted">Preco base: {formatPrice(product.basePrice)}</div>
                        <div className="text-xs text-muted">
                          Categorias: {product.categories.map((cat) => cat.category.name).join(", ") || "Sem categoria"}
                        </div>
                        <div className="text-xs text-muted">Variantes: {product.variants.length}</div>
                        <div className="text-xs text-muted">
                          CMV medio: {avgCost === null ? "N/A" : formatPrice(avgCost)} | Margem estimada media:{" "}
                          {avgMargin === null ? "N/A" : `${avgMargin.toFixed(1)}%`}
                        </div>
                        {sampleVariant ? (
                          <div className="text-xs text-muted">
                            Exemplo variante: CMV {sampleVariantCost === null ? "N/A" : formatPrice(sampleVariantCost)} | Margem{" "}
                            {formatMarginPercent(sampleVariant.price, sampleVariantCost)}
                          </div>
                        ) : null}
                        <Link href={`/gestor/produtos/${product.id}`} className="text-xs text-primary">
                          Ver detalhes
                        </Link>
                      </div>
                      <Badge variant={badgeVariant}>{product.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhum produto encontrado para este contexto.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Novo produto</div>
          <form className="mt-4 space-y-3" onSubmit={handleCreateProduct}>
            <Input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input placeholder="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} required />
            <Input placeholder="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Input
              type="number"
              placeholder="Preco base"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
              min="0"
              step="0.01"
              required
            />

            <Select value={status} onValueChange={(value) => setStatus(value as (typeof statusOptions)[number])}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Categorias</div>
              {categoryState.status === "loading" ? (
                <Skeleton className="mt-3 h-8 w-full" />
              ) : categoryState.status === "error" ? (
                <div className="mt-3 text-xs text-amber-600">{categoryState.error}</div>
              ) : categories.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const isSelected = selectedCategories.includes(category.id);
                    return (
                      <Button
                        key={category.id}
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => toggleCategory(category.id)}
                      >
                        {category.name}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted">Nenhuma categoria disponivel.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Primeira variante</div>
              <div className="mt-3 space-y-2">
                <Input
                  placeholder="SKU"
                  value={variantSku}
                  onChange={(event) => setVariantSku(event.target.value)}
                  required
                />
                <Input
                  placeholder="Nome da variante"
                  value={variantName}
                  onChange={(event) => setVariantName(event.target.value)}
                  required
                />
                <Input
                  type="number"
                  placeholder="Preco"
                  value={variantPrice}
                  onChange={(event) => setVariantPrice(event.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
                <Input
                  type="number"
                  placeholder="Custo (costPrice) ex: 1200.00"
                  value={variantCostPrice}
                  onChange={(event) => setVariantCostPrice(event.target.value)}
                  min="0"
                  step="0.01"
                />
                <Input
                  placeholder='Atributos JSON opcionais (ex: {"cor":"azul"})'
                  value={variantAttributes}
                  onChange={(event) => setVariantAttributes(event.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={createState.status === "loading"}>
              {createState.status === "loading" ? "Criando" : "Criar produto"}
            </Button>
            {formError ? <div className="text-xs text-amber-600">{formError}</div> : null}
            {createState.status === "success" ? (
              <div className="text-xs text-success">Produto criado.</div>
            ) : null}
            {createState.status === "error" ? (
              <div className="text-xs text-amber-600">{createState.error}</div>
            ) : null}
          </form>
        </div>
      </section>
    </StaffShell>
  );
}

export default function StaffProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <StaffProductsPageContent />
    </Suspense>
  );
}
