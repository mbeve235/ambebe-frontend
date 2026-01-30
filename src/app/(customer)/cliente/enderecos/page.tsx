"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomerShell } from "@/components/customer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { AddressSchema, ListResponseSchema, type Address } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const addressListSchema = ListResponseSchema(AddressSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "error" | "success"; error?: string };

export default function CustomerAddressesPage() {
  const auth = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [actionState, setActionState] = useState<Record<string, ActionState | undefined>>({});
  const [createState, setCreateState] = useState<ActionState>({ status: "idle" });

  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const fetchAddresses = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/account/addresses", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = addressListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de enderecos");
      }
      setAddresses(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchAddresses();
  }, [auth.status, fetchAddresses]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setCreateState({ status: "error", error: "Token ausente" });
      return;
    }

    setCreateState({ status: "loading" });
    try {
      await api.post(
        "/account/addresses",
        {
          name,
          line1,
          line2: line2 || undefined,
          city,
          state: stateName,
          postalCode,
          country,
          phone: phone || undefined,
          isDefault
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setName("");
      setLine1("");
      setLine2("");
      setCity("");
      setStateName("");
      setPostalCode("");
      setCountry("");
      setPhone("");
      setIsDefault(false);
      setCreateState({ status: "success" });
      await fetchAddresses();
    } catch (error) {
      setCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleSetDefault = async (id: string) => {
    const token = getAccessToken();
    if (!token) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [id]: { status: "loading" } }));
    try {
      await api.patch(`/account/addresses/${id}/default`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [id]: { status: "success" } }));
      await fetchAddresses();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleDelete = async (id: string) => {
    const token = getAccessToken();
    if (!token) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [id]: { status: "loading" } }));
    try {
      await api.delete(`/account/addresses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [id]: { status: "success" } }));
      await fetchAddresses();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  return (
    <CustomerShell title="Enderecos" subtitle="Cadastre e atualize seus enderecos reais.">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Seus enderecos</div>
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : addresses.length ? (
            <div className="mt-4 space-y-4">
              {addresses.map((address) => {
                const action = actionState[address.id];
                return (
                  <div key={address.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-text">{address.name}</div>
                        <div className="text-xs text-muted">
                          {address.line1} {address.line2 ? `, ${address.line2}` : ""}
                        </div>
                        <div className="text-xs text-muted">
                          {address.city}, {address.state} {address.postalCode} - {address.country}
                        </div>
                        {address.phone ? <div className="text-xs text-muted">{address.phone}</div> : null}
                        {address.isDefault ? (
                          <div className="mt-2 text-xs text-success">Endereco padrao</div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetDefault(address.id)}
                          disabled={action?.status === "loading"}
                        >
                          Definir padrao
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(address.id)}
                          disabled={action?.status === "loading"}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                    {action?.status === "error" ? (
                      <div className="mt-2 text-xs text-amber-600">{action.error}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhum endereco cadastrado.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Novo endereco</div>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <Input placeholder="Nome do endereco" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input placeholder="Endereco linha 1" value={line1} onChange={(event) => setLine1(event.target.value)} required />
            <Input placeholder="Endereco linha 2" value={line2} onChange={(event) => setLine2(event.target.value)} />
            <Input placeholder="Cidade" value={city} onChange={(event) => setCity(event.target.value)} required />
            <Input placeholder="Provincia" value={stateName} onChange={(event) => setStateName(event.target.value)} required />
            <Input placeholder="Codigo postal" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} required />
            <Input placeholder="Pais (2 letras)" value={country} onChange={(event) => setCountry(event.target.value)} required />
            <Input placeholder="Telefone" value={phone} onChange={(event) => setPhone(event.target.value)} />

            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
              />
              Definir como padrao
            </label>

            <Button type="submit" disabled={createState.status === "loading"}>
              {createState.status === "loading" ? "Salvando" : "Adicionar endereco"}
            </Button>

            {createState.status === "success" ? (
              <div className="text-xs text-success">Endereco criado.</div>
            ) : null}
            {createState.status === "error" ? (
              <div className="text-xs text-amber-600">{createState.error}</div>
            ) : null}
          </form>
        </div>
      </section>
    </CustomerShell>
  );
}
