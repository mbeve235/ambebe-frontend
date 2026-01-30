"use client";

import { RoleGuard } from "@/components/role-guard";
import { useAuth } from "@/hooks/use-auth";

const roleLabels: Record<string, string> = {
  customer: "Cliente",
  manager: "Gestor",
  admin: "Admin"
};

type RoleAreaProps = {
  title: string;
  subtitle: string;
  allowedRoles: string[];
};

export function RoleArea({ title, subtitle, allowedRoles }: RoleAreaProps) {
  const auth = useAuth();
  const roleLabel = auth.role ? roleLabels[auth.role] ?? auth.role : "Usuario";

  return (
    <RoleGuard auth={auth} allowedRoles={allowedRoles}>
      <main className="mx-auto mt-10 w-full max-w-4xl rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{roleLabel}</div>
        <h1 className="mt-3 font-heading text-3xl text-text">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>

        <div className="mt-6 rounded-2xl border border-border bg-surface/70 p-4">
          <div className="text-xs text-muted">Conta atual</div>
          <div className="mt-2 text-sm text-text">{auth.user?.name || auth.user?.email}</div>
          <div className="text-xs text-muted">{auth.user?.email}</div>
        </div>
      </main>
    </RoleGuard>
  );
}
