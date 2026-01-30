"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "loading" | "success" | "error";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token"), [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      setStatus("error");
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setError("As senhas nao coincidem.");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setStatus("success");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatus("error");
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <main className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AMBEBE</div>
      <h1 className="mt-3 font-heading text-2xl text-text">Nova senha</h1>
      <p className="mt-2 text-sm text-muted">Defina uma nova senha para sua conta.</p>

      {!token ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          Link invalido ou expirado. Solicite um novo.
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Atualizando" : "Atualizar senha"}
          </Button>

          {status === "success" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              Senha atualizada. Voce ja pode entrar.
            </div>
          ) : null}
          {status === "error" && error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {error}
            </div>
          ) : null}
        </form>
      )}

      <div className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-primary">
          Voltar ao login
        </Link>
      </div>
    </main>
  );
}

