"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api, getApiErrorMessage } from "@/lib/api";
import { ProfileSchema, type Profile } from "@/lib/api-schema";
import { clearTokens, getAccessToken, getRoleFromToken } from "@/lib/auth";

export type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  user?: Profile;
  role?: string | null;
  error?: string;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "unauthenticated" });
      return;
    }

    try {
      const response = await api.get("/account/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = ProfileSchema.safeParse(response.data);
      if (!parsed.success) {
        setState({ status: "error", error: "Resposta invalida do perfil" });
        return;
      }

      const rawRole = parsed.data.role?.toLowerCase();
      const normalizedRole = rawRole === "gestor" ? "manager" : rawRole;
      const tokenRole = getRoleFromToken(token);
      const allowedRoles = new Set(["admin", "manager", "customer"]);
      const role = normalizedRole && allowedRoles.has(normalizedRole) ? normalizedRole : tokenRole;

      setState({
        status: "authenticated",
        user: parsed.data,
        role
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearTokens();
        setState({ status: "unauthenticated" });
        return;
      }
      setState({ status: "error", error: message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
