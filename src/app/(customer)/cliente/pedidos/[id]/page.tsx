"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { Badge } from "@/components/ui/badge";
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
  ListResponseSchema,
  OrderSchema,
  PaymentSchema,
  type Address,
  type Order
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import {
  getOrderItemCount,
  getOrderDisplayNumber,
  getOrderStatusInfo,
  paymentProviders,
  getPaymentProviderLabel,
  getPaymentStatusInfo
} from "@/lib/order-ui";
import { buildWhatsappOrderMessage, buildWhatsappUrl } from "@/lib/whatsapp";
import { useAuth } from "@/hooks/use-auth";

const addressListSchema = ListResponseSchema(AddressSchema);

function CustomerOrderDetailPageContent() {
  const auth = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const stripeSessionId = useMemo(() => searchParams?.get("session_id") ?? "", [searchParams]);
  const stripeStatus = useMemo(() => searchParams?.get("stripe") ?? "", [searchParams]);

  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [cancelState, setCancelState] = useState<"idle" | "loading" | "error">("idle");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [stripeConfirmState, setStripeConfirmState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [stripeConfirmMessage, setStripeConfirmMessage] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<string>(
    paymentProviders.find((provider) => provider.available)?.value ?? paymentProviders[0].value
  );
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);

  const createIdempotencyKey = () => {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    const random = Math.random().toString(16).slice(2);
    return `key-${Date.now()}-${random}`;
  };

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    const token = getAccessToken();
    if (!token) {
      setState("error");
      setError("Token ausente");
      return;
    }

    setState("loading");
    try {
      const response = await api.get(`/account/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = OrderSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do pedido");
      }
      setOrder(parsed.data);
      setState("ready");
    } catch (err) {
      setState("error");
      setError(getApiErrorMessage(err));
    }
  }, [orderId]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchOrder();
  }, [auth.status, fetchOrder]);

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
    if (stripeStatus !== "success" || !stripeSessionId || auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) return;

    setStripeConfirmState("loading");
    setStripeConfirmMessage(null);
    api
      .post(
        "/account/stripe/confirm",
        { sessionId: stripeSessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then(() => {
        setStripeConfirmState("success");
        setStripeConfirmMessage("Pagamento confirmado com sucesso.");
        fetchOrder();
      })
      .catch((error) => {
        setStripeConfirmState("error");
        setStripeConfirmMessage(getApiErrorMessage(error));
      });
  }, [stripeSessionId, stripeStatus, auth.status, fetchOrder]);

  const handleCancel = async () => {
    if (!orderId) return;
    const token = getAccessToken();
    if (!token) {
      setCancelState("error");
      setCancelError("Token ausente");
      return;
    }

    setCancelState("loading");
    setCancelError(null);
    try {
      const response = await api.post(`/account/orders/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = OrderSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do pedido");
      }
      setOrder(parsed.data);
      setCancelState("idle");
    } catch (err) {
      setCancelState("error");
      setCancelError(getApiErrorMessage(err));
    }
  };

  const handleCreatePayment = async () => {
    if (!orderId) return;
    const token = getAccessToken();
    if (!token) {
      setPaymentState("error");
      setPaymentError("Token ausente");
      return;
    }

    const selectedProvider = paymentProviders.find((provider) => provider.value === paymentProvider);
    if (selectedProvider && !selectedProvider.available) {
      setPaymentState("error");
      setPaymentError("Metodo de pagamento em desenvolvimento.");
      return;
    }

    setPaymentState("loading");
    setPaymentError(null);
    try {
      const response = await api.post(
        `/account/orders/${orderId}/payments`,
        {
          provider: paymentProvider,
          phone: paymentProvider === "MPESA" && mpesaPhone.trim() ? mpesaPhone.trim() : undefined
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "idempotency-key": createIdempotencyKey()
          }
        }
      );
      const parsed = PaymentSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do pagamento");
      }
      setOrder((prev) => (prev ? { ...prev, payment: parsed.data } : prev));
      if (paymentProvider === "MPESA" && parsed.data.status === "FAILED") {
        setPaymentState("error");
        setPaymentError("Falha ao iniciar o pagamento M-PESA. Tente novamente.");
      } else {
        if (paymentProvider === "COD" && order && typeof window !== "undefined") {
          const message = buildWhatsappOrderMessage(order, {
            name: auth.user?.name ?? auth.user?.email ?? undefined,
            phone: defaultAddress?.phone ?? undefined,
            address: defaultAddress ?? undefined
          });
          const whatsappUrl = buildWhatsappUrl(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP, message);
          if (!whatsappUrl) {
            setPaymentState("error");
            setPaymentError("Whatsapp nao configurado.");
            return;
          }
          setPaymentState("success");
          window.location.href = whatsappUrl;
          return;
        }
        setPaymentState("success");
        if (parsed.data.checkoutUrl && typeof window !== "undefined") {
          window.location.href = parsed.data.checkoutUrl;
        }
      }
    } catch (err) {
      setPaymentState("error");
      setPaymentError(getApiErrorMessage(err));
    }
  };

  const selectedProvider = paymentProviders.find((provider) => provider.value === paymentProvider);
  const providerUnavailable = selectedProvider ? !selectedProvider.available : false;
  const canGeneratePayment =
    order?.status === "PENDING" && (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED");

  return (
    <CustomerShell title="Detalhe do pedido" subtitle="Acompanhe itens e pagamento do pedido.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/cliente/pedidos" className="text-sm text-primary">
          Voltar para pedidos
        </Link>

        {state === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{error}</div>
        ) : order ? (
          <div className="mt-4 space-y-6">
            {(() => {
              const orderNumber = getOrderDisplayNumber(order);
              const statusInfo = getOrderStatusInfo(order.status);
              const paymentInfo = getPaymentStatusInfo(order.payment?.status ?? order.paymentStatus);
              const itemCount = getOrderItemCount(order.items);
              const subtotal = order.items?.reduce(
                (sum, item) => sum + Number(item.priceSnapshot) * item.quantity,
                0
              );
              const discountTotal = Number(order.discountTotal ?? 0);

              return (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-surface/70 p-4">
                      <div className="text-xs text-muted">Pedido</div>
                      <div className="mt-2 text-base font-semibold text-text">{orderNumber}</div>
                      <div className="text-xs text-muted">Criado: {formatDate(order.createdAt)}</div>
                      <div className="text-xs text-muted">Itens: {itemCount}</div>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface/70 p-4">
                      <div className="text-xs text-muted">Status do pedido</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {statusInfo.hint ? <span className="text-xs text-muted">{statusInfo.hint}</span> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface/70 p-4">
                      <div className="text-xs text-muted">Pagamento</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                        {paymentInfo.hint ? <span className="text-xs text-muted">{paymentInfo.hint}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="text-sm font-semibold text-text">Resumo financeiro</div>
                    <div className="mt-3 grid gap-3 text-sm text-text sm:grid-cols-3">
                      <div>
                        <div className="text-xs text-muted">Subtotal</div>
                        <div className="text-sm font-semibold text-text">{formatPrice(subtotal ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Desconto</div>
                        <div className="text-sm font-semibold text-text">{formatPrice(discountTotal)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Total</div>
                        <div className="text-sm font-semibold text-text">{formatPrice(order.total)}</div>
                      </div>
                    </div>
                    {order.couponCode ? (
                      <div className="mt-3 text-xs text-muted">Cupom aplicado: {order.couponCode}</div>
                    ) : null}
                  </div>
                </>
              );
            })()}

            {order.status === "PENDING" ? (
              <div>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={cancelState === "loading"}>
                  {cancelState === "loading" ? "Cancelando" : "Cancelar pedido"}
                </Button>
                {cancelState === "error" ? (
                  <div className="mt-2 text-xs text-amber-600">{cancelError}</div>
                ) : null}
              </div>
            ) : null}

            {stripeConfirmState !== "idle" ? (
              <div
                className={
                  stripeConfirmState === "success"
                    ? "text-xs text-success"
                    : stripeConfirmState === "error"
                      ? "text-xs text-amber-600"
                      : "text-xs text-muted"
                }
              >
                {stripeConfirmState === "loading" ? "Confirmando pagamento Stripe..." : stripeConfirmMessage}
              </div>
            ) : null}

            <div>
              <div className="text-sm font-semibold text-text">Itens</div>
              {order.items?.length ? (
                <div className="mt-3 space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-text">{item.nameSnapshot}</div>
                          <div className="text-xs text-muted">SKU: {item.skuSnapshot}</div>
                          <div className="text-xs text-muted">Quantidade: {item.quantity}</div>
                        </div>
                        <div className="text-right text-xs text-muted">
                          <div>Preco unitario: {formatPrice(item.priceSnapshot)}</div>
                          <div>Total: {formatPrice(Number(item.priceSnapshot) * item.quantity)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted">Nenhum item encontrado.</div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-text">Pagamento</div>
              {order.payment ? (
                <div className="mt-2 text-sm text-text">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getPaymentStatusInfo(order.payment.status).variant}>
                      {getPaymentStatusInfo(order.payment.status).label}
                    </Badge>
                    <span className="text-xs text-muted">Valor: {formatPrice(order.payment.amount)}</span>
                  </div>
                  {order.payment.provider ? (
                    <div>Provedor: {getPaymentProviderLabel(order.payment.provider) ?? order.payment.provider}</div>
                  ) : null}
                  {order.payment.externalRef ? <div>Referencia: {order.payment.externalRef}</div> : null}
                  {order.payment.provider === "MPESA" && order.payment.status === "AUTHORIZED" ? (
                    <div className="mt-2 text-xs text-muted">Confirme o pagamento no seu telefone M-PESA.</div>
                  ) : null}
                  {order.payment.provider === "COD" ? (
                    <div className="mt-2 text-xs text-muted">Pagamento sera feito na entrega.</div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 space-y-3 text-sm text-muted">
                  <div>Sem pagamento associado.</div>
                </div>
              )}

              {canGeneratePayment ? (
                <div className="mt-3 text-sm text-muted">
                  <div className="mb-3">
                    <div className="text-xs text-muted">Metodo de pagamento</div>
                    <div className="mt-2">
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
                      <div className="mt-3 text-xs text-muted">
                        <Input
                          placeholder="Telefone M-PESA (ex: 25884...)"
                          value={mpesaPhone}
                          onChange={(event) => setMpesaPhone(event.target.value)}
                        />
                        <div className="mt-2">Se deixar vazio, vamos usar o telefone do endereco padrao.</div>
                      </div>
                    ) : paymentProvider === "COD" ? (
                      <div className="mt-2 text-xs text-muted">
                        Pagamento na entrega: voce paga quando receber o pedido.
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreatePayment}
                    disabled={paymentState === "loading" || providerUnavailable}
                  >
                    {paymentState === "loading" ? "Gerando pagamento" : "Gerar pagamento"}
                  </Button>
                  {paymentState === "error" ? (
                    <div className="mt-2 text-xs text-amber-600">{paymentError}</div>
                  ) : null}
                  {paymentState === "success" ? (
                    <div className="mt-2 text-xs text-success">
                      {paymentProvider === "MPESA"
                        ? "Solicitacao M-PESA enviada. Confirme no telefone."
                        : "Pagamento criado com sucesso."}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </CustomerShell>
  );
}

export default function CustomerOrderDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CustomerOrderDetailPageContent />
    </Suspense>
  );
}
