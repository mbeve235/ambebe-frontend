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

export default function AboutPage() {
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
        <section className="mt-10 rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AMBEBE CORP</div>
          <h1 className="mt-3 font-heading text-3xl text-text">Sobre a AMBEBE</h1>
          <p className="mt-2 text-sm text-muted">
            A AMBEBE e a marca de e-commerce da AMBEBE CORP, criada para oferecer tecnologia com processos claros,
            atendimento humano e experiencia confiavel.
          </p>

          <div className="mt-6 space-y-6 text-sm text-text">
            <div>
              <div className="text-sm font-semibold text-text">Nossa missao</div>
              <p className="mt-2 text-sm text-muted">
                Simplificar o acesso a tecnologia, com orientacao objetiva, entrega segura e suporte presente em todas as
                etapas.
              </p>
            </div>

            <div>
              <div className="text-sm font-semibold text-text">Nossa visao</div>
              <p className="mt-2 text-sm text-muted">
                Ser referencia em compra de tecnologia no mercado local, unindo confianca, praticidade e relacionamento
                de longo prazo com clientes e parceiros.
              </p>
            </div>

            <div>
              <div className="text-sm font-semibold text-text">O que fazemos</div>
              <p className="mt-2 text-sm text-muted">
                Criamos um catalogo objetivo, disponibilizamos informacoes transparentes e garantimos uma jornada de
                compra simples do inicio ao pos-venda.
              </p>
            </div>

            <div>
              <div className="text-sm font-semibold text-text">Atendimento e pos-venda</div>
              <p className="mt-2 text-sm text-muted">
                Nossa equipe acompanha cada pedido, responde com clareza e resolve com agilidade. O suporte faz parte do
                produto.
              </p>
            </div>

            <div>
              <div className="text-sm font-semibold text-text">Governanca e seguranca</div>
              <p className="mt-2 text-sm text-muted">
                Mantemos processos de seguranca, privacidade e auditoria para proteger dados, pagamentos e operacoes da
                plataforma.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-border/80 bg-surface/70 p-5">
            <div className="text-sm font-semibold text-text">Nossos pilares</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface/80 p-4">
                <div className="text-xs font-semibold text-text">Clareza</div>
                <p className="mt-2 text-xs text-muted">Informacoes objetivas para reduzir duvidas e dar seguranca.</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-4">
                <div className="text-xs font-semibold text-text">Confianca</div>
                <p className="mt-2 text-xs text-muted">Processos transparentes e compromisso com a entrega.</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface/80 p-4">
                <div className="text-xs font-semibold text-text">Eficiência</div>
                <p className="mt-2 text-xs text-muted">Operacoes organizadas para atender com rapidez.</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Button asChild>
              <Link href="/#produtos">Voltar para a loja</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
