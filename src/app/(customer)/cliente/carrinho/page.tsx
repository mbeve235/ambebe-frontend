"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomerShell } from "@/components/customer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  AddressSchema,
  CartSchema,
  CartItemSchema,
  CheckoutSummarySchema,
  ListResponseSchema,
  OrderSchema,
  type Address,
  type Cart,
  type CheckoutSummary,
  type Order
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { paymentProviders } from "@/lib/order-ui";
import { buildWhatsappOrderMessage, buildWhatsappUrl } from "@/lib/whatsapp";
import { useAuth } from "@/hooks/use-auth";

function createIdempotencyKey() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `key-${Date.now()}-${random}`;
}

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

const addressListSchema = ListResponseSchema(AddressSchema);

export default function CustomerCartPage() {
  const auth = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [summaryState, setSummaryState] = useState<LoadState>({ status: "loading" });
  const [couponInput, setCouponInput] = useState("");
  const [activeCoupon, setActiveCoupon] = useState<string | null>(null);
  const [couponState, setCouponState] = useState<ActionState>({ status: "idle" });
  const [couponError, setCouponError] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<string>(
    paymentProviders.find((provider) => provider.available)?.value ?? paymentProviders[0].value
  );
  const [mpesaPhone, setMpesaPhone] = useState("");

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemActions, setItemActions] = useState<Record<string, ActionState | undefined>>({});
const [checkoutState, setCheckoutState] = useState<ActionState>({ status: "idle" });
const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);

  const notifyCartUpdated = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("ambebe-cart-updated"));
  };

  const normalizeCoupon = (value: string) => value.trim().toUpperCase();

  const fetchCart = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/account/cart", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = CartSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do carrinho");
      }
      setCart(parsed.data);
      setQuantities(
        parsed.data.items.reduce((acc, item) => {
          acc[item.id] = item.quantity;
          return acc;
        }, {} as Record<string, number>)
      );
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  const fetchSummary = useCallback(async (couponCode?: string | null) => {
    const token = getAccessToken();
    if (!token) {
      setSummaryState({ status: "error", error: "Token ausente" });
      throw new Error("Token ausente");
    }

    setSummaryState({ status: "loading" });
    try {
      const params = couponCode ? { coupon: couponCode } : undefined;
      const response = await api.get("/account/checkout/summary", {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      const parsed = CheckoutSummarySchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do resumo");
      }
      setSummary(parsed.data);
      setSummaryState({ status: "ready" });
      return parsed.data;
    } catch (error) {
      setSummaryState({ status: "error", error: getApiErrorMessage(error) });
      throw error;
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchCart();
  }, [auth.status, fetchCart]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) return;
    api
      .get("/account/addresses", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        const parsed = addressListSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida de enderecos");
        }
        const preferred = parsed.data.items.find((item) => item.isDefault) ?? parsed.data.items[0] ?? null;
        setDefaultAddress(preferred);
      })
      .catch(() => undefined);
  }, [auth.status]);

  useEffect(() => {
    if (!cart) {
      setSummary(null);
      setSummaryState({ status: "ready" });
      return;
    }
    if (!cart.items.length) {
      setSummary({ items: [], total: 0 });
      setSummaryState({ status: "ready" });
      return;
    }
    fetchSummary(activeCoupon).catch(() => undefined);
  }, [cart, activeCoupon, fetchSummary]);

  const handleApplyCoupon = async () => {
    const normalized = normalizeCoupon(couponInput);
    if (!normalized) {
      const message = "Informe um cupom valido.";
      setCouponError(message);
      setCouponState({ status: "error", error: message });
      return;
    }

    setCouponState({ status: "loading" });
    setCouponError(null);
    try {
      const nextSummary = await fetchSummary(normalized);
      setActiveCoupon(nextSummary.couponCode ?? normalized);
      setCouponState({ status: "success" });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setCouponState({ status: "error", error: message });
      setCouponError(message);
    }
  };

  const handleRemoveCoupon = async () => {
    setActiveCoupon(null);
    setCouponInput("");
    setCouponState({ status: "idle" });
    setCouponError(null);

    if (!cart?.items.length) {
      setSummary({ items: [], total: 0 });
      return;
    }

    fetchSummary(null).catch(() => undefined);
  };

  const handleUpdateQuantity = async (itemId: string) => {
    const token = getAccessToken();
    if (!token) {
      setItemActions((prev) => ({ ...prev, [itemId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const quantity = quantities[itemId];
    if (!quantity || quantity < 1) return;

    setItemActions((prev) => ({ ...prev, [itemId]: { status: "loading" } }));
    try {
      const response = await api.patch(
        `/account/cart/items/${itemId}`,
        { quantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const parsed = CartItemSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do item");
      }
      setCart((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) => (item.id === itemId ? { ...item, quantity: parsed.data.quantity } : item))
        };
      });
      setQuantities((prev) => ({ ...prev, [itemId]: parsed.data.quantity }));
      setItemActions((prev) => ({ ...prev, [itemId]: { status: "success" } }));
      notifyCartUpdated();
    } catch (error) {
      setItemActions((prev) => ({ ...prev, [itemId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const token = getAccessToken();
    if (!token) {
      setItemActions((prev) => ({ ...prev, [itemId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setItemActions((prev) => ({ ...prev, [itemId]: { status: "loading" } }));
    try {
      await api.delete(`/account/cart/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItemActions((prev) => ({ ...prev, [itemId]: { status: "success" } }));
      await fetchCart();
      notifyCartUpdated();
    } catch (error) {
      setItemActions((prev) => ({ ...prev, [itemId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleClearCart = async () => {
    const token = getAccessToken();
    if (!token) {
      setItemActions((prev) => ({ ...prev, clear: { status: "error", error: "Token ausente" } }));
      return;
    }

    setItemActions((prev) => ({ ...prev, clear: { status: "loading" } }));
    try {
      await api.delete("/account/cart", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItemActions((prev) => ({ ...prev, clear: { status: "success" } }));
      await fetchCart();
      notifyCartUpdated();
    } catch (error) {
      setItemActions((prev) => ({ ...prev, clear: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleCheckout = async () => {
    const token = getAccessToken();
    if (!token) {
      setCheckoutState({ status: "error", error: "Token ausente" });
      return;
    }

    const selectedProvider = paymentProviders.find((provider) => provider.value === paymentProvider);
    if (selectedProvider && !selectedProvider.available) {
      setCheckoutState({ status: "error", error: "Metodo de pagamento em desenvolvimento." });
      return;
    }

    setCheckoutState({ status: "loading" });
    try {
      const payload: Record<string, string> = {};
      if (activeCoupon) payload.couponCode = activeCoupon;
      if (paymentProvider) payload.paymentProvider = paymentProvider;
      if (paymentProvider === "MPESA" && mpesaPhone.trim()) {
        payload.phone = mpesaPhone.trim();
      }

      const response = await api.post("/account/checkout", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "idempotency-key": createIdempotencyKey()
        }
      });
      const parsed = OrderSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do checkout");
      }
      setCheckoutOrder(parsed.data);
      if (parsed.data.payment?.provider === "COD" && typeof window !== "undefined") {
        const message = buildWhatsappOrderMessage(parsed.data, {
          name: auth.user?.name ?? auth.user?.email ?? undefined,
          phone: defaultAddress?.phone ?? undefined,
          address: defaultAddress ?? undefined
        });
        const whatsappUrl = buildWhatsappUrl(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP, message);
        if (!whatsappUrl) {
          setCheckoutState({ status: "error", error: "Whatsapp nao configurado." });
          return;
        }
        setCheckoutState({ status: "success" });
        window.location.href = whatsappUrl;
      } else {
        setCheckoutState({ status: "success" });
      }
      if (parsed.data.payment?.checkoutUrl && typeof window !== "undefined") {
        window.location.href = parsed.data.payment.checkoutUrl;
      }
      await fetchCart();
      notifyCartUpdated();
    } catch (error) {
      setCheckoutState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const totalFallback = useMemo(() => {
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + Number(item.priceSnapshot) * item.quantity, 0);
  }, [cart]);

  const itemCountFallback = useMemo(() => {
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const summaryItemCount = summary
    ? summary.items.reduce((sum, item) => sum + item.quantity, 0)
    : itemCountFallback;
  const summarySubtotal = Number(summary?.subtotal ?? totalFallback);
  const summaryDiscount = Number(summary?.discountTotal ?? 0);
  const summaryTotal = Number(summary?.total ?? totalFallback);
  const selectedProvider = paymentProviders.find((provider) => provider.value === paymentProvider);
  const providerUnavailable = selectedProvider ? !selectedProvider.available : false;

  return (
    <CustomerShell title="Carrinho" subtitle="Itens reais adicionados a sua conta.">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Itens no carrinho</div>
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : cart && cart.items.length ? (
            <div className="mt-4 space-y-4">
              {cart.items.map((item) => {
                const action = itemActions[item.id];
                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-text">{item.nameSnapshot}</div>
                        <div className="text-xs text-muted">SKU: {item.skuSnapshot}</div>
                        <div className="text-xs text-muted">Preco: {formatPrice(item.priceSnapshot)}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <Input
                          type="number"
                          min={1}
                          value={quantities[item.id] ?? item.quantity}
                          onChange={(event) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [item.id]: Number(event.target.value)
                            }))
                          }
                          className="w-24"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQuantity(item.id)}
                          disabled={action?.status === "loading"}
                        >
                          Atualizar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={action?.status === "loading"}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                    {action?.status === "error" ? (
                      <div className="mt-2 text-xs text-amber-600">{action.error}</div>
                    ) : null}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="ghost"
                onClick={handleClearCart}
                disabled={itemActions.clear?.status === "loading"}
              >
                Limpar carrinho
              </Button>
              {itemActions.clear?.status === "error" ? (
                <div className="text-xs text-amber-600">{itemActions.clear.error}</div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Seu carrinho esta vazio.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Resumo e checkout</div>
          {summaryState.status === "loading" ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : summaryState.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{summaryState.error}</div>
          ) : (
            <div className="mt-4 space-y-2 text-sm text-text">
              <div>Subtotal: {formatPrice(summarySubtotal)}</div>
              {summaryDiscount > 0 ? <div className="text-success">Desconto: -{formatPrice(summaryDiscount)}</div> : null}
              <div>Total: {formatPrice(summaryTotal)}</div>
              <div>Itens: {summaryItemCount}</div>
              {summary?.couponCode ? (
                <div className="text-xs text-success">Cupom aplicado: {summary.couponCode}</div>
              ) : null}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-border bg-surface/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Cupom de desconto</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Digite seu cupom"
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleApplyCoupon}
                disabled={couponState.status === "loading" || !cart?.items.length}
              >
                {couponState.status === "loading" ? "Aplicando" : "Aplicar"}
              </Button>
            </div>
            {activeCoupon ? (
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>Em uso: {activeCoupon}</span>
                <Button type="button" size="sm" variant="ghost" onClick={handleRemoveCoupon}>
                  Remover
                </Button>
              </div>
            ) : null}
            {couponError ? <div className="mt-2 text-xs text-amber-600">{couponError}</div> : null}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Metodo de pagamento</div>
            <div className="mt-3">
              <Select value={paymentProvider} onValueChange={setPaymentProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o metodo" />
                </SelectTrigger>
                <SelectContent>
                  {paymentProviders.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={!option.available}>
                      <span className="flex items-center justify-between gap-2">
                        <span>{option.label}</span>
                        {!option.available && option.note ? (
                          <span className="text-xs text-amber-600">{option.note}</span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {providerUnavailable ? (
              <div className="mt-2 text-xs text-amber-600">Metodo em desenvolvimento.</div>
            ) : paymentProvider === "MPESA" ? (
              <div className="mt-3 space-y-2 text-xs text-muted">
                <Input
                  placeholder="Telefone M-PESA (ex: 25884...)"
                  value={mpesaPhone}
                  onChange={(event) => setMpesaPhone(event.target.value)}
                />
                <div>Se deixar vazio, vamos usar o telefone do endereco padrao.</div>
              </div>
            ) : paymentProvider === "COD" ? (
              <div className="mt-2 text-xs text-muted">
                Pagamento na entrega: voce paga quando receber o pedido.
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted">Selecione como deseja pagar.</div>
            )}
          </div>

          <Button
            type="button"
            className="mt-4 w-full"
            onClick={handleCheckout}
            disabled={checkoutState.status === "loading" || !cart?.items.length || providerUnavailable}
          >
            {checkoutState.status === "loading" ? "Processando" : "Finalizar compra"}
          </Button>

          {checkoutState.status === "success" && checkoutOrder ? (
            <div className="mt-3 space-y-2 text-xs text-success">
              <div>
                Pedido criado: {checkoutOrder.id.slice(0, 8)} (status {checkoutOrder.status})
              </div>
              {checkoutOrder.payment?.status === "FAILED" ? (
                <div className="text-amber-600">
                  Falha ao iniciar o pagamento. Tente novamente nos detalhes do pedido.
                </div>
              ) : null}
              {checkoutOrder.payment?.provider === "MPESA" && checkoutOrder.payment?.status !== "FAILED" ? (
                <div className="text-xs text-muted">
                  Pagamento M-PESA enviado. Confirme no seu telefone e acompanhe o status do pedido.
                </div>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link href={`/cliente/pedidos/${checkoutOrder.id}`}>Ver pedido</Link>
              </Button>
            </div>
          ) : null}
          {checkoutState.status === "error" ? (
            <div className="mt-3 text-xs text-amber-600">{checkoutState.error}</div>
          ) : null}
        </div>
      </section>
    </CustomerShell>
  );
}
