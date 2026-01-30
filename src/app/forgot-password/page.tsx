"use client";

import { useState } from "react";
import Link from "next/link";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "loading" | "success" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      await api.post("/auth/forgot-password", { email });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <main className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AMBEBE</div>
      <h1 className="mt-3 font-heading text-2xl text-text">Recuperar senha</h1>
      <p className="mt-2 text-sm text-muted">Informe seu email para receber o link de redefinicao.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <Button type="submit" className="w-full" disabled={status === "loading"}>
          {status === "loading" ? "Enviando" : "Enviar link"}
        </Button>

        {status === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            Se o email existir, enviamos um link de recuperacao.
          </div>
        ) : null}
        {status === "error" && error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {error}
          </div>
        ) : null}
      </form>

      <div className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-primary">
          Voltar ao login
        </Link>
      </div>
    </main>
  );
}

