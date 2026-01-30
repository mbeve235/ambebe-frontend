import type { IdempotencyKey } from "@/lib/api-schema";
import { formatPrice } from "@/lib/format";
import { getPaymentProviderLabel } from "@/lib/order-ui";

export type IdempotencySummary = {
  title: string;
  kindLabel: string;
  highlight?: string;
  details: { label: string; value: string }[];
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  SHIPPED: "Enviado",
  CANCELED: "Cancelado",
  AUTHORIZED: "Autorizado",
  CAPTURED: "Capturado",
  FAILED: "Falhou",
  REFUNDED: "Reembolsado"
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const formatStatus = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().toUpperCase();
  return statusLabels[normalized] ?? value;
};

const formatMoney = (value: unknown): string | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  return formatPrice(value);
};

const formatOptionalText = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
};

const extractCustomerLabel = (payload: Record<string, unknown>): string | null => {
  const user = isRecord(payload.user) ? payload.user : null;
  const name = formatOptionalText(user?.name ?? payload.customerName ?? payload.userName ?? payload.name);
  const email = formatOptionalText(user?.email ?? payload.customerEmail ?? payload.userEmail ?? payload.email);

  if (name && email) return `${name} (${email})`;
  return name ?? email ?? null;
};

const isOrderPayload = (value: Record<string, unknown>) =>
  "paymentStatus" in value && "total" in value;

const isPaymentPayload = (value: Record<string, unknown>) =>
  "orderId" in value && "amount" in value;

export function getIdempotencySummary(item: IdempotencyKey): IdempotencySummary {
  if (!isRecord(item.responseBody)) {
    return {
      title: "Operacao registrada",
      kindLabel: "Operacao",
      highlight: "Resposta armazenada",
      details: []
    };
  }

  if (isOrderPayload(item.responseBody)) {
    const details: { label: string; value: string }[] = [];
    const total = formatMoney(item.responseBody.total);
    const status = formatStatus(item.responseBody.status);
    const paymentStatus = formatStatus(item.responseBody.paymentStatus);
    const coupon = formatOptionalText(item.responseBody.couponCode);
    const customer = extractCustomerLabel(item.responseBody);
    const itemsCount = Array.isArray(item.responseBody.items) ? item.responseBody.items.length : null;

    if (customer) details.push({ label: "Cliente", value: customer });
    if (status) details.push({ label: "Status", value: status });
    if (paymentStatus) details.push({ label: "Pagamento", value: paymentStatus });
    if (coupon) details.push({ label: "Cupom", value: coupon });
    if (itemsCount !== null) details.push({ label: "Itens", value: String(itemsCount) });

    return {
      title: "Pedido criado",
      kindLabel: "Pedido",
      highlight: total ? `Total: ${total}` : undefined,
      details
    };
  }

  if (isPaymentPayload(item.responseBody)) {
    const details: { label: string; value: string }[] = [];
    const amount = formatMoney(item.responseBody.amount);
    const status = formatStatus(item.responseBody.status);
    const providerLabel = getPaymentProviderLabel(
      typeof item.responseBody.provider === "string" ? item.responseBody.provider : undefined
    );
    const provider = formatOptionalText(providerLabel ?? item.responseBody.provider);
    const customer = extractCustomerLabel(item.responseBody);

    if (customer) details.push({ label: "Cliente", value: customer });
    if (status) details.push({ label: "Status", value: status });
    if (provider) details.push({ label: "Provedor", value: provider });

    return {
      title: "Pagamento criado",
      kindLabel: "Pagamento",
      highlight: amount ? `Valor: ${amount}` : undefined,
      details
    };
  }

  return {
    title: "Operacao registrada",
    kindLabel: "Operacao",
    highlight: "Resposta armazenada",
    details: []
  };
}
