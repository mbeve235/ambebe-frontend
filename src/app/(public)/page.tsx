"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { FiltersBar, type SortOption } from "@/components/filters-bar";
import { ProductGrid } from "@/components/product-grid";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { api, getApiErrorMessage } from "@/lib/api";
import { CategorySchema, ListResponseSchema, ProductSchema, type Category, type Product } from "@/lib/api-schema";
import {
  clearPendingCartIntent,
  clearTokens,
  getAccessToken,
  getPendingCartIntent,
  getRefreshToken,
  setPendingCartIntent
} from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useCustomerNotifications } from "@/hooks/use-customer-notifications";
import { useCartCount } from "@/hooks/use-cart";
import { trackEvent } from "@/lib/analytics";
import type { AddState } from "@/components/product-card";

const PRODUCT_LIMIT = 12;
const productListSchema = ListResponseSchema(ProductSchema);
const categoryListSchema = ListResponseSchema(CategorySchema);

type LoadState = { status: "idle" | "loading" | "ready" | "error"; error?: string };
type Notice = { tone: "success" | "warning"; text: string };

function HomePageContent() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastBatchCount, setLastBatchCount] = useState(0);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesState, setCategoriesState] = useState<LoadState>({ status: "loading" });

  const [products, setProducts] = useState<Product[]>([]);
  const [productsState, setProductsState] = useState<LoadState>({ status: "loading" });
  const [total, setTotal] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [authPromptProduct, setAuthPromptProduct] = useState<Product | null>(null);

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
    setPage(1);
  }, [debouncedSearch, selectedCategoryId, sort]);

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
    if (page === 1) {
      setProductsState({ status: "loading" });
      setLoadMoreError(null);
    } else {
      setIsLoadingMore(true);
      setLoadMoreError(null);
    }

    const params: Record<string, string | number> = {
      limit: PRODUCT_LIMIT,
      page,
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
        setLastBatchCount(parsed.data.items.length);
        setTotal(parsed.data.total ?? parsed.data.items.length);
        if (page === 1) {
          setProducts(parsed.data.items);
        } else {
          setProducts((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            const incoming = parsed.data.items.filter((item) => !seen.has(item.id));
            return [...prev, ...incoming];
          });
        }
        setProductsState({ status: "ready" });
        trackEvent("product_list_loaded", {
          page,
          items_loaded: parsed.data.items.length,
          visible_items: page === 1 ? parsed.data.items.length : products.length + parsed.data.items.length,
          total_items: parsed.data.total ?? null,
          has_search: Boolean(debouncedSearch),
          has_category_filter: selectedCategoryId !== "all",
          sort
        });
      })
      .catch((error) => {
        if (axios.isCancel(error)) return;
        if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return;
        if (page === 1) {
          setProductsState({ status: "error", error: getApiErrorMessage(error) });
          return;
        }
        setLoadMoreError(getApiErrorMessage(error));
      })
      .finally(() => {
        setIsLoadingMore(false);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearch, selectedCategoryId, sort, page, products.length]);

  useEffect(() => {
    if (auth.status !== "authenticated" || auth.role !== "customer") return;
    const intent = getPendingCartIntent();
    if (!intent?.productId) return;
    const token = getAccessToken();
    if (!token) return;

    clearPendingCartIntent();
    setAuthPromptProduct(null);

    (async () => {
      try {
        await api.post(
          "/account/cart/items",
          { productId: intent.productId, quantity: 1 },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAddStates((prev) => ({ ...prev, [intent.productId]: { status: "success" } }));
        setNotice({ tone: "success", text: "Retomamos a sua compra e adicionamos o produto ao carrinho." });
        refreshCart();
        trackEvent("auth_success_return_to_product", { product_id: intent.productId, result: "success" });
      } catch {
        setNotice({
          tone: "warning",
          text: "Sessao iniciada, mas nao foi possivel adicionar o produto automaticamente."
        });
        trackEvent("auth_success_return_to_product", { product_id: intent.productId, result: "failed_to_add" });
      }
    })();
  }, [auth.role, auth.status, refreshCart]);

  const handleAddToCart = useCallback(
    async (product: Product) => {
      trackEvent("add_to_cart_click", { product_id: product.id, product_name: product.name });
      const token = getAccessToken();
      if (!token) {
        const returnTo =
          typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}${window.location.hash}` : "/";
        setPendingCartIntent({ productId: product.id, returnTo: returnTo || "/", createdAt: Date.now() });
        setAuthPromptProduct(product);
        setNotice({
          tone: "warning",
          text: "Entre na sua conta para concluir esta compra. Guardamos o produto para si."
        });
        trackEvent("add_to_cart_blocked_auth", { product_id: product.id, product_name: product.name });
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
        trackEvent("add_to_cart_success", { product_id: product.id, product_name: product.name });
      } catch (error) {
        setAddStates((prev) => ({
          ...prev,
          [product.id]: { status: "error", error: getApiErrorMessage(error) }
        }));
        trackEvent("add_to_cart_failed", { product_id: product.id, product_name: product.name });
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
  const hasActiveFilters = Boolean(debouncedSearch) || selectedCategoryId !== "all";
  const hasMore =
    typeof total === "number" ? products.length < total : productsState.status === "ready" && lastBatchCount === PRODUCT_LIMIT;

  const categoriesStatus =
    categoriesState.status === "loading"
      ? "loading"
      : categoriesState.status === "error"
        ? "error"
        : "ready";

  const returnTo = encodeURIComponent("/#produtos");

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
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-primary/5 p-6 shadow-soft sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Compra segura e rapida</p>
            <h1 className="mt-3 font-heading text-3xl text-text sm:text-4xl">
              Tecnologia certa, entrega transparente e suporte real.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              Compare produtos reais, veja precos claros e finalize a compra em poucos passos.
            </p>

            <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/85 px-3 py-2 text-muted">
                <div className="font-semibold text-text">Pagamento protegido</div>
                <div>Checkout com ambiente seguro</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/85 px-3 py-2 text-muted">
                <div className="font-semibold text-text">Suporte dedicado</div>
                <div>Atendimento rapido em dias uteis</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/85 px-3 py-2 text-muted">
                <div className="font-semibold text-text">Entrega acompanhada</div>
                <div>Atualizacoes de estado do pedido</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/85 px-3 py-2 text-muted">
                <div className="font-semibold text-text">Catalogo ativo</div>
                <div>{stats.productCount === null ? "A carregar produtos..." : `${stats.productCount} produtos disponiveis`}</div>
              </div>
            </div>

            {logoutMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Sessao encerrada com sucesso.
              </div>
            ) : null}

            {notice ? (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                  notice.tone === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {notice.text}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link
                  href="/#produtos"
                  onClick={() => trackEvent("home_hero_cta_click", { cta: "ver_produtos", source: "hero" })}
                >
                  Ver Produtos
                </Link>
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
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link href={accountHref}>{auth.role === "customer" ? "Minha Conta" : "Painel"}</Link>
                </Button>
              ) : null}
            </div>
            <div className="mt-4 text-xs text-muted">
              Decisao rapida:
              <span className="font-semibold text-text"> explore por categoria</span> e adicione ao carrinho em 1 clique.
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface/80 p-6 shadow-soft">
            <div className="font-heading text-lg text-text">Por que comprar aqui</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
                <div className="text-sm font-semibold text-text">Entrega com previsibilidade</div>
                <div className="text-xs text-muted">Prazos e acompanhamento claros durante todo o pedido.</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
                <div className="text-sm font-semibold text-text">Pagamento confiavel</div>
                <div className="text-xs text-muted">Ambiente protegido para finalizar em seguranca.</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
                <div className="text-sm font-semibold text-text">Atendimento humano</div>
                <div className="text-xs text-muted">Suporte rapido para duvidas antes e depois da compra.</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted">
              {stats.productCount === null ? "Catalogo carregando..." : `${stats.productCount} produtos disponiveis`}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-surface/70 p-6 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Busca rapida</div>
          <div className="mt-3 flex max-w-xl items-center gap-2">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              isLoading={productsState.status === "loading"}
              placeholder="Pesquise por produtos"
              className="flex-1"
            />
            {searchValue ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setSearchValue("")}>
                Limpar
              </Button>
            ) : null}
          </div>
        </section>

        <div id="produtos" className="scroll-mt-24">
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-heading text-2xl text-text">Produtos</h2>
            <div className="text-xs text-muted">
              {stats.productCount === null ? `${products.length} itens` : `${products.length} de ${stats.productCount} itens`}
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
            isUpdating={productsState.status === "loading" || isLoadingMore}
          />

          <ProductGrid
            products={products}
            isLoading={productsState.status === "loading"}
            error={productsState.status === "error" ? "Nao foi possivel carregar produtos agora." : undefined}
            noResultsMessage={
              hasActiveFilters
                ? "Nenhum produto encontrado com os filtros atuais."
                : "Nenhum produto encontrado no momento."
            }
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              setSearchValue("");
              setSelectedCategoryId("all");
              setSort("newest");
              setPage(1);
            }}
            addStates={addStates}
            onAddToCart={handleAddToCart}
          />

          {loadMoreError ? <div className="mt-4 text-sm text-amber-600">{loadMoreError}</div> : null}

          {productsState.status === "ready" && hasMore ? (
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isLoadingMore}
                onClick={() => {
                  trackEvent("home_load_more_click", { current_page: page, visible_items: products.length });
                  setPage((prev) => prev + 1);
                }}
              >
                {isLoadingMore ? "Carregando..." : "Carregar mais produtos"}
              </Button>
            </div>
          ) : null}
        </div>
      </main>

      {authPromptProduct && auth.status === "unauthenticated" ? (
        <>
          <button
            type="button"
            aria-label="Fechar aviso de autenticacao"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setAuthPromptProduct(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-surface p-4 shadow-soft sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:rounded-2xl sm:border">
            <div className="text-sm font-semibold text-text">Continue para finalizar a compra</div>
            <p className="mt-2 text-xs text-muted">
              Guardamos <strong>{authPromptProduct.name}</strong> para si. Entre agora para adicionar ao carrinho.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button asChild>
                <Link
                  href={`/login?intent=cart&returnTo=${returnTo}`}
                  onClick={() =>
                    trackEvent("auth_prompt_click", {
                      action: "login",
                      source: "add_to_cart_prompt",
                      product_id: authPromptProduct.id
                    })
                  }
                >
                  Entrar
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={`/register?returnTo=${returnTo}`}
                  onClick={() =>
                    trackEvent("auth_prompt_click", {
                      action: "register",
                      source: "add_to_cart_prompt",
                      product_id: authPromptProduct.id
                    })
                  }
                >
                  Criar conta
                </Link>
              </Button>
            </div>
            <button type="button" className="mt-3 w-full text-xs text-muted hover:text-primary" onClick={() => setAuthPromptProduct(null)}>
              Continuar sem iniciar sessao
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomePageContent />
    </Suspense>
  );
}
