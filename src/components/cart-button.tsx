import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CartIcon = ({ className }: { className?: string }) => (
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
    <path d="M6 6h15l-1.5 9h-12z" />
    <path d="M6 6l-1-3H2" />
    <path d="M9.5 20a1.5 1.5 0 1 0 0-3" />
    <path d="M18.5 20a1.5 1.5 0 1 0 0-3" />
  </svg>
);

type CartButtonProps = {
  count: number | null;
  status: "idle" | "loading" | "ready" | "error" | "unauthenticated";
  error?: string;
  href?: string;
  disabled?: boolean;
};

export function CartButton({ count, status, error, href, disabled }: CartButtonProps) {
  const label = status === "ready" && typeof count === "number" ? String(count) : "--";

  const content = (
    <>
      <CartIcon className="h-4 w-4" />
      <span className="text-sm">Carrinho</span>
      <Badge variant="neutral" className="ml-1">
        {status === "loading" ? "..." : label}
      </Badge>
    </>
  );

  if (href && !disabled) {
    return (
      <Button asChild variant="outline" className="relative h-11 gap-2 rounded-full px-4" title={error}>
        <Link href={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      type="button"
      className="relative h-11 gap-2 rounded-full px-4"
      title={error}
      disabled={disabled}
    >
      {content}
    </Button>
  );
}
