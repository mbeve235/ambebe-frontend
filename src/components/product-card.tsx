import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/api-schema";
import { formatPrice, resolveAssetUrl } from "@/lib/format";

export type AddState = {
  status: "idle" | "loading" | "success" | "error";
  error?: string;
};

type ProductCardProps = {
  product: Product;
  onAddToCart: (product: Product) => void;
  addState?: AddState;
};

export function ProductCard({ product, onAddToCart, addState }: ProductCardProps) {
  const imageUrl = resolveAssetUrl(product.images[0]?.url ?? "");
  const isActive = product.status === "ACTIVE";
  const availabilityLabel = isActive ? "Disponivel" : "Indisponivel";
  const availabilityVariant = isActive ? "success" : "warning";

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface/80 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
      <Link href={`/produtos/${product.slug}`} className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-border/40 p-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted">Sem imagem</div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/produtos/${product.slug}`} className="font-heading text-lg text-text">
              {product.name}
            </Link>
            <p className="mt-1 text-sm text-muted">
              {product.description ? product.description.slice(0, 110) : "Sem descricao"}
            </p>
          </div>
          <Badge variant={availabilityVariant}>{availabilityLabel}</Badge>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <div className="text-xl font-semibold text-text">{formatPrice(product.basePrice)}</div>
          <Button
            onClick={() => onAddToCart(product)}
            disabled={!isActive || addState?.status === "loading"}
          >
            {addState?.status === "loading" ? "Adicionando" : "Adicionar ao carrinho"}
          </Button>
          {addState?.status === "success" ? (
            <span className="text-xs text-success">
              Item adicionado.{" "}
              <Link href="/cliente/carrinho" className="underline">
                Ver carrinho
              </Link>
            </span>
          ) : null}
          {addState?.status === "error" ? (
            <span className="text-xs text-amber-600">{addState.error ?? "Falha ao adicionar"}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
