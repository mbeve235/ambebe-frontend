"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { clearTokens, getRefreshToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useCustomerNotifications } from "@/hooks/use-customer-notifications";
import { useCartCount } from "@/hooks/use-cart";

export default function HelpPage() {
  const auth = useAuth();
  const router = useRouter();
  const cartState = useCartCount(auth.status, auth.role);
  const refreshCart = cartState.refresh;
  const notifications = useCustomerNotifications({
    status: auth.status,
    userId: auth.user?.id,
    role: auth.role
  });

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

  const supportAction =
    auth.status === "authenticated"
      ? auth.role === "customer"
        ? { label: "Suporte", href: "/cliente/suporte" }
        : { label: "Ir para o painel", href: auth.role === "admin" ? "/admin" : "/gestor" }
      : { label: "Entrar", href: "/login" };

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
        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Ajuda</div>
            <h1 className="mt-3 font-heading text-3xl text-text">Central de atendimento AMBEBE</h1>
            <p className="mt-2 text-sm text-muted">
              Atendimento estruturado, orientacao objetiva e acompanhamento transparente para cada etapa da compra.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Orientacao de compra</div>
                <p className="mt-2 text-xs text-muted">Escolha produtos, adicione ao carrinho e finalize com seguranca.</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Acompanhamento de entrega</div>
                <p className="mt-2 text-xs text-muted">Acompanhe o status do pedido e os prazos acordados.</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Seguranca de pagamento</div>
                <p className="mt-2 text-xs text-muted">Formas validas e comunicacao clara no checkout.</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Trocas e suporte</div>
                <p className="mt-2 text-xs text-muted">Abra um chamado e acompanhe a resolucao.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
            <div className="text-sm font-semibold text-text">Precisa de atendimento imediato?</div>
            <p className="mt-2 text-sm text-muted">
              Utilize sua conta para abrir um chamado, registrar detalhes e acompanhar o status.
            </p>
            <div className="mt-6">
              <Button asChild size="lg">
                <Link href={supportAction.href}>{supportAction.label}</Link>
              </Button>
            </div>
            <div className="mt-4">
              <Button asChild variant="ghost">
                <Link href="/#produtos">Voltar para a loja</Link>
              </Button>
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-surface/70 p-4 text-xs text-muted">
              Dica: mantenha seu email atualizado no perfil para receber comunicacoes oficiais do atendimento.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

