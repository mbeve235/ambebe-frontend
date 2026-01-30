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
import { ListResponseSchema, SupportMessageSchema, type SupportMessage } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const supportListSchema = ListResponseSchema(SupportMessageSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function AdminSupportPage() {
  const auth = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("unread");
  const [searchEmail, setSearchEmail] = useState("");
  const [actionState, setActionState] = useState<Record<string, LoadState | undefined>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const loadMessages = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (readFilter === "unread") params.isRead = "false";
      if (readFilter === "read") params.isRead = "true";

      const response = await api.get("/admin/support/messages", {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      const parsed = supportListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do suporte");
      }
      setMessages(parsed.data.items);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [auth.status, statusFilter, readFilter]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const visibleMessages = searchEmail
    ? messages.filter((message) =>
        (message.user?.email || "").toLowerCase().includes(searchEmail.toLowerCase().trim())
      )
    : messages;

  const updateMessage = async (id: string, payload: { isRead?: boolean; status?: string }) => {
    const token = getAccessToken();
    if (!token) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [id]: { status: "loading" } }));
    try {
      await api.patch(`/admin/support/messages/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [id]: { status: "ready" } }));
      loadMessages();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const sendReply = async (id: string) => {
    const token = getAccessToken();
    if (!token) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const draft = replyDrafts[id]?.trim() ?? "";
    if (draft.length < 5) {
      setActionState((prev) => ({
        ...prev,
        [id]: { status: "error", error: "A resposta precisa ter pelo menos 5 caracteres." }
      }));
      return;
    }

    setActionState((prev) => ({ ...prev, [id]: { status: "loading" } }));
    try {
      await api.post(
        `/admin/support/messages/${id}/replies`,
        { message: draft },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
      setActionState((prev) => ({ ...prev, [id]: { status: "ready" } }));
      loadMessages();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [id]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  return (
    <AdminShell title="Suporte" subtitle="Mensagens reais enviadas pelos clientes.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">Caixa de entrada</div>
            <div className="text-xs text-muted">
              {readFilter === "unread"
                ? "Mostrando mensagens nao lidas."
                : readFilter === "read"
                  ? "Mostrando mensagens lidas."
                  : "Mostrando todas as mensagens."}
            </div>
          </div>
          <Button variant="outline" onClick={loadMessages}>
            Atualizar
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="OPEN">Aberto</SelectItem>
                <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                <SelectItem value="RESOLVED">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted">Leitura</div>
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">Nao lidas</SelectItem>
                <SelectItem value="read">Lidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted">Buscar por email</div>
            <Input
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder="cliente@email.com"
            />
          </div>
        </div>

        {state.status === "loading" ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {state.error}
          </div>
        ) : visibleMessages.length ? (
          <div className="mt-6 space-y-4">
            {visibleMessages.map((item) => {
              const action = actionState[item.id];
              return (
                <div key={item.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text">{item.subject}</div>
                    <div className="text-xs text-muted">
                      {formatDate(item.createdAt)} | {item.status}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    Cliente: {item.user?.name || "Sem nome"} ({item.user?.email})
                  </div>
                  <div className="mt-2 text-sm text-text">{item.message}</div>

                  {item.replies?.length ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface/80 p-3">
                      <div className="text-xs font-semibold text-text">Respostas enviadas</div>
                      {item.replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border border-border bg-surface/70 p-3">
                          <div className="text-xs text-muted">
                            {reply.author?.name || reply.author?.email || "Equipe"} - {formatDate(reply.createdAt)}
                          </div>
                          <div className="mt-1 text-sm text-text">{reply.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!item.isRead ? (
                      <Button variant="outline" size="sm" onClick={() => updateMessage(item.id, { isRead: true })}>
                        Marcar como lida
                      </Button>
                    ) : null}
                    {item.status !== "RESOLVED" ? (
                      <Button size="sm" onClick={() => updateMessage(item.id, { status: "RESOLVED" })}>
                        Resolver
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    <textarea
                      className="min-h-[120px] w-full rounded-xl border border-border bg-surface/70 px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Responder ao cliente"
                      value={replyDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setReplyDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      onClick={() => sendReply(item.id)}
                      disabled={action?.status === "loading"}
                    >
                      {action?.status === "loading" ? "Enviando" : "Enviar resposta"}
                    </Button>
                    {action?.status === "error" ? (
                      <div className="text-xs text-amber-600">{action.error}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted">Nenhuma mensagem de suporte encontrada.</div>
        )}
      </section>
    </AdminShell>
  );
}
