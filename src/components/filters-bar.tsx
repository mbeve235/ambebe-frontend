import { Category } from "@/lib/api-schema";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export type SortOption = "newest" | "price_asc" | "price_desc";

type FiltersBarProps = {
  categories: Category[];
  categoriesStatus: "loading" | "ready" | "error";
  categoriesError?: string;
  selectedCategoryId: string;
  onCategoryChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  total?: number;
  isUpdating?: boolean;
};

export function FiltersBar({
  categories,
  categoriesStatus,
  categoriesError,
  selectedCategoryId,
  onCategoryChange,
  sort,
  onSortChange,
  total,
  isUpdating
}: FiltersBarProps) {
  return (
    <section className="mt-10 rounded-3xl border border-border bg-surface/70 p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-heading text-lg text-text">Filtros</div>
          <div className="text-sm text-muted">Explore categorias e ordene pelos melhores resultados.</div>
        </div>

        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="w-full sm:w-60">
            {categoriesStatus === "loading" ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <Select value={selectedCategoryId} onValueChange={onCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="w-full sm:w-56">
            <Select value={sort} onValueChange={(value) => onSortChange(value as SortOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Mais recentes</SelectItem>
                <SelectItem value="price_asc">Preco crescente</SelectItem>
                <SelectItem value="price_desc">Preco decrescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted">
          {isUpdating ? <Badge variant="neutral">Atualizando</Badge> : null}
          {typeof total === "number" ? <span>Total: {total}</span> : null}
        </div>
      </div>

      {categoriesStatus === "error" && categoriesError ? (
        <div className="mt-3 text-sm text-amber-600">{categoriesError}</div>
      ) : null}
    </section>
  );
}
