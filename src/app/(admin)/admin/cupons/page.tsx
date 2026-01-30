"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { CouponSchema, ListResponseSchema, type Coupon } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const couponListSchema = ListResponseSchema(CouponSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };
type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

type CouponForm = {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minSubtotal: string;
  maxRedemptions: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  description: "",
  type: "PERCENT",
  value: "",
  minSubtotal: "",
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
  isActive: true
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
};

const toIsoString = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

export default function AdminCouponsPage() {
  const auth = useAuth();
  const token = getAccessToken();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [actionState, setActionState] = useState<Record<string, ActionState | undefined>>({});
  const [formState, setFormState] = useState<ActionState>({ status: "idle" });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const fetchCoupons = useCallback(async () => {
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }
    setState({ status: "loading" });
    try {
      const response = await api.get("/admin/coupons", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = couponListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de cupons");
      }
      setCoupons(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchCoupons();
  }, [auth.status, fetchCoupons]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormState({ status: "idle" });
    setFormError(null);
  };

  const setFormFromCoupon = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      type: coupon.type === "FIXED" ? "FIXED" : "PERCENT",
      value: String(coupon.value),
      minSubtotal: coupon.minSubtotal ? String(coupon.minSubtotal) : "",
      maxRedemptions: coupon.maxRedemptions ? String(coupon.maxRedemptions) : "",
      startsAt: toDateTimeLocal(coupon.startsAt),
      endsAt: toDateTimeLocal(coupon.endsAt),
      isActive: coupon.isActive
    });
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      isActive: form.isActive
    };

    if (form.description.trim()) payload.description = form.description.trim();
    if (form.minSubtotal.trim()) payload.minSubtotal = Number(form.minSubtotal);
    if (form.maxRedemptions.trim()) payload.maxRedemptions = Number(form.maxRedemptions);
    const startsAt = toIsoString(form.startsAt);
    const endsAt = toIsoString(form.endsAt);
    if (startsAt) payload.startsAt = startsAt;
    if (endsAt) payload.endsAt = endsAt;
    return payload;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setFormState({ status: "error", error: "Token ausente" });
      return;
    }

    setFormState({ status: "loading" });
    setFormError(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/admin/coupons/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await api.post("/admin/coupons", payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setFormState({ status: "success" });
      resetForm();
      await fetchCoupons();
    } catch (error) {
      const message = getApiErrorMessage(error);
      setFormState({ status: "error", error: message });
      setFormError(message);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [coupon.id]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [coupon.id]: { status: "loading" } }));
    try {
      await api.put(
        `/admin/coupons/${coupon.id}`,
        { isActive: !coupon.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionState((prev) => ({ ...prev, [coupon.id]: { status: "success" } }));
      await fetchCoupons();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [coupon.id]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [couponId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [couponId]: { status: "loading" } }));
    try {
      await api.delete(`/admin/coupons/${couponId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [couponId]: { status: "success" } }));
      await fetchCoupons();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [couponId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const couponStats = useMemo(() => {
    const active = coupons.filter((item) => item.isActive).length;
    return { total: coupons.length, active };
  }, [coupons]);

  return (
    <AdminShell title="Cupons" subtitle="Crie e gerencie cupons de desconto usados no checkout.">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-text">Cupons cadastrados</div>
            <div className="text-xs text-muted">
              {couponStats.active} ativos / {couponStats.total} total
            </div>
          </div>

          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : coupons.length ? (
            <div className="mt-4 space-y-4">
              {coupons.map((coupon) => {
                const action = actionState[coupon.id];
                const valueLabel =
                  coupon.type === "PERCENT"
                    ? `${Number(coupon.value)}%`
                    : formatPrice(coupon.value);
                return (
                  <div key={coupon.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-text">{coupon.code}</div>
                          <span className="text-xs text-muted">{coupon.isActive ? "Ativo" : "Inativo"}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {coupon.description || "Sem descricao"}
                        </div>
                        <div className="mt-2 text-xs text-muted">
                          Valor: {valueLabel} • Usos: {coupon.redemptionCount}
                          {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
                        </div>
                        <div className="text-xs text-muted">
                          Minimo: {coupon.minSubtotal ? formatPrice(coupon.minSubtotal) : "Sem minimo"}
                        </div>
                        <div className="text-xs text-muted">
                          Inicio: {coupon.startsAt ? formatDate(coupon.startsAt) : "Livre"} • Fim:{" "}
                          {coupon.endsAt ? formatDate(coupon.endsAt) : "Livre"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setFormFromCoupon(coupon)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(coupon)}
                          disabled={action?.status === "loading"}
                        >
                          {coupon.isActive ? "Desativar" : "Ativar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(coupon.id)}
                          disabled={action?.status === "loading"}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                    {action?.status === "error" ? (
                      <div className="mt-2 text-xs text-amber-600">{action.error}</div>
                    ) : action?.status === "success" ? (
                      <div className="mt-2 text-xs text-success">Atualizado.</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhum cupom encontrado.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">{editingId ? "Editar cupom" : "Novo cupom"}</div>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <Input
              placeholder="Codigo (ex: AMB10)"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              required
            />
            <Input
              placeholder="Descricao"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
            <Select
              value={form.type}
              onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as CouponForm["type"] }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de desconto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Percentual</SelectItem>
                <SelectItem value="FIXED">Valor fixo</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={form.type === "PERCENT" ? "Valor (%)" : "Valor (MZN)"}
              type="number"
              min={1}
              max={form.type === "PERCENT" ? 100 : undefined}
              step="0.01"
              value={form.value}
              onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
              required
            />
            <Input
              placeholder="Subtotal minimo (opcional)"
              type="number"
              min={0}
              step="0.01"
              value={form.minSubtotal}
              onChange={(event) => setForm((prev) => ({ ...prev, minSubtotal: event.target.value }))}
            />
            <Input
              placeholder="Maximo de usos (opcional)"
              type="number"
              min={1}
              step="1"
              value={form.maxRedemptions}
              onChange={(event) => setForm((prev) => ({ ...prev, maxRedemptions: event.target.value }))}
            />
            <Input
              type="datetime-local"
              placeholder="Inicio (opcional)"
              value={form.startsAt}
              onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
            />
            <Input
              type="datetime-local"
              placeholder="Fim (opcional)"
              value={form.endsAt}
              onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
            />

            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Cupom ativo
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={formState.status === "loading"}>
                {formState.status === "loading" ? "Salvando" : editingId ? "Salvar alteracoes" : "Criar cupom"}
              </Button>
              {editingId ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>

            {formState.status === "success" ? (
              <div className="text-xs text-success">Cupom salvo.</div>
            ) : null}
            {formError ? <div className="text-xs text-amber-600">{formError}</div> : null}
          </form>
        </div>
      </section>
    </AdminShell>
  );
}
