"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  ListResponseSchema,
  StockItemSchema,
  StockMovementSchema,
  type StockItem,
  type StockMovement
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const movementListSchema = ListResponseSchema(StockMovementSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getVariantCostPrice(item: StockItem | null): number | null {
  const variant = item?.variant;
  if (!variant) return null;
  const direct = toNumber(variant.costPrice);
  if (direct !== null) return direct;
  if (!variant.attributes || typeof variant.attributes !== "object" || Array.isArray(variant.attributes)) return null;
  const attrs = variant.attributes as Record<string, unknown>;
  return toNumber(attrs.costPrice ?? attrs.cost ?? attrs.cmv);
}

function getMarginPercent(price: unknown, costPrice: number | null): string {
  const sale = toNumber(price);
  if (sale === null || sale <= 0 || costPrice === null) return "N/A";
  return `${(((sale - costPrice) / sale) * 100).toFixed(1)}%`;
}

function getStockStatus(onHand: number) {
  if (onHand <= 0) return { label: "Ruptura", variant: "warning" as const };
  if (onHand <= 5) return { label: "Em risco", variant: "neutral" as const };
  return { label: "Saudavel", variant: "success" as const };
}

export default function StaffStockDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const stockId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [item, setItem] = useState<StockItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [movementState, setMovementState] = useState<LoadState>({ status: "loading" });

  const [quantity, setQuantity] = useState("");
  const [operation, setOperation] = useState<"add" | "remove">("add");
  const [reason, setReason] = useState("");
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });

  const fetchStockItem = useCallback(async () => {
    if (!stockId) return;
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get(`/staff/inventory/stock-items/${stockId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = StockItemSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do estoque");
      }
      setItem(parsed.data);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [stockId]);

  const fetchMovements = useCallback(async () => {
    if (!stockId) return;
    const token = getAccessToken();
    if (!token) {
      setMovementState({ status: "error", error: "Token ausente" });
      return;
    }

    setMovementState({ status: "loading" });
    try {
      const response = await api.get(`/staff/inventory/stock-items/${stockId}/movements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = movementListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de movimentos");
      }
      setMovements(parsed.data.items);
      setMovementState({ status: "ready" });
    } catch (error) {
      setMovementState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [stockId]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchStockItem();
    fetchMovements();
  }, [auth.status, fetchMovements, fetchStockItem]);

  const handleCreateMovement = async () => {
    if (!stockId) return;
    const token = getAccessToken();
    if (!token) {
      setActionState({ status: "error", error: "Token ausente" });
      return;
    }

    const amount = Number(quantity);
    if (Number.isNaN(amount) || amount <= 0 || !reason.trim()) {
      setActionState({ status: "error", error: "Informe quantidade e motivo" });
      return;
    }
    const deltaValue = operation === "add" ? amount : -amount;

    setActionState({ status: "loading" });
    try {
      await api.post(
        "/staff/inventory/movements",
        { stockItemId: stockId, delta: deltaValue, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuantity("");
      setReason("");
      setActionState({ status: "success" });
      await fetchStockItem();
      await fetchMovements();
    } catch (error) {
      setActionState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const costPrice = getVariantCostPrice(item);
  const margin = getMarginPercent(item?.variant?.price, costPrice);
  const stockStatus = item ? getStockStatus(item.onHand) : null;

  return (
    <StaffShell title="Ajustar estoque" subtitle="Registre entradas, saidas e motivo de movimentacao.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/gestor/estoque" className="text-sm text-primary">
          Voltar para estoque
        </Link>

        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : item ? (
          <div className="mt-4 space-y-6">
            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Resumo do produto</div>
              <div className="mt-2 text-sm text-text">
                <div>Variante: {item.variant?.name ?? item.variantId}</div>
                <div>SKU: {item.variant?.sku ?? "-"}</div>
                <div>Quantidade atual: {item.onHand}</div>
                <div>CMV: {costPrice === null ? "N/A" : formatPrice(costPrice)}</div>
                <div>Margem estimada: {margin}</div>
                <div>Atualizado: {formatDate(item.updatedAt)}</div>
                {stockStatus ? (
                  <div className="mt-2">
                    <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Historico de movimentacoes</div>
                {movementState.status === "loading" ? (
                  <div className="mt-3 space-y-3">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-2/3" />
                  </div>
                ) : movementState.status === "error" ? (
                  <div className="mt-3 text-sm text-amber-600">{movementState.error}</div>
                ) : movements.length ? (
                  <div className="mt-3 space-y-3">
                    {movements.map((movement) => (
                      <div key={movement.id} className="rounded-2xl border border-border bg-surface/80 p-3">
                        <div className="text-sm font-semibold text-text">
                          {movement.delta >= 0 ? "Entrada" : "Saida"}: {Math.abs(movement.delta)} un.
                        </div>
                        <div className="text-xs text-muted">Motivo: {movement.reason}</div>
                        <div className="text-xs text-muted">Data: {formatDate(movement.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted">Nenhum movimento encontrado.</div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Registrar ajuste</div>
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={operation === "add" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOperation("add")}
                    >
                      Entrada
                    </Button>
                    <Button
                      type="button"
                      variant={operation === "remove" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOperation("remove")}
                    >
                      Saida
                    </Button>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Quantidade"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                  <Input
                    placeholder="Motivo (ex: venda, reposicao, ajuste)"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={handleCreateMovement}
                  disabled={actionState.status === "loading"}
                >
                  {actionState.status === "loading" ? "Salvando" : "Salvar ajuste"}
                </Button>
                {actionState.status === "success" ? (
                  <div className="mt-2 text-xs text-success">Ajuste registrado com sucesso.</div>
                ) : null}
                {actionState.status === "error" ? (
                  <div className="mt-2 text-xs text-amber-600">{actionState.error}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </StaffShell>
  );
}
