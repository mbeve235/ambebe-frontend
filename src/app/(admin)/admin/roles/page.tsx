"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  ListResponseSchema,
  PermissionSchema,
  RoleWithPermissionsSchema,
  type Permission,
  type RoleWithPermissions
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const roleListSchema = ListResponseSchema(RoleWithPermissionsSchema);
const permissionListSchema = ListResponseSchema(PermissionSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

export default function AdminRolesPage() {
  const auth = useAuth();
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [permState, setPermState] = useState<LoadState>({ status: "loading" });

  const [roleName, setRoleName] = useState("");
  const [createState, setCreateState] = useState<ActionState>({ status: "idle" });

  const [actionState, setActionState] = useState<Record<string, ActionState | undefined>>({});
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});
  const [selectedPermission, setSelectedPermission] = useState<Record<string, string>>({});

  const token = getAccessToken();

  const fetchRoles = useCallback(async () => {
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/admin/roles", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = roleListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de roles");
      }
      setRoles(parsed.data.items);
      setRoleNames(
        parsed.data.items.reduce((acc, role) => {
          acc[role.id] = role.name;
          return acc;
        }, {} as Record<string, string>)
      );
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token]);

  const fetchPermissions = useCallback(async () => {
    if (!token) {
      setPermState({ status: "error", error: "Token ausente" });
      return;
    }

    setPermState({ status: "loading" });
    try {
      const response = await api.get("/admin/permissions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = permissionListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de permissoes");
      }
      setPermissions(parsed.data.items);
      setPermState({ status: "ready" });
    } catch (error) {
      setPermState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchRoles();
    fetchPermissions();
  }, [auth.status, fetchPermissions, fetchRoles]);

  const handleCreateRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setCreateState({ status: "error", error: "Token ausente" });
      return;
    }

    setCreateState({ status: "loading" });
    try {
      await api.post(
        "/admin/roles",
        { name: roleName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRoleName("");
      setCreateState({ status: "success" });
      await fetchRoles();
    } catch (error) {
      setCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleRenameRole = async (roleId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const name = roleNames[roleId];
    if (!name) return;

    setActionState((prev) => ({ ...prev, [roleId]: { status: "loading" } }));
    try {
      await api.put(
        `/admin/roles/${roleId}`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionState((prev) => ({ ...prev, [roleId]: { status: "success" } }));
      await fetchRoles();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [roleId]: { status: "loading" } }));
    try {
      await api.delete(`/admin/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [roleId]: { status: "success" } }));
      await fetchRoles();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleAddPermission = async (roleId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const permissionId = selectedPermission[roleId];
    if (!permissionId) return;

    setActionState((prev) => ({ ...prev, [roleId]: { status: "loading" } }));
    try {
      await api.post(`/admin/roles/${roleId}/permissions/${permissionId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [roleId]: { status: "success" } }));
      await fetchRoles();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleRemovePermission = async (roleId: string, permissionId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [roleId]: { status: "loading" } }));
    try {
      await api.delete(`/admin/roles/${roleId}/permissions/${permissionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [roleId]: { status: "success" } }));
      await fetchRoles();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [roleId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  return (
    <AdminShell title="Roles" subtitle="Defina roles e permissoes do sistema.">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Roles cadastradas</div>
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : roles.length ? (
            <div className="mt-4 space-y-4">
              {roles.map((role) => {
                const action = actionState[role.id];
                return (
                  <div key={role.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-text">{role.name}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {role.permissions.length ? (
                            role.permissions.map((rp) => (
                              <Button
                                key={rp.permissionId}
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemovePermission(role.id, rp.permissionId)}
                              >
                                {rp.permission.code}
                              </Button>
                            ))
                          ) : (
                            <span className="text-xs text-muted">Sem permissoes</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={roleNames[role.id] ?? role.name}
                            onChange={(event) =>
                              setRoleNames((prev) => ({ ...prev, [role.id]: event.target.value }))
                            }
                            className="w-40"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRenameRole(role.id)}
                            disabled={action?.status === "loading"}
                          >
                            Renomear
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="min-w-[180px]">
                            {permState.status === "loading" ? (
                              <Skeleton className="h-10 w-full" />
                            ) : permState.status === "error" ? (
                              <div className="text-xs text-amber-600">{permState.error}</div>
                            ) : (
                              <Select
                                value={selectedPermission[role.id]}
                                onValueChange={(value) =>
                                  setSelectedPermission((prev) => ({ ...prev, [role.id]: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Adicionar permissao" />
                                </SelectTrigger>
                                <SelectContent>
                                  {permissions.map((permission) => (
                                    <SelectItem key={permission.id} value={permission.id}>
                                      {permission.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddPermission(role.id)}
                            disabled={action?.status === "loading"}
                          >
                            Adicionar
                          </Button>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                          disabled={action?.status === "loading"}
                        >
                          Remover role
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
            <div className="mt-4 text-sm text-muted">Nenhuma role encontrada.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Criar role</div>
          <form className="mt-4 space-y-3" onSubmit={handleCreateRole}>
            <Input placeholder="Nome da role" value={roleName} onChange={(event) => setRoleName(event.target.value)} required />
            <Button type="submit" disabled={createState.status === "loading"}>
              {createState.status === "loading" ? "Criando" : "Criar role"}
            </Button>
            {createState.status === "success" ? (
              <div className="text-xs text-success">Role criada.</div>
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
