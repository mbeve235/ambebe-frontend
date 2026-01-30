"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { RoleGuard } from "@/components/role-guard";
import { useAuth } from "@/hooks/use-auth";
import { useCartCount } from "@/hooks/use-cart";
import { useCustomerNotifications } from "@/hooks/use-customer-notifications";
import { api } from "@/lib/api";
import { clearTokens, getRefreshToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const primaryNavItems = [
  { href: "/", label: "Catalogo" },
  { href: "/cliente/carrinho", label: "Carrinho" },
  { href: "/cliente/pedidos", label: "Pedidos" }
];

const secondaryNavItems = [
  { href: "/cliente", label: "Resumo" },
  { href: "/cliente/enderecos", label: "Enderecos" },
  { href: "/cliente/perfil", label: "Perfil" },
  { href: "/cliente/suporte", label: "Suporte" }
];

type CustomerShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function CustomerShell({ title, subtitle, children }: CustomerShellProps) {
  const auth = useAuth();
  const cartState = useCartCount(auth.status, auth.role);
  const refreshCart = cartState.refresh;
  const pathname = usePathname();
  const router = useRouter();
  const notifications = useCustomerNotifications({
    status: auth.status,
    userId: auth.user?.id,
    role: auth.role
  });

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
    <RoleGuard auth={auth} allowedRoles={["customer"]}>
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
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Cliente AMBEBE</div>
            <h1 className="mt-3 font-heading text-3xl text-text">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
            <p className="mt-4 text-xs text-muted">Escolha uma acao para continuar.</p>

            <div className="mt-6 space-y-3">
              <nav className="flex flex-wrap gap-3">
                {primaryNavItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-full border border-border px-4 py-2 text-sm font-semibold transition",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "bg-surface text-text hover:border-primary/40"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <nav className="flex flex-wrap gap-2">
                {secondaryNavItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-full border border-border/70 px-3 py-1.5 text-xs transition",
                        isActive
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "bg-surface/60 text-muted hover:text-primary"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </section>

          <div className="mt-8">{children}</div>
        </main>
      </div>
    </RoleGuard>
  );
}

