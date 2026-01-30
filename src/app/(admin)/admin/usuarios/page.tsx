"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { AdminUserSchema, ListResponseSchema, RoleWithPermissionsSchema, type AdminUser, type Role } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const userListSchema = ListResponseSchema(AdminUserSchema);
const roleListSchema = ListResponseSchema(RoleWithPermissionsSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

export default function AdminUsersPage() {
  const auth = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [roleState, setRoleState] = useState<LoadState>({ status: "loading" });
  const [createState, setCreateState] = useState<ActionState>({ status: "idle" });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState("");

  const [actionState, setActionState] = useState<Record<string, ActionState | undefined>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});

  const token = useMemo(() => getAccessToken(), [auth.status]);

  const fetchUsers = useCallback(async () => {
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = userListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de usuarios");
      }
      setUsers(parsed.data.items);
      setSelectedRoles(
        parsed.data.items.reduce((acc, user) => {
          acc[user.id] = user.role?.id ?? user.roleId;
          return acc;
        }, {} as Record<string, string>)
      );
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token]);

  const fetchRoles = useCallback(async () => {
    if (!token) {
      setRoleState({ status: "error", error: "Token ausente" });
      return;
    }

    setRoleState({ status: "loading" });
    try {
      const response = await api.get("/admin/roles", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = roleListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de roles");
      }
      setRoles(parsed.data.items.map((role) => ({ id: role.id, name: role.name })));
      if (!roleName && parsed.data.items.length) {
        setRoleName(parsed.data.items[0].name);
      }
      setRoleState({ status: "ready" });
    } catch (error) {
      setRoleState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [roleName, token]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchRoles();
    fetchUsers();
  }, [auth.status, fetchRoles, fetchUsers]);

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setCreateState({ status: "error", error: "Token ausente" });
      return;
    }

    setCreateState({ status: "loading" });
    try {
      await api.post(
        "/admin/users",
        {
          email,
          password,
          name: name || undefined,
          role: roleName || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmail("");
      setPassword("");
      setName("");
      setCreateState({ status: "success" });
      await fetchUsers();
    } catch (error) {
      setCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdateRole = async (userId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [userId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const roleId = selectedRoles[userId];
    if (!roleId) return;

    setActionState((prev) => ({ ...prev, [userId]: { status: "loading" } }));
    try {
      await api.patch(
        `/admin/users/${userId}/role`,
        { roleId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionState((prev) => ({ ...prev, [userId]: { status: "success" } }));
      await fetchUsers();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [userId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!token) {
      setActionState((prev) => ({ ...prev, [userId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const newPassword = passwords[userId];
    if (!newPassword) return;

    setActionState((prev) => ({ ...prev, [userId]: { status: "loading" } }));
    try {
      await api.patch(
        `/admin/users/${userId}/password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPasswords((prev) => ({ ...prev, [userId]: "" }));
      setActionState((prev) => ({ ...prev, [userId]: { status: "success" } }));
    } catch (error) {
      setActionState((prev) => ({ ...prev, [userId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  return (
    <AdminShell title="Usuarios" subtitle="Crie contas e gerencie roles com o backend.">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Lista de usuarios</div>
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : users.length ? (
            <div className="mt-4 space-y-4">
              {users.map((user) => {
                const action = actionState[user.id];
                return (
                  <div key={user.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-text">{user.email}</div>
                        <div className="text-xs text-muted">Nome: {user.name || "Sem nome"}</div>
                        <div className="text-xs text-muted">Role: {user.role?.name ?? user.roleId}</div>
                        <Link href={`/admin/usuarios/${user.id}`} className="text-xs text-primary">
                          Ver detalhes
                        </Link>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="min-w-[160px]">
                            <Select
                              value={selectedRoles[user.id]}
                              onValueChange={(value) =>
                                setSelectedRoles((prev) => ({ ...prev, [user.id]: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateRole(user.id)}
                            disabled={action?.status === "loading"}
                          >
                            Atualizar role
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            type="password"
                            placeholder="Nova senha"
                            value={passwords[user.id] ?? ""}
                            onChange={(event) =>
                              setPasswords((prev) => ({ ...prev, [user.id]: event.target.value }))
                            }
                            className="w-48"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdatePassword(user.id)}
                            disabled={action?.status === "loading"}
                          >
                            Atualizar senha
                          </Button>
                        </div>
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
            <div className="mt-4 text-sm text-muted">Nenhum usuario encontrado.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Criar usuario</div>
          {roleState.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{roleState.error}</div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={handleCreateUser}>
              <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <Input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} />
              <Input type="password" placeholder="Senha" value={password} onChange={(event) => setPassword(event.target.value)} required />

              <Select value={roleName} onValueChange={(value) => setRoleName(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="submit" disabled={createState.status === "loading"}>
                {createState.status === "loading" ? "Criando" : "Criar usuario"}
              </Button>

              {createState.status === "success" ? (
                <div className="text-xs text-success">Usuario criado.</div>
              ) : null}
              {createState.status === "error" ? (
                <div className="text-xs text-amber-600">{createState.error}</div>
              ) : null}
            </form>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
