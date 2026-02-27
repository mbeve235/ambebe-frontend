"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomerShell } from "@/components/customer-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  AddressSchema,
  CartSchema,
  ListResponseSchema,
  OrderSchema,
  ProfileSchema,
  type Address,
  type Order,
  type Profile
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const addressListSchema = ListResponseSchema(AddressSchema);
const orderListSchema = ListResponseSchema(OrderSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function CustomerHomePage() {
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileState, setProfileState] = useState<LoadState>({ status: "loading" });

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressState, setAddressState] = useState<LoadState>({ status: "loading" });

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersState, setOrdersState] = useState<LoadState>({ status: "loading" });

  const [cartCount, setCartCount] = useState<number | null>(null);
  const [cartState, setCartState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setProfileState({ status: "error", error: "Sessao expirada. Inicie sessao novamente." });
      setAddressState({ status: "error", error: "Sessao expirada. Inicie sessao novamente." });
      setOrdersState({ status: "error", error: "Sessao expirada. Inicie sessao novamente." });
      setCartState({ status: "error", error: "Sessao expirada. Inicie sessao novamente." });
      return;
    }

    setProfileState({ status: "loading" });
    setAddressState({ status: "loading" });
    setOrdersState({ status: "loading" });
    setCartState({ status: "loading" });

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      api.get("/account/profile", { headers }),
      api.get("/account/addresses", { headers }),
      api.get("/account/orders", { headers }),
      api.get("/account/cart", { headers })
    ]).then((results) => {
      const [profileResult, addressResult, ordersResult, cartResult] = results;

      if (profileResult.status === "fulfilled") {
        const parsed = ProfileSchema.safeParse(profileResult.value.data);
        if (parsed.success) {
          setProfile(parsed.data);
          setProfileState({ status: "ready" });
        } else {
          setProfileState({ status: "error", error: "Resposta invalida do perfil" });
        }
      } else {
        setProfileState({ status: "error", error: getApiErrorMessage(profileResult.reason) });
      }

      if (addressResult.status === "fulfilled") {
        const parsed = addressListSchema.safeParse(addressResult.value.data);
        if (parsed.success) {
          setAddresses(parsed.data.items);
          setAddressState({ status: "ready" });
        } else {
          setAddressState({ status: "error", error: "Resposta invalida de enderecos" });
        }
      } else {
        setAddressState({ status: "error", error: getApiErrorMessage(addressResult.reason) });
      }

      if (ordersResult.status === "fulfilled") {
        const parsed = orderListSchema.safeParse(ordersResult.value.data);
        if (parsed.success) {
          setOrders(parsed.data.items);
          setOrdersState({ status: "ready" });
        } else {
          setOrdersState({ status: "error", error: "Resposta invalida de pedidos" });
        }
      } else {
        setOrdersState({ status: "error", error: getApiErrorMessage(ordersResult.reason) });
      }

      if (cartResult.status === "fulfilled") {
        const parsed = CartSchema.safeParse(cartResult.value.data);
        if (parsed.success) {
          const count = parsed.data.items.reduce((sum, item) => sum + item.quantity, 0);
          setCartCount(count);
          setCartState({ status: "ready" });
        } else {
          setCartState({ status: "error", error: "Resposta invalida do carrinho" });
        }
      } else {
        setCartState({ status: "error", error: getApiErrorMessage(cartResult.reason) });
      }
    });
  }, [auth.status]);

  const latestOrder = useMemo(() => {
    if (!orders.length) return null;
    const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted[0] ?? null;
  }, [orders]);

  const pendingPaymentOrder = useMemo(() => {
    return orders.find((order) => order.status === "PENDING" || order.paymentStatus === "PENDING" || order.paymentStatus === "AUTHORIZED") ?? null;
  }, [orders]);

  const roleLabel = useMemo(() => {
    const value = (profile?.role ?? auth.role ?? "").toString().toLowerCase();
    if (value === "admin") return "Admin";
    if (value === "manager" || value === "gestor") return "Gestor";
    return "Cliente";
  }, [auth.role, profile?.role]);

  const nextStep = useMemo(() => {
    if (pendingPaymentOrder) {
      return {
        title: "Concluir pagamento pendente",
        description: "Tem um pedido em aberto. Finalize agora para garantir disponibilidade e expedicao.",
        href: `/cliente/pedidos/${pendingPaymentOrder.id}`,
        action: "Continuar pagamento",
        secondaryHref: "/cliente/pedidos",
        secondaryAction: "Ver todos os pedidos"
      };
    }
    if (cartState.status === "ready" && (cartCount ?? 0) > 0) {
      return {
        title: "Finalize sua compra",
        description: "Voce ja tem itens no carrinho. Revise e conclua seu pedido.",
        href: "/cliente/carrinho",
        action: "Ir para o carrinho",
        secondaryHref: "/#produtos",
        secondaryAction: "Continuar a comprar"
      };
    }
    if (latestOrder) {
      return {
        title: "Comprar novamente",
        description: "Reveja o ultimo pedido para repetir os itens com mais rapidez.",
        href: `/cliente/pedidos/${latestOrder.id}`,
        action: "Repetir compra",
        secondaryHref: "/#produtos",
        secondaryAction: "Explorar novos produtos"
      };
    }
    return {
      title: "Continue explorando produtos",
      description: "Veja o catalogo completo e escolha o que deseja comprar.",
      href: "/#produtos",
      action: "Ver produtos",
      secondaryHref: "/cliente/pedidos",
      secondaryAction: "Acompanhar pedidos"
    };
  }, [cartCount, cartState.status, latestOrder, pendingPaymentOrder]);

  return (
    <CustomerShell title="Resumo do cliente" subtitle="Dados reais da sua conta AMBEBE.">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {pendingPaymentOrder ? "Acao prioritaria" : "Proximo passo"}
          </div>
          <div className="mt-3 text-2xl font-semibold text-text">{nextStep.title}</div>
          <p className="mt-2 text-sm text-muted">{nextStep.description}</p>
          <Button asChild className="mt-4 w-full sm:w-auto">
            <Link
              href={nextStep.href}
              onClick={() =>
                trackEvent("customer_dashboard_primary_cta_click", {
                  cta: nextStep.action,
                  href: nextStep.href,
                  has_pending_payment: Boolean(pendingPaymentOrder)
                })
              }
            >
              {nextStep.action}
            </Link>
          </Button>
          <Button asChild variant="outline" className="mt-2 w-full sm:mt-3 sm:w-auto">
            <Link
              href={nextStep.secondaryHref}
              onClick={() =>
                trackEvent("customer_dashboard_secondary_cta_click", {
                  cta: nextStep.secondaryAction,
                  href: nextStep.secondaryHref,
                  has_pending_payment: Boolean(pendingPaymentOrder)
                })
              }
            >
              {nextStep.secondaryAction}
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <div className="text-xs text-muted">Itens no carrinho</div>
            {cartState.status === "loading" ? (
              <Skeleton className="mt-3 h-5 w-16" />
            ) : cartState.status === "error" ? (
              <div className="mt-3 text-xs text-amber-600">{cartState.error}</div>
            ) : (
              <div className="mt-3 text-xl font-semibold text-text">{cartCount ?? 0}</div>
            )}
            <Link href="/cliente/carrinho" className="mt-3 inline-block text-xs text-primary">
              Ver carrinho
            </Link>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <div className="text-xs text-muted">Pedidos</div>
            {ordersState.status === "loading" ? (
              <Skeleton className="mt-3 h-5 w-16" />
            ) : ordersState.status === "error" ? (
              <div className="mt-3 text-xs text-amber-600">{ordersState.error}</div>
            ) : (
              <div className="mt-3 text-xl font-semibold text-text">{orders.length}</div>
            )}
            <Link href="/cliente/pedidos" className="mt-3 inline-block text-xs text-primary">
              Ver pedidos
            </Link>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <div className="text-xs text-muted">Enderecos</div>
            {addressState.status === "loading" ? (
              <Skeleton className="mt-3 h-5 w-16" />
            ) : addressState.status === "error" ? (
              <div className="mt-3 text-xs text-amber-600">{addressState.error}</div>
            ) : (
              <div className="mt-3 text-xl font-semibold text-text">{addresses.length}</div>
            )}
            <Link href="/cliente/enderecos" className="mt-3 inline-block text-xs text-primary">
              Gerenciar enderecos
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Perfil</div>
          {profileState.status === "loading" ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : profileState.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{profileState.error}</div>
          ) : profile ? (
            <div className="mt-4 space-y-1 text-sm text-text">
              <div>Nome: {profile.name || "Sem nome"}</div>
              <div>Email: {profile.email}</div>
              <div>Tipo de conta: {roleLabel}</div>
            </div>
          ) : null}
          <Link href="/cliente/perfil" className="mt-4 inline-block text-sm text-primary">
            Atualizar perfil
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Ultimo pedido</div>
          {ordersState.status === "loading" ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : ordersState.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{ordersState.error}</div>
          ) : latestOrder ? (
            <div className="mt-4 space-y-1 text-sm text-text">
              <div>Pedido: {latestOrder.id.slice(0, 8)}</div>
              <div>Status: {latestOrder.status}</div>
              <div>Total: {formatPrice(latestOrder.total)}</div>
              <div>Data: {formatDate(latestOrder.createdAt)}</div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhum pedido encontrado.</div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/cliente/pedidos" className="text-sm text-primary">
              Ver detalhes
            </Link>
            {latestOrder ? (
              <Link
                href={`/cliente/pedidos/${latestOrder.id}`}
                className="text-sm text-primary"
                onClick={() =>
                  trackEvent("reorder_click", {
                    source: "customer_dashboard_last_order",
                    order_id: latestOrder.id
                  })
                }
              >
                Comprar novamente
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </CustomerShell>
  );
}

