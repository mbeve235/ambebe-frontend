"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomerShell } from "@/components/customer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { ListResponseSchema, SupportMessageSchema, type SupportMessage } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const supportListSchema = ListResponseSchema(SupportMessageSchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

export default function CustomerSupportPage() {
  const auth = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<LoadState>({ status: "ready" });

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [listState, setListState] = useState<LoadState>({ status: "loading" });

  const loadMessages = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setListState({ status: "error", error: "Token ausente" });
      return;
    }

    setListState({ status: "loading" });
    try {
      const response = await api.get("/account/support/messages", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = supportListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do suporte");
      }
      setMessages(parsed.data.items);
      setListState({ status: "ready" });
    } catch (error) {
      setListState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [auth.status]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();

    if (normalizedSubject.length < 3) {
      setSubmitState({ status: "error", error: "Informe um assunto com pelo menos 3 caracteres." });
      return;
    }

    if (normalizedMessage.length < 10) {
      setSubmitState({ status: "error", error: "Escreva uma mensagem com pelo menos 10 caracteres." });
      return;
    }

    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setSubmitState({ status: "error", error: "Token ausente" });
      return;
    }

    setSubmitState({ status: "loading" });
    try {
      await api.post(
        "/account/support/messages",
        { subject: normalizedSubject, message: normalizedMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubject("");
      setMessage("");
      setSubmitState({ status: "ready" });
      loadMessages();
    } catch (error) {
      setSubmitState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  return (
    <CustomerShell title="Suporte" subtitle="Envie mensagens para o nosso time de suporte.">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Nova mensagem</div>
          <p className="mt-2 text-sm text-muted">Descreva o que aconteceu para receber ajuda mais rapida.</p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <Input
              placeholder="Assunto"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
            />
            <textarea
              className="min-h-[140px] w-full rounded-xl border border-border bg-surface/70 px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Escreva sua mensagem"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
            <Button type="submit" disabled={submitState.status === "loading"}>
              {submitState.status === "loading" ? "Enviando" : "Enviar mensagem"}
            </Button>
            {submitState.status === "error" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                {submitState.error}
              </div>
            ) : null}
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Historico</div>
          <p className="mt-2 text-sm text-muted">Acompanhe suas mensagens recentes.</p>

          {listState.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
          ) : listState.status === "error" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {listState.error}
            </div>
          ) : messages.length ? (
            <div className="mt-4 space-y-4">
              {messages.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <span>{formatDate(item.createdAt)}</span>
                    <span>{item.status}</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-text">{item.subject}</div>
                  <div className="mt-1 text-xs text-muted">{item.message}</div>
                  {item.replies?.length ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-border bg-surface/80 p-3">
                      <div className="text-xs font-semibold text-text">Resposta do suporte</div>
                      {item.replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border border-border bg-surface/70 p-3">
                          <div className="text-xs text-muted">{formatDate(reply.createdAt)}</div>
                          <div className="mt-1 text-sm text-text">{reply.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted">Nenhuma mensagem enviada ainda.</div>
          )}
        </div>
      </section>
    </CustomerShell>
  );
}
