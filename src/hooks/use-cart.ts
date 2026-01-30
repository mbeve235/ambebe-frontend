"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api, getApiErrorMessage } from "@/lib/api";
import { CartSchema } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";

type CartStatus = "idle" | "loading" | "ready" | "error" | "unauthenticated";

type CartState = {
  status: CartStatus;
  count: number | null;
  error?: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export function useCartCount(authStatus: AuthStatus, role?: string | null) {
  const [state, setState] = useState<CartState>({ status: "idle", count: null });

  const refresh = useCallback(async () => {
    if (role && role !== "customer") {
      setState({ status: "unauthenticated", count: null });
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setState({ status: "unauthenticated", count: null });
      return;
    }

    setState((prev) => ({ status: "loading", count: prev.count ?? null }));
    try {
      const response = await api.get("/account/cart", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = CartSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do carrinho");
      }
      const count = parsed.data.items.reduce((sum, item) => sum + item.quantity, 0);
      setState({ status: "ready", count });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setState({ status: "unauthenticated", count: null });
        return;
      }
      setState({ status: "error", count: null, error: getApiErrorMessage(error) });
    }
  }, [role]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      refresh();
      return;
    }

    if (authStatus === "unauthenticated") {
      setState({ status: "unauthenticated", count: null });
    }
  }, [authStatus, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = () => {
      refresh();
    };
    window.addEventListener("ambebe-cart-updated", handle);
    return () => window.removeEventListener("ambebe-cart-updated", handle);
  }, [refresh]);

  return { ...state, refresh };
}
