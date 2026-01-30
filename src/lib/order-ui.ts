export type StatusBadgeVariant = "default" | "success" | "warning" | "neutral";

type StatusInfo = { label: string; variant: StatusBadgeVariant; hint?: string };

export const getOrderStatusInfo = (status?: string | null): StatusInfo => {
  switch (status) {
    case "PENDING":
      return { label: "Aguardando pagamento", variant: "warning", hint: "Pedido recebido" };
    case "PAID":
      return { label: "Pago", variant: "success", hint: "Pagamento confirmado" };
    case "SHIPPED":
      return { label: "Enviado", variant: "default", hint: "Em transporte" };
    case "CANCELED":
      return { label: "Cancelado", variant: "neutral", hint: "Pedido encerrado" };
    default:
      return { label: status ? String(status) : "Desconhecido", variant: "neutral" };
  }
};

export const getPaymentStatusInfo = (status?: string | null): StatusInfo => {
  switch (status) {
    case "PENDING":
      return { label: "Pendente", variant: "warning", hint: "Aguardando pagamento" };
    case "AUTHORIZED":
      return { label: "Autorizado", variant: "default", hint: "Aguardando captura" };
    case "CAPTURED":
      return { label: "Capturado", variant: "success", hint: "Pagamento aprovado" };
    case "FAILED":
      return { label: "Falhou", variant: "warning", hint: "Tente novamente" };
    case "REFUNDED":
      return { label: "Reembolsado", variant: "neutral", hint: "Valor devolvido" };
    default:
      return { label: status ? String(status) : "Desconhecido", variant: "neutral" };
  }
};

export const getOrderItemCount = (items?: { quantity?: number }[] | null) => {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => sum + (typeof item.quantity === "number" ? item.quantity : 0), 0);
};

export type PaymentProviderOption = {
  value: string;
  label: string;
  available: boolean;
  note?: string;
};

export const paymentProviders: PaymentProviderOption[] = [
  { value: "STRIPE", label: "Stripe (Cartao bancario)", available: true },
  { value: "COD", label: "Pagamento na Entrega (Dinheiro)", available: true },
  { value: "MPESA", label: "M-PESA", available: false, note: "Em desenvolvimento" },
  { value: "EMOLA", label: "E-MOLA", available: false, note: "Em desenvolvimento" },
  { value: "PAYPAL", label: "PayPal", available: false, note: "Em desenvolvimento" }
];

export const getPaymentProviderLabel = (provider?: string | null) => {
  if (!provider) return null;
  const match = paymentProviders.find((item) => item.value === provider);
  return match ? match.label : provider;
};
