"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  AdminUserSchema,
  AuditLogSchema,
  CouponSchema,
  IdempotencyKeySchema,
  ListResponseSchema,
  PermissionSchema,
  RoleWithPermissionsSchema,
  SupportMessageSchema,
  type SupportMessage
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const userListSchema = ListResponseSchema(AdminUserSchema);
const roleListSchema = ListResponseSchema(RoleWithPermissionsSchema);
const permissionListSchema = ListResponseSchema(PermissionSchema);
const auditListSchema = ListResponseSchema(AuditLogSchema);
const idempotencyListSchema = ListResponseSchema(IdempotencyKeySchema);
const couponListSchema = ListResponseSchema(CouponSchema);
const supportListSchema = ListResponseSchema(SupportMessageSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type OverviewCounts = {
  users: number;
  roles: number;
  permissions: number;
  audits: number;
  idempotency: number;
  couponsTotal: number;
  couponsActive: number;
  supportUnread: number;
};

export default function AdminOverviewPage() {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      api.get("/admin/users", { headers }),
      api.get("/admin/roles", { headers }),
      api.get("/admin/permissions", { headers }),
      api.get("/admin/audit-logs", { headers }),
      api.get("/admin/idempotency-keys", { headers }),
      api.get("/admin/coupons", { headers }),
      api.get("/admin/support/messages", { headers, params: { isRead: "false", limit: 5 } })
    ])
      .then(([usersRes, rolesRes, permsRes, auditsRes, idempotencyRes, couponsRes, supportRes]) => {
        if (
          usersRes.status !== "fulfilled" ||
          rolesRes.status !== "fulfilled" ||
          permsRes.status !== "fulfilled" ||
          auditsRes.status !== "fulfilled" ||
          idempotencyRes.status !== "fulfilled" ||
          couponsRes.status !== "fulfilled" ||
          supportRes.status !== "fulfilled"
        ) {
          throw new Error("Falha ao carregar dados administrativos");
        }

        const usersParsed = userListSchema.safeParse(usersRes.value.data);
        const rolesParsed = roleListSchema.safeParse(rolesRes.value.data);
        const permsParsed = permissionListSchema.safeParse(permsRes.value.data);
        const auditsParsed = auditListSchema.safeParse(auditsRes.value.data);
        const idempotencyParsed = idempotencyListSchema.safeParse(idempotencyRes.value.data);
        const couponsParsed = couponListSchema.safeParse(couponsRes.value.data);
        const supportParsed = supportListSchema.safeParse(supportRes.value.data);

        if (
          !usersParsed.success ||
          !rolesParsed.success ||
          !permsParsed.success ||
          !auditsParsed.success ||
          !idempotencyParsed.success ||
          !couponsParsed.success ||
          !supportParsed.success
        ) {
          throw new Error("Resposta invalida do painel admin");
        }

        const activeCoupons = couponsParsed.data.items.filter((coupon) => coupon.isActive).length;
        const supportUnread =
          typeof supportParsed.data.total === "number"
            ? supportParsed.data.total
            : supportParsed.data.items.length;

        setCounts({
          users: usersParsed.data.items.length,
          roles: rolesParsed.data.items.length,
          permissions: permsParsed.data.items.length,
          audits: auditsParsed.data.items.length,
          idempotency: idempotencyParsed.data.items.length,
          couponsTotal: couponsParsed.data.items.length,
          couponsActive: activeCoupons,
          supportUnread
        });
        setSupportMessages(supportParsed.data.items);
        setState({ status: "ready" });
      })
      .catch((error) => {
        setState({ status: "error", error: getApiErrorMessage(error) });
      });
  }, [auth.status]);

  return (
    <AdminShell title="Resumo administrativo" subtitle="Visao geral do backend e controles criticos.">
      {state.status === "loading" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`admin-skeleton-${index}`} className="rounded-2xl border border-border bg-surface/70 p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {state.error}
        </div>
      ) : counts ? (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-text">Prioridades do dia</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-soft">
                <div className="text-xs text-muted">Suporte nao lido</div>
                <div className="mt-3 text-2xl font-semibold text-text">{counts.supportUnread}</div>
                <Link href="/admin/suporte" className="mt-3 inline-block text-sm text-primary">
                  Abrir suporte
                </Link>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-soft">
                <div className="text-xs text-muted">Cupons ativos</div>
                <div className="mt-3 text-2xl font-semibold text-text">{counts.couponsActive}</div>
                <Link href="/admin/cupons" className="mt-3 inline-block text-sm text-primary">
                  Ver cupons
                </Link>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-soft">
                <div className="text-xs text-muted">Usuarios</div>
                <div className="mt-3 text-2xl font-semibold text-text">{counts.users}</div>
                <Link href="/admin/usuarios" className="mt-3 inline-block text-sm text-primary">
                  Gerenciar usuarios
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-text">Outros indicadores</div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="text-xs text-muted">Roles</div>
                <div className="mt-2 text-xl font-semibold text-text">{counts.roles}</div>
                <Link href="/admin/roles" className="mt-2 inline-block text-xs text-primary">
                  Gerenciar roles
                </Link>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="text-xs text-muted">Permissoes</div>
                <div className="mt-2 text-xl font-semibold text-text">{counts.permissions}</div>
                <Link href="/admin/permissoes" className="mt-2 inline-block text-xs text-primary">
                  Gerenciar permissoes
                </Link>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="text-xs text-muted">Auditoria</div>
                <div className="mt-2 text-xl font-semibold text-text">{counts.audits}</div>
                <Link href="/admin/auditoria" className="mt-2 inline-block text-xs text-primary">
                  Ver auditoria
                </Link>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="text-xs text-muted">Idempotencia</div>
                <div className="mt-2 text-xl font-semibold text-text">{counts.idempotency}</div>
                <Link href="/admin/idempotencia" className="mt-2 inline-block text-xs text-primary">
                  Ver chaves
                </Link>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
                <div className="text-xs text-muted">Cupons</div>
                <div className="mt-2 text-xl font-semibold text-text">{counts.couponsTotal}</div>
                <Link href="/admin/cupons" className="mt-2 inline-block text-xs text-primary">
                  Gerenciar cupons
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
            <div className="text-sm font-semibold text-text">Ultimas mensagens de suporte</div>
            {supportMessages.length ? (
              <div className="mt-4 space-y-3">
                {supportMessages.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted">
                      <span>{item.user?.name || item.user?.email}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-text">{item.subject}</div>
                    <div className="mt-1 text-xs text-muted">{item.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-muted">Nenhuma mensagem nova.</div>
            )}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
