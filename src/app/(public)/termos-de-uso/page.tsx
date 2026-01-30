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

export default function TermsPage() {
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
      Legal
    </div>

    <h1 className="mt-3 font-heading text-3xl font-semibold text-text">
      Termos de Uso
    </h1>

    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
      Estes Termos de Uso estabelecem as condições para acesso e utilização da
      plataforma <strong>AMBEBE</strong>, garantindo uma relação segura,
      transparente e responsável entre a empresa e seus usuários.
    </p>

    {/* Conteúdo */}
    <div className="mt-8 space-y-6 text-sm text-text">
      {/* Item 1 */}
      <div>
        <h2 className="font-semibold text-text">
          1. Uso da plataforma
        </h2>
        <p className="mt-2 leading-relaxed text-muted">
          O usuário compromete-se a fornecer informações verdadeiras e atualizadas,
          manter a confidencialidade de suas credenciais de acesso e utilizar a
          plataforma de acordo com a legislação vigente e as políticas da AMBEBE.
          O uso indevido, fraudulento ou em desacordo com estes termos poderá
          resultar na suspensão ou bloqueio da conta.
        </p>
      </div>

      {/* Item 2 */}
      <div>
        <h2 className="font-semibold text-text">
          2. Compras e pagamentos
        </h2>
        <p className="mt-2 leading-relaxed text-muted">
          Os pedidos realizados na plataforma estão sujeitos à confirmação do
          método de pagamento escolhido. Preços, disponibilidade de produtos e
          prazos de entrega podem variar conforme o estoque, a localidade e
          condições operacionais no momento da compra.
        </p>
      </div>

      {/* Item 3 */}
      <div>
        <h2 className="font-semibold text-text">
          3. Conteúdo e propriedade intelectual
        </h2>
        <p className="mt-2 leading-relaxed text-muted">
          Todo o conteúdo disponibilizado na plataforma AMBEBE, incluindo marcas,
          logotipos, imagens, textos e elementos visuais, é protegido por direitos
          autorais e outras leis de propriedade intelectual. É proibida a
          reprodução, distribuição ou uso não autorizado, total ou parcial, sem
          consentimento prévio.
        </p>
      </div>

      {/* Item 4 */}
      <div>
        <h2 className="font-semibold text-text">
          4. Atualizações dos termos
        </h2>
        <p className="mt-2 leading-relaxed text-muted">
          A AMBEBE poderá atualizar estes Termos de Uso periodicamente para refletir
          melhorias operacionais, alterações legais ou ajustes na plataforma.
          Sempre que houver mudanças relevantes, os usuários serão devidamente
          informados.
        </p>
      </div>
    </div>

    {/* Ação */}
    <div className="mt-10">
      <Button asChild>
        <Link href="/#produtos">
          Voltar para a loja
        </Link>
      </Button>
    </div>
  </section>
</main>

    </div>
  );
}

