"use client";

import { useEffect, useState } from "react";
import { CustomerShell } from "@/components/customer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { NotificationPreferencesSchema, ProfileSchema, type Profile } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { notifyNotificationPreferenceChanged } from "@/lib/notification-preferences";
import { useAuth } from "@/hooks/use-auth";

export default function CustomerProfilePage() {
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [disableProductNotifications, setDisableProductNotifications] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) {
      setStatus("error");
      setError("Token ausente");
      return;
    }

    setStatus("loading");
    api
      .get("/account/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        const parsed = ProfileSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida do perfil");
        }
        setProfile(parsed.data);
        setName(parsed.data.name ?? "");
        setStatus("ready");
      })
      .catch((err) => {
        setStatus("error");
        setError(getApiErrorMessage(err));
      });
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const token = getAccessToken();
    if (!token) return;
    setNotificationStatus("loading");
    api
      .get("/account/notification-preferences", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        const parsed = NotificationPreferencesSchema.safeParse(response.data);
        if (!parsed.success) {
          throw new Error("Resposta invalida de notificacoes");
        }
        setDisableProductNotifications(!parsed.data.newProductNotificationsEnabled);
        setNotificationStatus("ready");
      })
      .catch((err) => {
        setNotificationStatus("error");
        setNotificationError(getApiErrorMessage(err));
      });
  }, []);

  const handleUpdateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setUpdateStatus("error");
      setUpdateError("Token ausente");
      return;
    }

    setUpdateStatus("loading");
    setUpdateError(null);

    try {
      const response = await api.put(
        "/account/profile",
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const parsed = ProfileSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do perfil");
      }
      setProfile(parsed.data);
      setUpdateStatus("success");
    } catch (err) {
      setUpdateStatus("error");
      setUpdateError(getApiErrorMessage(err));
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setPasswordStatus("error");
      setPasswordError("Token ausente");
      return;
    }

    setPasswordStatus("loading");
    setPasswordError(null);

    try {
      await api.patch(
        "/account/password",
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus("success");
    } catch (err) {
      setPasswordStatus("error");
      setPasswordError(getApiErrorMessage(err));
    }
  };

  return (
    <CustomerShell title="Perfil" subtitle="Gerencie seus dados pessoais e senha.">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Dados pessoais</div>
          {status === "loading" ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{error}</div>
          ) : profile ? (
            <form className="mt-4 space-y-4" onSubmit={handleUpdateProfile}>
              <div className="text-xs text-muted">Email</div>
              <div className="text-sm text-text">{profile.email}</div>

              <div>
                <div className="text-xs text-muted">Nome</div>
                <Input value={name} onChange={(event) => setName(event.target.value)} required />
              </div>

              <Button type="submit" disabled={updateStatus === "loading"}>
                {updateStatus === "loading" ? "Salvando" : "Salvar"}
              </Button>

              {updateStatus === "success" ? (
                <div className="text-xs text-success">Perfil atualizado.</div>
              ) : null}
              {updateStatus === "error" ? (
                <div className="text-xs text-amber-600">{updateError}</div>
              ) : null}
            </form>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
            <div className="text-sm font-semibold text-text">Notificacoes</div>
            <div className="mt-4 flex items-center justify-between gap-4 text-sm text-text">
              <div>
                <div className="text-sm font-semibold text-text">Novos produtos</div>
                <div className="text-xs text-muted">Desative se nao quiser avisos de novos produtos.</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={disableProductNotifications}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setDisableProductNotifications(next);
                    const token = getAccessToken();
                    if (!token) {
                      setNotificationStatus("error");
                      setNotificationError("Token ausente");
                      return;
                    }
                    setNotificationStatus("loading");
                    api
                      .patch(
                        "/account/notification-preferences",
                        { newProductNotificationsEnabled: !next },
                        { headers: { Authorization: `Bearer ${token}` } }
                      )
                      .then((response) => {
                        const parsed = NotificationPreferencesSchema.safeParse(response.data);
                        if (!parsed.success) {
                          throw new Error("Resposta invalida de notificacoes");
                        }
                        setNotificationStatus("ready");
                        notifyNotificationPreferenceChanged();
                      })
                      .catch((err) => {
                        setNotificationStatus("error");
                        setNotificationError(getApiErrorMessage(err));
                      });
                  }}
                />
                Desativar
              </label>
            </div>
            {notificationStatus === "error" ? (
              <div className="mt-2 text-xs text-amber-600">{notificationError}</div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
            <div className="text-sm font-semibold text-text">Alterar senha</div>
            <form className="mt-4 space-y-4" onSubmit={handleUpdatePassword}>
              <Input
                type="password"
                placeholder="Senha atual"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />

              <Button type="submit" disabled={passwordStatus === "loading"}>
                {passwordStatus === "loading" ? "Atualizando" : "Atualizar senha"}
              </Button>

              {passwordStatus === "success" ? (
                <div className="text-xs text-success">Senha atualizada.</div>
              ) : null}
              {passwordStatus === "error" ? (
                <div className="text-xs text-amber-600">{passwordError}</div>
              ) : null}
            </form>
          </div>
        </div>
      </section>
    </CustomerShell>
  );
}
