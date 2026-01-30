"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const roleListSchema = ListResponseSchema(RoleWithPermissionsSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

export default function AdminUserDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const userId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [user, setUser] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [roleState, setRoleState] = useState<LoadState>({ status: "loading" });

  const [selectedRole, setSelectedRole] = useState<string>("");
  const [password, setPassword] = useState("");
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });

  const token = getAccessToken();

  const fetchUser = useCallback(async () => {
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get(`/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = AdminUserSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do usuario");
      }
      setUser(parsed.data);
      setSelectedRole(parsed.data.role?.id ?? parsed.data.roleId);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token, userId]);

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
      setRoleState({ status: "ready" });
    } catch (error) {
      setRoleState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (!userId) return;
    fetchUser();
    fetchRoles();
  }, [auth.status, fetchRoles, fetchUser, userId]);

  const handleUpdateRole = async () => {
    if (!token || !userId) return;
    if (!selectedRole) return;

    setActionState({ status: "loading" });
    try {
      await api.patch(
        `/admin/users/${userId}/role`,
        { roleId: selectedRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionState({ status: "success" });
      await fetchUser();
    } catch (error) {
      setActionState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdatePassword = async () => {
    if (!token || !userId || !password) return;
    setActionState({ status: "loading" });
    try {
      await api.patch(
        `/admin/users/${userId}/password`,
        { newPassword: password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPassword("");
      setActionState({ status: "success" });
    } catch (error) {
      setActionState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  return (
    <AdminShell title="Detalhe do usuario" subtitle="Edite role e senha do usuario.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/admin/usuarios" className="text-sm text-primary">
          Voltar para usuarios
        </Link>

        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : user ? (
          <div className="mt-4 space-y-6">
            <div className="space-y-1 text-sm text-text">
              <div>ID: {user.id}</div>
              <div>Email: {user.email}</div>
              <div>Nome: {user.name || "Sem nome"}</div>
              <div>Role: {user.role?.name ?? user.roleId}</div>
              <div>Criado em: {formatDate(user.createdAt)}</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Atualizar role</div>
                {roleState.status === "loading" ? (
                  <Skeleton className="mt-3 h-10 w-full" />
                ) : roleState.status === "error" ? (
                  <div className="mt-3 text-sm text-amber-600">{roleState.error}</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value)}>
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
                    <Button type="button" variant="outline" onClick={handleUpdateRole}>
                      Atualizar role
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Atualizar senha</div>
                <div className="mt-3 space-y-3">
                  <Input
                    type="password"
                    placeholder="Nova senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <Button type="button" variant="ghost" onClick={handleUpdatePassword}>
                    Atualizar senha
                  </Button>
                </div>
              </div>
            </div>

            {actionState.status === "success" ? (
              <div className="text-xs text-success">Atualizado com sucesso.</div>
            ) : null}
            {actionState.status === "error" ? (
              <div className="text-xs text-amber-600">{actionState.error}</div>
            ) : null}
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
