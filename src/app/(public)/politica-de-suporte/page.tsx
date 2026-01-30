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

export default function SupportPolicyPage() {
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

      <main className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
        <section className="mt-10 rounded-3xl border border-border bg-surface/90 p-8 shadow-soft backdrop-blur">
          {/* Header */}
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Suporte
          </div>

          <h1 className="mt-3 font-heading text-3xl font-semibold text-text">
            Política de Atendimento
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Esta política descreve como funciona o atendimento da <strong>AMBEBE</strong>,
            incluindo canais de contato, informações necessárias, prazos de resposta e
            horários de suporte.
          </p>

          {/* Conteúdo */}
          <div className="mt-8 space-y-6 text-sm text-text">
            {/* Item 1 */}
            <div>
              <h2 className="font-semibold text-text">
                1. Abertura e registro do atendimento
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                Para solicitar suporte, abra um chamado pelo menu <strong>Suporte</strong>
                na sua conta. Sempre que possível, informe o número do pedido e descreva
                o ocorrido de forma objetiva (ex.: produto, data, status e evidências como
                imagens ou mensagens).
              </p>
            </div>

            {/* Item 2 */}
            <div>
              <h2 className="font-semibold text-text">
                2. Prazos de resposta
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                Nosso prazo padrão de resposta é de até <strong>24 horas úteis</strong>.
                Em períodos de alta demanda ou em casos que exijam análise adicional, o
                prazo poderá ser estendido, com comunicação ao usuário.
              </p>
            </div>

            {/* Item 3 */}
            <div>
              <h2 className="font-semibold text-text">
                3. Acompanhamento e atualizações
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                Todas as interações e atualizações ficam registradas no histórico do
                atendimento. Quando aplicável, notificações também poderão ser enviadas
                por e-mail.
              </p>
            </div>

            {/* Item 4 */}
            <div>
              <h2 className="font-semibold text-text">
                4. Horário de atendimento
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                O suporte funciona de <strong>segunda a sexta-feira</strong>, das{" "}
                <strong>08h às 18h</strong>. Mensagens enviadas fora desse horário entram
                na fila de atendimento do próximo dia útil.
              </p>
            </div>

            {/* Item 5 */}
            <div>
              <h2 className="font-semibold text-text">
                5. Privacidade e segurança
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                Os dados fornecidos são utilizados exclusivamente para tratar e resolver
                a solicitação de suporte. Informações de pedidos e mensagens são
                protegidas e não são compartilhadas com terceiros sem base legal ou
                autorização do usuário.
              </p>
            </div>
          </div>

          {/* Ação */}
          <div className="mt-10">
            <Button asChild>
              <Link href="/#produtos">Voltar para a loja</Link>
            </Button>
          </div>
        </section>
      </main>

    </div>
  );
}

