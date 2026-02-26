import type { Product } from "@/lib/api-schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard, type AddState } from "@/components/product-card";

type ProductGridProps = {
  products: Product[];
  isLoading: boolean;
  error?: string;
  noResultsMessage?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  addStates: Record<string, AddState | undefined>;
  onAddToCart: (product: Product) => void;
};

export function ProductGrid({
  products,
  isLoading,
  error,
  noResultsMessage,
  hasActiveFilters,
  onClearFilters,
  addStates,
  onAddToCart
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`skeleton-${index}`} className="space-y-4 rounded-3xl border border-border bg-surface/70 p-4">
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{error}</div>;
  }

  if (!products.length) {
    return (
      <div className="mt-8 rounded-2xl border border-border bg-surface/70 p-6 text-sm text-muted">
        <div>{noResultsMessage ?? "Nenhum produto encontrado."}</div>
        {hasActiveFilters && onClearFilters ? (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
          addState={addStates[product.id]}
        />
      ))}
    </div>
  );
}
