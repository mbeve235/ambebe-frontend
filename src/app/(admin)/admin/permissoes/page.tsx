"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { ListResponseSchema, PermissionSchema, type Permission } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const permissionListSchema = ListResponseSchema(PermissionSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

export default function AdminPermissionsPage() {
  const auth = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [createState, setCreateState] = useState<ActionState>({ status: "idle" });

  const [actionState, setActionState] = useState<Record<string, ActionState | undefined>>({});
  const [updates, setUpdates] = useState<Record<string, { code: string; description: string }>>({});

  const token = getAccessToken();

  const fetchPermissions = useCallback(async () => {
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/admin/permissions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = permissionListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de permissoes");
      }
      setPermissions(parsed.data.items);
      setUpdates(
        parsed.data.items.reduce((acc, permission) => {
          acc[permission.id] = {
            code: permission.code,
            description: permission.description ?? ""
          };
          return acc;
        }, {} as Record<string, { code: string; description: string }>)
      );
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchPermissions();
  }, [auth.status, fetchPermissions]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setCreateState({ status: "error", error: "Token ausente" });
      return;
    }

    setCreateState({ status: "loading" });
    try {
      await api.post(
        "/admin/permissions",
        { code, description: description || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCode("");
      setDescription("");
      setCreateState({ status: "success" });
      await fetchPermissions();
    } catch (error) {
      setCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdate = async (permissionId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [permissionId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const update = updates[permissionId];
    if (!update?.code) return;

    setActionState((prev) => ({ ...prev, [permissionId]: { status: "loading" } }));
    try {
      await api.put(
        `/admin/permissions/${permissionId}`,
        { code: update.code, description: update.description || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionState((prev) => ({ ...prev, [permissionId]: { status: "success" } }));
      await fetchPermissions();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [permissionId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleDelete = async (permissionId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [permissionId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [permissionId]: { status: "loading" } }));
    try {
      await api.delete(`/admin/permissions/${permissionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [permissionId]: { status: "success" } }));
      await fetchPermissions();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [permissionId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  return (
    <AdminShell title="Permissoes" subtitle="Controle os codigos de permissao do sistema.">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Permissoes cadastradas</div>
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : permissions.length ? (
            <div className="mt-4 space-y-4">
              {permissions.map((permission) => {
                const action = actionState[permission.id];
                const update = updates[permission.id];
                return (
                  <div key={permission.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={update?.code ?? permission.code}
                        onChange={(event) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [permission.id]: {
                              code: event.target.value,
                              description: update?.description ?? ""
                            }
                          }))
                        }
                      />
                      <Input
                        value={update?.description ?? ""}
                        onChange={(event) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [permission.id]: {
                              code: update?.code ?? permission.code,
                              description: event.target.value
                            }
                          }))
                        }
                        placeholder="Descricao"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdate(permission.id)}
                          disabled={action?.status === "loading"}
                        >
                          Atualizar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(permission.id)}
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
            <div className="mt-4 text-sm text-muted">Nenhuma permissao encontrada.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Criar permissao</div>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <Input placeholder="Codigo" value={code} onChange={(event) => setCode(event.target.value)} required />
            <Input placeholder="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Button type="submit" disabled={createState.status === "loading"}>
              {createState.status === "loading" ? "Criando" : "Criar permissao"}
            </Button>
            {createState.status === "success" ? (
              <div className="text-xs text-success">Permissao criada.</div>
            ) : null}
            {createState.status === "error" ? (
              <div className="text-xs text-amber-600">{createState.error}</div>
            ) : null}
          </form>
        </div>
      </section>
    </AdminShell>
  );
}
