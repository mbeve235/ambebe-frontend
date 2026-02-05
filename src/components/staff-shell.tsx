"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Header, type HeaderNotificationItem, type HeaderNotifications } from "@/components/header";
import { RoleGuard } from "@/components/role-guard";
import { useAuth } from "@/hooks/use-auth";
import { useCartCount } from "@/hooks/use-cart";
import { api, getApiErrorMessage } from "@/lib/api";
import { ListResponseSchema, StaffOrderSchema, type StaffOrder } from "@/lib/api-schema";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const primaryNavItems = [
  { href: "/gestor", label: "Resumo" },
  { href: "/gestor/pedidos", label: "Pedidos" },
  { href: "/gestor/produtos", label: "Produtos" }
];

const secondaryNavItems = [
  { href: "/gestor/categorias", label: "Categorias" },
  { href: "/gestor/estoque", label: "Estoque" },
  { href: "/gestor/pagamentos", label: "Pagamentos" }
];

type StaffShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

const orderListSchema = ListResponseSchema(StaffOrderSchema);
const dismissedOrdersKey = "ambebe_staff_dismissed_orders";

const readDismissedOrders = (storageKey: string) => {
  if (typeof window === "undefined") return new Set<string>();
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
};

const writeDismissedOrders = (storageKey: string, values: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(values)));
  } catch {
    // ignore storage errors
  }
};

export function StaffShell({ title, subtitle, children }: StaffShellProps) {
  const auth = useAuth();
  const cartState = useCartCount(auth.status, auth.role);
  const refreshCart = cartState.refresh;
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState<HeaderNotifications>({
    status: "idle",
    count: 0,
    items: []
  });

  const handleLogout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    const target = "/login?role=gestor&logout=1";
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

  const loadNotifications = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setNotifications({ status: "error", count: 0, items: [], error: "Token ausente" });
      return;
    }

    setNotifications((prev) => ({ ...prev, status: "loading", error: undefined }));

    try {
      const response = await api.get("/staff/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = orderListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de pedidos");
      }

      const dismissedOrders = readDismissedOrders(dismissedOrdersKey);
      const pendingOrders = parsed.data.items.filter((order) => order.status === "PENDING");
      const sortedPendingOrders = [...pendingOrders].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      const visiblePendingOrders = sortedPendingOrders.filter((order) => !dismissedOrders.has(order.id));
      const items = visiblePendingOrders.slice(0, 5).map((order: StaffOrder) => {
        const customer = order.user?.name || order.user?.email || order.userId;
        return {
          id: `order-${order.id}`,
          kind: "order" as const,
          refId: order.id,
          title: `Novo pedido ${order.id.slice(0, 8)}`,
          description: `Cliente: ${customer} • Total: ${formatPrice(order.total)}`,
          href: `/gestor/pedidos/${order.id}`,
          tag: "Pedido"
        };
      });

      setNotifications({ status: "ready", count: visiblePendingOrders.length, items });
    } catch (error) {
      setNotifications({ status: "error", count: 0, items: [], error: getApiErrorMessage(error) });
    }
  }, []);

  const handleNotificationClick = useCallback((item: HeaderNotificationItem) => {
    setNotifications((prev) => {
      const nextItems = prev.items.filter((entry) => entry.id !== item.id);
      const nextCount = Math.max(0, prev.count - 1);
      return { ...prev, items: nextItems, count: nextCount };
    });
    if (item.kind === "order" && item.refId) {
      const dismissedOrders = readDismissedOrders(dismissedOrdersKey);
      dismissedOrders.add(item.refId);
      writeDismissedOrders(dismissedOrdersKey, dismissedOrders);
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    };
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [auth.status, loadNotifications]);

  return (
    <RoleGuard auth={auth} allowedRoles={["manager"]}>
      <div className="min-h-screen">
        <Header
          cartCount={cartState.count}
          cartStatus={cartState.status}
          cartError={cartState.error}
          authStatus={auth.status}
          user={auth.user}
          role={auth.role}
          onLogout={handleLogout}
          notifications={{ ...notifications, onItemClick: handleNotificationClick }}
        />

        <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <section className="mt-10 rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Gestor AMBEBE</div>
            <h1 className="mt-3 font-heading text-3xl text-text">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
            <p className="mt-4 text-xs text-muted">Acesse as tarefas principais primeiro.</p>

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

