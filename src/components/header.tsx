"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartButton } from "@/components/cart-button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/api-schema";

const roleLabels: Record<string, string> = {
  customer: "Cliente",
  manager: "Gestor",
  admin: "Admin"
};

const navItems = [
  { href: "/", label: "Inicio", match: "/" },
  { href: "/#produtos", label: "Loja / Produtos", match: "/" },
  { href: "/sobre-nos", label: "Sobre nos", match: "/sobre-nos" },
  { href: "/categorias", label: "Categorias", match: "/categorias" },
  { href: "/ajuda", label: "Ajuda / Suporte", match: "/ajuda" }
];

const ProfileIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export type HeaderNotificationItem = {
  id: string;
  title: string;
  description?: string;
  href: string;
  tag?: string;
  kind?: "order" | "support" | "product";
  refId?: string;
  createdAt?: string;
};

export type HeaderNotifications = {
  status: "idle" | "loading" | "ready" | "error";
  count: number;
  items: HeaderNotificationItem[];
  error?: string;
  onItemClick?: (item: HeaderNotificationItem) => void;
};

type HeaderProps = {
  cartCount: number | null;
  cartStatus: "idle" | "loading" | "ready" | "error" | "unauthenticated";
  cartError?: string;
  authStatus: "loading" | "authenticated" | "unauthenticated" | "error";
  user?: Profile;
  role?: string | null;
  onLogout?: () => void;
  notifications?: HeaderNotifications;
};

export function Header({
  cartCount,
  cartStatus,
  cartError,
  authStatus,
  user,
  role,
  onLogout,
  notifications
}: HeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isCustomerArea = pathname.startsWith("/cliente");
  const showPublicNav = !role || (role === "customer" && !isCustomerArea);
  const showCart = role === "customer";
  const showNotifications = Boolean(notifications);
  const handleNotificationClick = (item: HeaderNotificationItem) => {
    notifications?.onItemClick?.(item);
    setNotificationsOpen(false);
  };

  useEffect(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  const roleLabel = role ? roleLabels[role] ?? role : null;
  const displayName =
  user?.name?.split(" ")[0] ??
  user?.email?.split("@")[0] ??
  "Usuario";


  const cartHref = authStatus === "unauthenticated" ? "/login" : role === "customer" ? "/cliente/carrinho" : undefined;
  const cartDisabled =
    authStatus === "loading" ||
    authStatus === "error" ||
    (authStatus === "authenticated" && role !== "customer");
  const notificationCount = notifications?.count ?? 0;
  const showCount = notifications?.status === "ready" && notificationCount > 0;

  const userActions = useMemo(() => {
    const actions: { label: string; href?: string; onClick?: () => void }[] = [];
    if (role === "customer") {
      actions.push({ label: "Minha Conta", href: "/cliente" });
      actions.push({ label: "Meus Pedidos", href: "/cliente/pedidos" });
      actions.push({ label: "Suporte", href: "/cliente/suporte" });
    }
    if (role === "admin") {
      actions.push({ label: "Painel", href: "/admin" });
    }
    if (role === "manager") {
      actions.push({ label: "Painel", href: "/gestor" });
    }
    if (onLogout) {
      actions.push({ label: "Logout", onClick: onLogout });
    }
    return actions;
  }, [onLogout, role]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-surface/70 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <BrandLogo size={44} />
              <div>
                <div className="font-heading text-lg text-text"><strong>A</strong>MBEBE</div>
                <div className="text-xs text-muted"><strong>A</strong>MBEBE CORP</div>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              {showCart ? (
                <CartButton
                  count={cartCount}
                  status={cartStatus}
                  error={cartError}
                  href={cartHref}
                  disabled={cartDisabled}
                />
              ) : null}

              {showNotifications ? (
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false);
                      setNotificationsOpen((prev) => !prev);
                    }}
                    className="relative h-11 gap-2 rounded-full px-4"
                    aria-label="Notificacoes"
                    aria-expanded={notificationsOpen}
                  >
                    <BellIcon className="h-4 w-4" />
                    <span className="text-sm">Alertas</span>
                    {notifications?.status === "loading" ? (
                      <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-primary" />
                    ) : showCount ? (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>
                    ) : null}
                  </Button>

                  {notificationsOpen ? (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-surface/95 p-4 shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-text">Notificacoes</div>
                          <div className="text-xs text-muted">
                            {role === "admin"
                              ? "Pedidos e suporte"
                              : role === "manager"
                                ? "Pedidos recentes"
                                : "Novos produtos e suporte"}
                          </div>
                        </div>
                        {showCount ? (
                          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            {notificationCount}
                          </div>
                        ) : null}
                      </div>
                      <div className="my-3 h-px bg-border" />

                      {notifications?.status === "loading" ? (
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      ) : notifications?.status === "error" ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                          {notifications.error ?? "Falha ao carregar notificacoes."}
                        </div>
                      ) : notifications?.items.length ? (
                        <div className="space-y-2">
                          {notifications.items.map((item) => (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={() => handleNotificationClick(item)}
                              className="block rounded-xl border border-border bg-surface/70 p-3 text-sm text-text transition hover:border-primary/50"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-text">{item.title}</div>
                                {item.tag ? (
                                  <span className="rounded-full bg-border/70 px-2 py-1 text-[10px] font-semibold text-muted">
                                    {item.tag}
                                  </span>
                                ) : null}
                              </div>
                              {item.description ? (
                                <div className="mt-1 text-xs text-muted">{item.description}</div>
                              ) : null}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted">Nenhuma notificacao nova.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {authStatus === "unauthenticated" ? (
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/register">Criar conta</Link>
                  </Button>
                </div>
              ) : (
                <div className="relative flex items-center gap-2">
                  {roleLabel ? (
                    <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">
                      {roleLabel}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNotificationsOpen(false);
                      setMenuOpen((prev) => !prev);
                    }}
                    className="gap-2"
                  >
                    <ProfileIcon className="h-4 w-4" />
                    {authStatus === "loading" ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Conta</span>
                        <span className="text-sm">{displayName}</span>
                      </span>
                    )}
                  </Button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-surface/95 p-2 shadow-soft">
                      <div className="px-3 py-2">
                        <div className="text-xs text-muted">{roleLabel ?? "Usuario"}</div>
                        <div className="text-sm font-semibold text-text">{user?.name || user?.email}</div>
                      </div>
                      <div className="my-2 h-px bg-border" />
                      <div className="flex flex-col gap-1">
                        {userActions.map((action) => {
                          if (action.href) {
                            return (
                              <Link
                                key={action.label}
                                href={action.href}
                                className="rounded-xl px-3 py-2 text-sm text-text hover:bg-primary/10"
                              >
                                {action.label}
                              </Link>
                            );
                          }
                          return (
                            <button
                              key={action.label}
                              type="button"
                              onClick={action.onClick}
                              className="rounded-xl px-3 py-2 text-left text-sm text-text hover:bg-primary/10"
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="my-2 h-px bg-border" />
                      <div className="px-2">
                        <ThemeToggle />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {showPublicNav ? (
            <div className="border-t border-border/70 pt-3">
              <nav className="flex flex-wrap items-center gap-2 text-sm text-text">
                {navItems.map((item) => {
                  const isActive =
                    item.match === "/" ? pathname === "/" && item.href === "/" : pathname.startsWith(item.match);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={cn(
                        "rounded-full px-3 py-2 transition",
                        isActive ? "bg-primary/10 text-primary" : "text-muted hover:text-primary"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
