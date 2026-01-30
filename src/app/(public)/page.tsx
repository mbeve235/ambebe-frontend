"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { FiltersBar, type SortOption } from "@/components/filters-bar";
import { ProductGrid } from "@/components/product-grid";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { CategorySchema, ListResponseSchema, ProductSchema, type Category, type Product } from "@/lib/api-schema";
import { getAccessToken, getRefreshToken, clearTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useCustomerNotifications } from "@/hooks/use-customer-notifications";
import { useCartCount } from "@/hooks/use-cart";
import type { AddState } from "@/components/product-card";

const PRODUCT_LIMIT = 12;
const productListSchema = ListResponseSchema(ProductSchema);
const categoryListSchema = ListResponseSchema(CategorySchema);

type LoadState = { status: "idle" | "loading" | "ready" | "error"; error?: string };

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesState, setCategoriesState] = useState<LoadState>({ status: "loading" });

  const [products, setProducts] = useState<Product[]>([]);
  const [productsState, setProductsState] = useState<LoadState>({ status: "loading" });
  const [total, setTotal] = useState<number | null>(null);

  const cartState = useCartCount(auth.status, auth.role);
  const refreshCart = cartState.refresh;
  const notifications = useCustomerNotifications({
    status: auth.status,
    userId: auth.user?.id,
    role: auth.role
  });
  const [addStates, setAddStates] = useState<Record<string, AddState | undefined>>({});

  const logoutMessage = searchParams.get("logout") === "1";

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchValue]);

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
    let isMounted = true;
    setCategoriesState({ status: "loading" });

    api
      .get("/store/categories")
      .then((response) => {
        const parsed = categoryListSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida de categorias");
        }
        if (!isMounted) return;
        setCategories(parsed.data.items);
        setCategoriesState({ status: "ready" });
      })
      .catch((error) => {
        if (!isMounted) return;
        setCategoriesState({ status: "error", error: getApiErrorMessage(error) });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setProductsState({ status: "loading" });

    const params: Record<string, string | number> = {
      limit: PRODUCT_LIMIT,
      page: 1,
      sort
    };

    if (debouncedSearch) {
      params.q = debouncedSearch;
    }

    if (selectedCategoryId !== "all") {
      params.categoryId = selectedCategoryId;
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
  }, [debouncedSearch, selectedCategoryId, sort]);

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

  const stats = useMemo(() => {
    return {
      productCount: typeof total === "number" ? total : null,
      categoryCount: categoriesState.status === "ready" ? categories.length : null
    };
  }, [categories.length, categoriesState.status, total]);

  const accountHref =
    auth.role === "admin" ? "/admin" : auth.role === "manager" ? "/gestor" : auth.role === "customer" ? "/cliente" : null;

  const categoriesStatus =
    categoriesState.status === "loading"
      ? "loading"
      : categoriesState.status === "error"
        ? "error"
        : "ready";

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
        <section className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border bg-surface/75 p-8 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Tecnologia e confianca</p>
            <h1 className="mt-4 font-heading text-3xl text-text sm:text-4xl">
              Compre tecnologia de forma simples e segura.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-muted">
              Aqui voce encontra produtos reais, compara opcoes e compra com tranquilidade.
            </p>

            {logoutMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Sessao encerrada com sucesso.
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button asChild size="lg">
                <Link href="/#produtos">Ver Produtos</Link>
              </Button>
              {auth.status === "unauthenticated" ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <Link href="/login" className="text-primary hover:text-primary/80">
                    Entrar
                  </Link>
                  <span>ou</span>
                  <Link href="/register" className="text-primary hover:text-primary/80">
                    Criar conta
                  </Link>
                </div>
              ) : accountHref ? (
                <Button asChild variant="outline" size="lg">
                  <Link href={accountHref}>{auth.role === "customer" ? "Minha Conta" : "Painel"}</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface/80 p-6 shadow-soft">
            <div className="font-heading text-lg text-text">Por que comprar aqui</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
                <div className="text-sm font-semibold text-text">Entrega rapida</div>
                <div className="text-xs text-muted">Receba seus produtos com prazos claros.</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
                <div className="text-sm font-semibold text-text">Pagamento seguro</div>
                <div className="text-xs text-muted">Seus dados protegidos em toda a compra.</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
                <div className="text-sm font-semibold text-text">Suporte confiavel</div>
                <div className="text-xs text-muted">Conte conosco quando precisar.</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted">
              {stats.productCount === null ? "Catalogo carregando..." : `${stats.productCount} produtos disponiveis`}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-surface/70 p-6 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Busca rapida</div>
          <div className="mt-3 max-w-xl">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              isLoading={productsState.status === "loading"}
              placeholder="Pesquise por produtos"
            />
          </div>
        </section>

        <div id="produtos" className="scroll-mt-24">
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-heading text-2xl text-text">Produtos</h2>
            <div className="text-xs text-muted">
              {stats.productCount === null ? "..." : `${stats.productCount} itens`}
            </div>
          </div>
          <FiltersBar
            categories={categories}
            categoriesStatus={categoriesStatus}
            categoriesError={
              categoriesState.status === "error" ? "Nao foi possivel carregar categorias agora." : categoriesState.error
            }
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
            sort={sort}
            onSortChange={setSort}
            total={total ?? undefined}
            isUpdating={productsState.status === "loading"}
          />

          <ProductGrid
            products={products}
            isLoading={productsState.status === "loading"}
            error={productsState.status === "error" ? "Nao foi possivel carregar produtos agora." : undefined}
            addStates={addStates}
            onAddToCart={handleAddToCart}
          />
        </div>
      </main>
    </div>
  );
}
