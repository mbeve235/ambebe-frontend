import type { Address, Order } from "@/lib/api-schema";
import { formatPrice } from "@/lib/format";

const normalizePhone = (value: string | undefined) => value?.replace(/\D/g, "") ?? "";

export const buildWhatsappUrl = (phone: string | undefined, message: string) => {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

const formatAddress = (address?: Address | null) => {
  if (!address) return null;
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
  return parts || null;
};

type WhatsappCustomerInfo = {
  name?: string | null;
  phone?: string | null;
  address?: Address | null;
};

export const buildWhatsappOrderMessage = (
  order: Order,
  info?: WhatsappCustomerInfo
) => {
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const items = (order.items ?? [])
    .map((item) => `${item.quantity}x ${item.nameSnapshot}`)
    .join(", ");
  const total = formatPrice(order.total);
  const addressText = formatAddress(info?.address);

  let message = `Olá, gostaria de prosseguir com a finalização do pedido e o pagamento.\n\n`;

  message += `*Dados do Cliente*\n`;
  if (info?.name) {
    message += `• Nome: ${info.name}\n`;
  }
  if (info?.phone) {
    message += `• Telefone: ${info.phone}\n`;
  }
  if (addressText) {
    message += `• Endereço de entrega: ${addressText}\n`;
  }

  message += `\n*Informações do Pedido*\n`;
  message += `• Pedido Nº: ${orderNumber}\n`;
  message += `• Valor Total: ${total}\n`;

  if (items) {
    message += `• Itens: ${items}\n`;
  }

  return message;
};
