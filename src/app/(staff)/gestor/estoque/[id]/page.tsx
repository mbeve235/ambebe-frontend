"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
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
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const movementListSchema = ListResponseSchema(StockMovementSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

export default function StaffStockDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const stockId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [item, setItem] = useState<StockItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [movementState, setMovementState] = useState<LoadState>({ status: "loading" });

  const [delta, setDelta] = useState("");
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

    const deltaValue = Number(delta);
    if (Number.isNaN(deltaValue) || !reason.trim()) {
      setActionState({ status: "error", error: "Delta ou motivo invalido" });
      return;
    }

    setActionState({ status: "loading" });
    try {
      await api.post(
        "/staff/inventory/movements",
        { stockItemId: stockId, delta: deltaValue, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDelta("");
      setReason("");
      setActionState({ status: "success" });
      await fetchStockItem();
      await fetchMovements();
    } catch (error) {
      setActionState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  return (
    <StaffShell title="Detalhe do estoque" subtitle="Movimentos e saldo por variante.">
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
              <div className="text-sm font-semibold text-text">Resumo</div>
              <div className="mt-2 text-sm text-text">
                <div>Variante: {item.variant?.name ?? item.variantId}</div>
                <div>SKU: {item.variant?.sku ?? "-"}</div>
                <div>Em estoque: {item.onHand}</div>
                <div>Atualizado: {formatDate(item.updatedAt)}</div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Movimentos</div>
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
                        <div className="text-sm font-semibold text-text">Delta: {movement.delta}</div>
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
                <div className="text-sm font-semibold text-text">Registrar movimento</div>
                <div className="mt-3 space-y-2">
                  <Input
                    type="number"
                    placeholder="Delta (positivo ou negativo)"
                    value={delta}
                    onChange={(event) => setDelta(event.target.value)}
                  />
                  <Input
                    placeholder="Motivo"
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
                  {actionState.status === "loading" ? "Salvando" : "Registrar"}
                </Button>
                {actionState.status === "success" ? (
                  <div className="mt-2 text-xs text-success">Movimento registrado.</div>
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
