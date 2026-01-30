export function formatPrice(value: string | number) {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return String(value);
  }
  return new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN"
  }).format(amount);
}

export function resolveAssetUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return url;
  const root = base.replace(/\/v1\/?$/, "");
  const prefix = url.startsWith("/") ? "" : "/";
  return `${root}${prefix}${url}`;
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("pt-MZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
