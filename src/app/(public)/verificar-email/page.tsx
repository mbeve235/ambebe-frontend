"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import { LoginResponseSchema } from "@/lib/api-schema";
import { setTokens } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "loading" | "success" | "error";

function VerifyEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [autoStatus, setAutoStatus] = useState<Status>(token ? "loading" : "idle");
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoSuccess, setAutoSuccess] = useState<string | null>(null);

  const [formStatus, setFormStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [resendStatus, setResendStatus] = useState<Status>("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;

    const verify = async () => {
      setAutoStatus("loading");
      setAutoError(null);
      setAutoSuccess(null);
      try {
        const response = await api.post("/auth/verify-email", { token });
        const parsed = LoginResponseSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida da verificacao");
        }
        setTokens(parsed.data.accessToken, parsed.data.refreshToken);
        if (!active) return;
        setAutoStatus("success");
        setAutoSuccess("Email verificado. Entrando automaticamente...");
        const rawRole = parsed.data.user.role?.toLowerCase();
        const role = rawRole === "gestor" ? "manager" : rawRole;
        const redirectMap: Record<string, string> = {
          customer: "/",
          manager: "/gestor",
          admin: "/admin"
        };
        router.replace(redirectMap[role] ?? "/");
      } catch (err) {
        if (!active) return;
        setAutoStatus("error");
        setAutoError(getApiErrorMessage(err));
      }
    };

    verify();

    return () => {
      active = false;
    };
  }, [router, token]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus("loading");
    setFormError(null);
    setFormSuccess(null);

    try {
      const response = await api.post("/auth/verify-email", { email, code });
      const parsed = LoginResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida da verificacao");
      }
      setTokens(parsed.data.accessToken, parsed.data.refreshToken);
      setFormStatus("success");
      setFormSuccess("Email verificado. Entrando automaticamente...");
      const rawRole = parsed.data.user.role?.toLowerCase();
      const role = rawRole === "gestor" ? "manager" : rawRole;
      const redirectMap: Record<string, string> = {
        customer: "/",
        manager: "/gestor",
        admin: "/admin"
      };
      router.replace(redirectMap[role] ?? "/");
    } catch (err) {
      setFormStatus("error");
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setResendStatus("error");
      setResendError("Informe o email para receber um novo codigo.");
      setResendSuccess(null);
      return;
    }

    setResendStatus("loading");
    setResendError(null);
    setResendSuccess(null);

    try {
      const response = await api.post("/auth/resend-verification", { email });
      const message =
        typeof response.data?.message === "string"
          ? response.data.message
          : "Se o email existir, reenviamos um novo codigo de confirmacao.";
      setResendStatus("success");
      setResendSuccess(message);
      setResendCooldown(120);
    } catch (err) {
      setResendStatus("error");
      setResendError(getApiErrorMessage(err));
    }
  };

  const cooldownLabel = resendCooldown
    ? `${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, "0")}`
    : null;

  return (
    <main className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AMBEBE</div>
      <h1 className="mt-3 font-heading text-2xl text-text">Verificar email</h1>
      <p className="mt-2 text-sm text-muted">
        Confirme sua conta pelo link recebido ou informe o codigo enviado por email.
      </p>

      {token ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface/70 px-4 py-3 text-sm text-text">
          {autoStatus === "loading" ? "Verificando link..." : null}
          {autoStatus === "success" && autoSuccess ? autoSuccess : null}
          {autoStatus === "error" && autoError ? autoError : null}
        </div>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          placeholder="Codigo de verificacao"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />

        <Button type="submit" className="w-full" disabled={formStatus === "loading"}>
          {formStatus === "loading" ? "Verificando" : "Confirmar email"}
        </Button>

        {formStatus === "success" && formSuccess ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            {formSuccess}
          </div>
        ) : null}
        {formStatus === "error" && formError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {formError}
          </div>
        ) : null}
      </form>

      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface/60 px-4 py-4 text-sm text-text">
        <p className="text-muted">Nao recebeu o codigo? Podemos enviar novamente.</p>
        <Button
          type="button"
          className="w-full"
          variant="outline"
          onClick={handleResend}
          disabled={resendStatus === "loading" || resendCooldown > 0}
        >
          {resendStatus === "loading"
            ? "Enviando..."
            : resendCooldown > 0 && cooldownLabel
              ? `Aguarde ${cooldownLabel}`
              : "Reenviar codigo"}
        </Button>
        {resendStatus === "success" && resendSuccess ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            {resendSuccess}
          </div>
        ) : null}
        {resendStatus === "error" && resendError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {resendError}
          </div>
        ) : null}
      </div>

      <div className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-primary">
          Ir para login
        </Link>
        <span className="mx-2 text-muted">|</span>
        <Link href="/" className="text-primary">
          Voltar ao catalogo
        </Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-border bg-surface/80 p-8 shadow-soft" />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

