"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, getApiErrorCode, getApiErrorMessage } from "@/lib/api";
import { LoginResponseSchema } from "@/lib/api-schema";
import { setTokens } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const roleParamRaw = searchParams.get("role")?.toLowerCase();
  const roleParam = roleParamRaw === "gestor" ? "manager" : roleParamRaw;
  const isAdminLogin = roleParam === "admin";
  const isManagerLogin = roleParam === "manager";
  const logoutMessage = searchParams.get("logout") === "1";
  const title = isAdminLogin
    ? "Entrar no painel administrativo"
    : isManagerLogin
      ? "Entrar no painel de gestor"
      : "Entrar";
  const subtitle =
    isAdminLogin || isManagerLogin
      ? "Use suas credenciais reais para acessar o painel."
      : "Autentique-se com sua conta.";
  const showRegister = !isAdminLogin && !isManagerLogin;

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const role = auth.role?.toLowerCase();
    const redirectMap: Record<string, string> = {
      customer: "/",
      manager: "/gestor",
      admin: "/admin"
    };
    if (role) {
      router.replace(redirectMap[role] ?? "/");
    }
  }, [auth.role, auth.status, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setErrorCode(null);

    try {
      const response = await api.post("/auth/login", { email, password });
      const parsed = LoginResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do login");
      }
      setTokens(parsed.data.accessToken, parsed.data.refreshToken);
      const rawRole = parsed.data.user.role?.toLowerCase();
      const role = rawRole === "gestor" ? "manager" : rawRole;
      const redirectMap: Record<string, string> = {
        customer: "/",
        manager: "/gestor",
        admin: "/admin"
      };
      router.replace(redirectMap[role] ?? "/");
    } catch (err) {
      setStatus("error");
      setError(getApiErrorMessage(err));
      setErrorCode(getApiErrorCode(err));
    }
  };

  return (
    <main className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
      <div className="flex items-center gap-3">
        <BrandLogo size={44} />
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AMBEBE</div>
      </div>
      <h1 className="mt-3 font-heading text-2xl text-text">{title}</h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>

      {logoutMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Sessao encerrada com sucesso.
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
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button type="submit" className="w-full" disabled={status === "loading"}>
          {status === "loading" ? "Entrando" : "Entrar"}
        </Button>

        <div className="text-right text-xs text-muted">
          <Link href="/forgot-password" className="text-primary">
            Esqueci minha senha
          </Link>
        </div>

        {status === "error" && error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <div>{error}</div>
            {errorCode === "email_not_verified" ? (
              <div className="mt-2 text-xs">
                <Link href="/verificar-email" className="font-semibold text-primary">
                  Verificar email agora
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className="mt-6 text-center text-sm text-muted">
        <Link href="/" className="text-primary">
          Voltar ao catalogo
        </Link>
        {showRegister ? (
          <>
            <span className="mx-2 text-muted">|</span>
            <Link href="/register" className="text-primary">
              Criar conta
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}

