"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api, getApiErrorMessage } from "@/lib/api";
import { ProfileSchema, type Profile } from "@/lib/api-schema";
import { clearTokens, getAccessToken, getRefreshToken, getRoleFromToken, setTokens } from "@/lib/auth";

export type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  user?: Profile;
  role?: string | null;
  error?: string;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const fetchProfile = useCallback(async (token: string) => {
    const response = await api.get("/account/profile", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const parsed = ProfileSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new Error("Resposta invalida do perfil");
    }
    return parsed.data;
  }, []);

  const refreshSession = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const response = await api.post("/auth/refresh", { refreshToken });
    const accessToken = response.data?.accessToken;
    const nextRefreshToken = response.data?.refreshToken;
    if (typeof accessToken !== "string" || typeof nextRefreshToken !== "string") {
      throw new Error("Resposta invalida do refresh");
    }
    setTokens(accessToken, nextRefreshToken);
    return accessToken;
  }, []);

  const setAuthenticatedState = useCallback((profile: Profile, token: string) => {
    const rawRole = profile.role?.toLowerCase();
    const normalizedRole = rawRole === "gestor" ? "manager" : rawRole;
    const tokenRole = getRoleFromToken(token);
    const allowedRoles = new Set(["admin", "manager", "customer"]);
    const role = normalizedRole && allowedRoles.has(normalizedRole) ? normalizedRole : tokenRole;

    setState({
      status: "authenticated",
      user: profile,
      role
    });
  }, []);

  const refresh = useCallback(async () => {
    let token = getAccessToken();

    try {
      if (!token) {
        token = await refreshSession();
        if (!token) {
          setState({ status: "unauthenticated" });
          return;
        }
      }

      try {
        const profile = await fetchProfile(token);
        setAuthenticatedState(profile, token);
        return;
      } catch (error) {
        if (!(axios.isAxiosError(error) && error.response?.status === 401)) {
          throw error;
        }
      }

      const renewedToken = await refreshSession();
      if (!renewedToken) {
        clearTokens();
        setState({ status: "unauthenticated" });
        return;
      }

      const profile = await fetchProfile(renewedToken);
      setAuthenticatedState(profile, renewedToken);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (axios.isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 401)) {
        clearTokens();
        setState({ status: "unauthenticated" });
        return;
      }
      setState({ status: "error", error: message });
    }
  }, [fetchProfile, refreshSession, setAuthenticatedState]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
