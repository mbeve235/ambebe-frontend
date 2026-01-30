"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { SearchInput } from "@/components/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { CategorySchema, ListResponseSchema, type Category } from "@/lib/api-schema";
import { clearTokens, getRefreshToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useCustomerNotifications } from "@/hooks/use-customer-notifications";
import { useCartCount } from "@/hooks/use-cart";

const categoryListSchema = ListResponseSchema(CategorySchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function CategoriesPage() {
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });

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
    setState({ status: "loading" });

    api
      .get("/store/categories")
      .then((response) => {
        const parsed = categoryListSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida de categorias");
        }
        if (!isMounted) return;
        setCategories(parsed.data.items);
        setState({ status: "ready" });
      })
      .catch((error) => {
        if (!isMounted) return;
        setState({ status: "error", error: getApiErrorMessage(error) });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCategories = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((category) => {
      const name = category.name.toLowerCase();
      const description = category.description?.toLowerCase() ?? "";
      return name.includes(term) || description.includes(term);
    });
  }, [categories, searchValue]);

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
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Categorias</div>
          <h1 className="mt-3 font-heading text-3xl text-text">Explore por categoria</h1>
          <p className="mt-2 text-sm text-muted">Encontre produtos agrupados para facilitar sua escolha.</p>
          <div className="mt-4 max-w-md">
            <SearchInput value={searchValue} onChange={setSearchValue} isLoading={state.status === "loading"} />
          </div>
        </section>

        <section className="mt-8">
          {state.status === "loading" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`cat-skeleton-${index}`} className="rounded-2xl border border-border bg-surface/70 p-5">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-3 h-4 w-full" />
                </div>
              ))}
            </div>
          ) : state.status === "error" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Nao foi possivel carregar categorias agora.
            </div>
          ) : filteredCategories.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.id}`}
                  className="rounded-2xl border border-border bg-surface/80 p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-glow"
                >
                  <div className="text-sm font-semibold text-text">{category.name}</div>
                  <div className="mt-2 text-xs text-muted">{category.description ?? "Sem descricao"}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface/70 p-4 text-sm text-muted">
              Nenhuma categoria encontrada.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
