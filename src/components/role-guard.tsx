"use client";

import { ReactNode, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuthState } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

type RoleGuardProps = {
  auth: AuthState;
  allowedRoles: string[];
  children: ReactNode;
};

const loginTargets: Record<string, string> = {
  admin: "/login?role=admin",
  manager: "/login?role=gestor",
  customer: "/login"
};

const homeTargets: Record<string, string> = {
  admin: "/admin",
  manager: "/gestor",
  customer: "/"
};

const getLoginTarget = (allowedRoles: string[]) => {
  if (allowedRoles.includes("admin")) return loginTargets.admin;
  if (allowedRoles.includes("manager")) return loginTargets.manager;
  return loginTargets.customer;
};

export function RoleGuard({ auth, allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = auth.role ?? "";
  const hasAccess = auth.status === "authenticated" && auth.user && allowedRoles.includes(role);
  const loginTarget = useMemo(() => {
    const baseTarget = getLoginTarget(allowedRoles);
    if (!pathname) return baseTarget;

    const query = searchParams?.toString();
    const returnTo = `${pathname}${query ? `?${query}` : ""}`;
    const separator = baseTarget.includes("?") ? "&" : "?";
    return `${baseTarget}${separator}returnTo=${encodeURIComponent(returnTo)}`;
  }, [allowedRoles, pathname, searchParams]);

  useEffect(() => {
    if (auth.status === "loading") return;
    if (hasAccess) return;

    if (auth.status !== "authenticated" || !auth.user) {
      router.replace(loginTarget);
      return;
    }

    router.replace(homeTargets[role] ?? "/");
  }, [auth.status, auth.user, hasAccess, loginTarget, role, router]);

  if (auth.status === "loading") {
    return (
      <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-border bg-surface/70 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-4 w-80" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-border bg-surface/70 p-6 text-sm text-muted">
        Redirecionando...
      </div>
    );
  }

  return <>{children}</>;
}
