"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

type Status = "idle" | "loading" | "success" | "error";

export default function RegisterPage() {
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const role = auth.role?.toLowerCase();
    const redirectMap: Record<string, string> = {
      customer: "/",
      manager: "/gestor",
      admin: "/admin"
    };
    router.replace(redirectMap[role] ?? "/");
  }, [auth.role, auth.status, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      await api.post("/auth/register/customer", {
        name: name || undefined,
        email,
        password
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <main className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-border bg-surface/80 p-8 shadow-soft">
      <div className="flex items-center gap-3">
        <BrandLogo size={44} />
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AMBEBE</div>
      </div>
      <h1 className="mt-3 font-heading text-2xl text-text">Criar conta</h1>
      <p className="mt-2 text-sm text-muted">Registre-se para acessar carrinho e pedidos.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          placeholder="Nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Senha (min 8 caracteres)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button type="submit" className="w-full" disabled={status === "loading"}>
          {status === "loading" ? "Criando" : "Criar conta"}
        </Button>

        {status === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            Conta criada. Enviamos um link e um codigo para ativar sua conta.
            <div className="mt-2">
              <Link href="/verificar-email" className="font-semibold text-primary">
                Verificar email
              </Link>
            </div>
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
          Ja tenho conta
        </Link>
        <span className="mx-2 text-muted">|</span>
        <Link href="/" className="text-primary">
          Voltar ao catalogo
        </Link>
      </div>
    </main>
  );
}

