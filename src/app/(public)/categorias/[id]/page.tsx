"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { ProductGrid } from "@/components/product-grid";
import { SearchInput } from "@/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { CategorySchema, ListResponseSchema, ProductSchema, type Category, type Product } from "@/lib/api-schema";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useCustomerNotifications } from "@/hooks/use-customer-notifications";
import { useCartCount } from "@/hooks/use-cart";
import type { AddState } from "@/components/product-card";
import type { SortOption } from "@/components/filters-bar";

const PRODUCT_LIMIT = 12;
const productListSchema = ListResponseSchema(ProductSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function CategoryDetailPage() {
  const params = useParams();
  const categoryId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const auth = useAuth();
  const router = useRouter();
  const cartState = useCartCount(auth.status, auth.role);
  const refreshCart = cartState.refresh;
  const notifications = useCustomerNotifications({
    status: auth.status,
    userId: auth.user?.id,
    role: auth.role
  });

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  const [category, setCategory] = useState<Category | null>(null);
  const [categoryState, setCategoryState] = useState<LoadState>({ status: "loading" });

  const [products, setProducts] = useState<Product[]>([]);
  const [productsState, setProductsState] = useState<LoadState>({ status: "loading" });
  const [total, setTotal] = useState<number | null>(null);

  const [addStates, setAddStates] = useState<Record<string, AddState | undefined>>({});

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (auth.role === "admin") {
      router.replace("/admin");
      return;
    }
    if (auth.role === "manager") {
      router.replace("/gestor");
    }
  }, [auth.role, auth.status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (!categoryId) return;
    let isMounted = true;
    setCategoryState({ status: "loading" });

    api
      .get(`/store/categories/${categoryId}`)
      .then((response) => {
        const parsed = CategorySchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida da categoria");
        }
        if (!isMounted) return;
        setCategory(parsed.data);
        setCategoryState({ status: "ready" });
      })
      .catch((error) => {
        if (!isMounted) return;
        setCategoryState({ status: "error", error: getApiErrorMessage(error) });
      });

    return () => {
      isMounted = false;
    };
  }, [categoryId]);

  useEffect(() => {
    if (!categoryId) return;
    const controller = new AbortController();
    setProductsState({ status: "loading" });

    const params: Record<string, string | number> = {
      limit: PRODUCT_LIMIT,
      page: 1,
      sort,
      categoryId
    };

    if (debouncedSearch) {
      params.q = debouncedSearch;
    }

    api
      .get("/store/products", { params, signal: controller.signal })
      .then((response) => {
        const parsed = productListSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida de produtos");
        }
        setProducts(parsed.data.items);
        setTotal(parsed.data.total ?? parsed.data.items.length);
        setProductsState({ status: "ready" });
      })
      .catch((error) => {
        if (axios.isCancel(error)) return;
        if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return;
        setProductsState({ status: "error", error: getApiErrorMessage(error) });
      });

    return () => {
      controller.abort();
    };
  }, [categoryId, debouncedSearch, sort]);

  const handleAddToCart = useCallback(
    async (product: Product) => {
      const token = getAccessToken();
      if (!token) {
        setAddStates((prev) => ({
          ...prev,
          [product.id]: { status: "error", error: "Entrar para comprar" }
        }));
        return;
      }

      setAddStates((prev) => ({ ...prev, [product.id]: { status: "loading" } }));

      try {
        await api.post(
          "/account/cart/items",
          { productId: product.id, quantity: 1 },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAddStates((prev) => ({ ...prev, [product.id]: { status: "success" } }));
        refreshCart();
      } catch (error) {
        setAddStates((prev) => ({
          ...prev,
          [product.id]: { status: "error", error: getApiErrorMessage(error) }
        }));
      }
    },
    [refreshCart]
  );

  const handleLogout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    const target = "/?logout=1";
    try {
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } catch {
      // ignore logout errors
    } finally {
      clearTokens();
      auth.refresh();
      refreshCart();
      router.replace(target);
    }
  }, [auth.refresh, refreshCart, router]);

  const categoryTitle = category?.name ?? "Categoria";
  const categoryDescription = category?.description ?? "";

  const statsLabel = useMemo(() => {
    if (productsState.status === "loading") return "...";
    if (productsState.status === "error") return "-";
    if (typeof total === "number") return String(total);
    return "0";
  }, [productsState.status, total]);

  return (
    <div className="min-h-screen">
      <Header
        cartCount={cartState.count}
        cartStatus={cartState.status}
        cartError={cartState.error}
        authStatus={auth.status}
        user={auth.user}
        role={auth.role}
        onLogout={handleLogout}
        notifications={notifications}
      />

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <section className="mt-10 rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
          <Link href="/categorias" className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Voltar para categorias
          </Link>
          {categoryState.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : categoryState.status === "error" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Nao foi possivel carregar esta categoria agora.
            </div>
          ) : (
            <>
              <h1 className="mt-3 font-heading text-3xl text-text">{categoryTitle}</h1>
              <p className="mt-2 text-sm text-muted">{categoryDescription || "Sem descricao"}</p>
            </>
          )}

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted">Produtos encontrados: {statsLabel}</div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="w-full sm:w-64">
                <SearchInput value={searchValue} onChange={setSearchValue} isLoading={productsState.status === "loading"} />
              </div>
              <div className="w-full sm:w-56">
                <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Mais recentes</SelectItem>
                    <SelectItem value="price_asc">Preco crescente</SelectItem>
                    <SelectItem value="price_desc">Preco decrescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        <ProductGrid
          products={products}
          isLoading={productsState.status === "loading"}
          error={productsState.status === "error" ? "Nao foi possivel carregar produtos agora." : undefined}
          addStates={addStates}
          onAddToCart={handleAddToCart}
        />
      </main>
    </div>
  );
}
