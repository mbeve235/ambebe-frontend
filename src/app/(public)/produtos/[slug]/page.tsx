"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { ProductGrid } from "@/components/product-grid";
import { SearchInput } from "@/components/search-input";
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
import { ListResponseSchema, ProductSchema, type Product } from "@/lib/api-schema";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { formatPrice, resolveAssetUrl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useCustomerNotifications } from "@/hooks/use-customer-notifications";
import { useCartCount } from "@/hooks/use-cart";
import type { AddState } from "@/components/product-card";

const productListSchema = ListResponseSchema(ProductSchema);

type LoadState = { status: "idle" | "loading" | "ready" | "error"; error?: string };

type ProductState = { status: "loading" | "ready" | "error"; error?: string };

export default function ProductDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";

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
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchState, setSearchState] = useState<LoadState>({ status: "idle" });

  const [product, setProduct] = useState<Product | null>(null);
  const [productState, setProductState] = useState<ProductState>({ status: "loading" });

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
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
    if (!slug) return;
    let isMounted = true;
    setProductState({ status: "loading" });

    api
      .get(`/store/products/slug/${slug}`)
      .then((response) => {
        const parsed = ProductSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida do produto");
        }
        if (!isMounted) return;
        setProduct(parsed.data);
        setProductState({ status: "ready" });
      })
      .catch((error) => {
        if (!isMounted) return;
        setProductState({ status: "error", error: getApiErrorMessage(error) });
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    if (product.variants.length) {
      setSelectedVariantId(product.variants[0].id);
    } else {
      setSelectedVariantId(null);
    }
    setSelectedImageIndex(0);
  }, [product?.id, product?.variants.length]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      setSearchState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setSearchState({ status: "loading" });

    api
      .get("/store/products", {
        params: { q: debouncedSearch, limit: 8, page: 1, sort: "newest" },
        signal: controller.signal
      })
      .then((response) => {
        const parsed = productListSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida da busca");
        }
        setSearchResults(parsed.data.items);
        setSearchState({ status: "ready" });
      })
      .catch((error) => {
        if (axios.isCancel(error)) return;
        if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return;
        setSearchState({ status: "error", error: getApiErrorMessage(error) });
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearch]);

  const filteredSearchResults = useMemo(() => {
    if (!product) return searchResults;
    return searchResults.filter((item) => item.id !== product.id);
  }, [product, searchResults]);

  const selectedVariant = useMemo(() => {
    if (!product || !selectedVariantId) return null;
    return product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  }, [product, selectedVariantId]);

  const displayPrice = product ? formatPrice(selectedVariant?.price ?? product.basePrice) : "";
  const productImageUrls = useMemo(
    () => (product ? product.images.map((image) => resolveAssetUrl(image.url)).filter(Boolean) : []),
    [product]
  );
  const mainImage = productImageUrls[selectedImageIndex] ?? "";

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
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
        {
          productId: product.id,
          variantId: selectedVariant?.id,
          quantity: 1
        },
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
  }, [product, refreshCart, selectedVariant?.id]);

  const handleAddToCartFromList = useCallback(
    async (item: Product) => {
      const token = getAccessToken();
      if (!token) {
        setAddStates((prev) => ({
          ...prev,
          [item.id]: { status: "error", error: "Entrar para comprar" }
        }));
        return;
      }

      setAddStates((prev) => ({ ...prev, [item.id]: { status: "loading" } }));

      try {
        await api.post(
          "/account/cart/items",
          { productId: item.id, quantity: 1 },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAddStates((prev) => ({ ...prev, [item.id]: { status: "success" } }));
        refreshCart();
      } catch (error) {
        setAddStates((prev) => ({
          ...prev,
          [item.id]: { status: "error", error: getApiErrorMessage(error) }
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

  const productAvailability = product?.status === "ACTIVE" ? "Disponivel" : "Indisponivel";
  const availabilityVariant = product?.status === "ACTIVE" ? "success" : "warning";
  const addState = product ? addStates[product.id] : undefined;

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
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Voltar ao catalogo
          </Link>

          {productState.status === "loading" ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="space-y-3">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            </div>
          ) : productState.status === "error" ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Nao foi possivel carregar este produto agora.
            </div>
          ) : product ? (
            <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface/70 p-4">
                  {mainImage ? (
                    <img src={mainImage} alt={product.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center text-xs text-muted">Sem imagem</div>
                  )}
                </div>
                {productImageUrls.length > 1 ? (
                  <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
                    {productImageUrls.slice(0, 10).map((src, index) => {
                      return (
                        <button
                          key={`${src}-${index}`}
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          className={`flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border bg-surface/70 p-1 ${
                            selectedImageIndex === index ? "border-primary" : "border-border"
                          }`}
                        >
                          <img src={src} alt={`${product.name} ${index + 1}`} className="h-full w-full object-contain" />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4">
                <div className="max-w-sm">
                  <SearchInput
                    value={searchValue}
                    onChange={setSearchValue}
                    isLoading={searchState.status === "loading"}
                    placeholder="Pesquisar outros produtos"
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="font-heading text-3xl text-text">{product.name}</h1>
                    <p className="mt-2 text-sm text-muted">{product.description ?? "Sem descricao"}</p>
                  </div>
                  <Badge variant={availabilityVariant}>{productAvailability}</Badge>
                </div>

                <div className="text-2xl font-semibold text-text">{displayPrice}</div>

                {product.categories.length ? (
                  <div className="flex flex-wrap gap-2">
                    {product.categories.map((cat) => (
                      <Link key={cat.categoryId} href={`/categorias/${cat.categoryId}`}>
                        <Badge variant="neutral">{cat.category.name}</Badge>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {product.variants.length ? (
                  <div className="max-w-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Variantes</div>
                    <Select
                      value={selectedVariantId ?? product.variants[0]?.id}
                      onValueChange={(value) => setSelectedVariantId(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a variante" />
                      </SelectTrigger>
                      <SelectContent>
                        {product.variants.map((variant) => (
                          <SelectItem key={variant.id} value={variant.id}>
                            {variant.name} - {formatPrice(variant.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <Button
                  onClick={handleAddToCart}
                  disabled={product.status !== "ACTIVE" || addState?.status === "loading"}
                >
                  {addState?.status === "loading" ? "Adicionando" : "Adicionar ao carrinho"}
                </Button>

                {addState?.status === "success" ? (
                  <span className="text-xs text-success">
                    Item adicionado.{" "}
                    <Link href="/cliente/carrinho" className="underline">
                      Ver carrinho
                    </Link>
                  </span>
                ) : null}
                {addState?.status === "error" ? (
                  <span className="text-xs text-amber-600">{addState.error ?? "Falha ao adicionar"}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {debouncedSearch ? (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl text-text">Pesquisa rapida</h2>
              <Link href="/" className="text-sm text-primary">
                Ver catalogo completo
              </Link>
            </div>
            <ProductGrid
              products={filteredSearchResults}
              isLoading={searchState.status === "loading"}
              error={searchState.status === "error" ? "Nao foi possivel carregar sugestoes agora." : undefined}
              noResultsMessage={
                debouncedSearch ? "Nenhum produto relacionado encontrado para essa pesquisa." : undefined
              }
              hasActiveFilters={Boolean(debouncedSearch)}
              onClearFilters={() => setSearchValue("")}
              addStates={addStates}
              onAddToCart={handleAddToCartFromList}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
