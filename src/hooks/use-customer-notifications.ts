"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HeaderNotificationItem, HeaderNotifications } from "@/components/header";
import { api } from "@/lib/api";
import {
  ListResponseSchema,
  NotificationPreferencesSchema,
  ProductSchema,
  SupportMessageSchema,
  type NotificationPreferences,
  type SupportMessage
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatDate } from "@/lib/format";

const productListSchema = ListResponseSchema(ProductSchema);
const supportMessageListSchema = ListResponseSchema(SupportMessageSchema);

type UseCustomerNotificationsParams = {
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  userId?: string | null;
  role?: string | null;
};

export function useCustomerNotifications({ status, userId, role }: UseCustomerNotificationsParams) {
  const enabled = status === "authenticated" && role === "customer";
  const [notifications, setNotifications] = useState<HeaderNotifications>({
    status: "idle",
    count: 0,
    items: []
  });
  const preferencesRef = useRef<NotificationPreferences | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!enabled) return null;
    const token = getAccessToken();
    if (!token) {
      return null;
    }
    try {
      const response = await api.get("/account/notification-preferences", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = NotificationPreferencesSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de notificacoes");
      }
      preferencesRef.current = parsed.data;
      return parsed.data;
    } catch {
      return null;
    }
  }, [enabled]);

  const loadNotifications = useCallback(async () => {
    if (!enabled) return;
    const prefs = preferencesRef.current ?? (await fetchPreferences());
    const disableProductNotifications = prefs?.newProductNotificationsEnabled === false;
    const lastProductSeen = prefs?.lastProductSeenAt ? new Date(prefs.lastProductSeenAt).getTime() : 0;
    const lastSupportSeen = prefs?.lastSupportSeenAt ? new Date(prefs.lastSupportSeenAt).getTime() : 0;

    setNotifications((prev) => ({ ...prev, status: "loading", error: undefined }));

    const token = getAccessToken();
    const results = await Promise.allSettled([
      disableProductNotifications
        ? Promise.resolve(null)
        : api.get("/store/products", { params: { sort: "newest", limit: 5 } }),
      token
        ? api.get("/account/support/messages", {
            headers: { Authorization: `Bearer ${token}` },
            params: { page: 1, limit: 5 }
          })
        : Promise.reject(new Error("Token ausente"))
    ]);

    const items: HeaderNotificationItem[] = [];
    let hadError = false;

    const productResult = results[0];
    if (!disableProductNotifications) {
      if (productResult.status === "fulfilled" && productResult.value) {
        const parsed = productListSchema.safeParse(productResult.value.data);
        if (parsed.success) {
          parsed.data.items
            .filter((product) => new Date(product.createdAt).getTime() > lastProductSeen)
            .forEach((product) => {
              items.push({
                id: `product-${product.id}`,
                kind: "product",
                refId: product.id,
                title: product.name,
                description: `Novo produto adicionado em ${formatDate(product.createdAt)}`,
                href: `/produtos/${product.slug}`,
                tag: "Produto",
                createdAt: product.createdAt
              });
            });
        } else {
          hadError = true;
        }
      } else {
        hadError = true;
      }
    }

    const supportResult = results[1];
    if (supportResult.status === "fulfilled") {
      const parsed = supportMessageListSchema.safeParse(supportResult.value.data);
      if (parsed.success) {
        parsed.data.items.forEach((message: SupportMessage) => {
          const latestReply = [...(message.replies ?? [])]
            .filter((reply) => reply.authorId && reply.authorId !== userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          if (latestReply && new Date(latestReply.createdAt).getTime() > lastSupportSeen) {
            items.push({
              id: `support-${message.id}`,
              kind: "support",
              refId: message.id,
              title: `Suporte: ${message.subject}`,
              description: latestReply.message.slice(0, 80),
              href: "/cliente/suporte",
              tag: "Suporte",
              createdAt: latestReply.createdAt
            });
          }
        });
      } else {
        hadError = true;
      }
    } else {
      hadError = true;
    }

    const sorted = items.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    if (!sorted.length && hadError) {
      setNotifications({ status: "error", count: 0, items: [], error: "Falha ao carregar notificacoes." });
      return;
    }

    setNotifications({
      status: "ready",
      count: sorted.length,
      items: sorted.slice(0, 5)
    });
  }, [enabled, fetchPreferences, userId]);

  const handleNotificationClick = useCallback((item: HeaderNotificationItem) => {
    const token = getAccessToken();
    if (!token || !item.createdAt) return;
    api
      .post(
        "/account/notifications/read",
        { kind: item.kind ?? "product", seenAt: item.createdAt },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((response) => {
        const parsed = NotificationPreferencesSchema.safeParse(response.data);
        if (parsed.success) {
          preferencesRef.current = parsed.data;
        }
      })
      .catch(() => undefined);

    setNotifications((prev) => {
      const nextItems = prev.items.filter((entry) => entry.id !== item.id);
      const nextCount = Math.max(0, prev.count - 1);
      return { ...prev, items: nextItems, count: nextCount };
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNotifications({ status: "idle", count: 0, items: [] });
      return;
    }
    fetchPreferences().then(() => {
      loadNotifications();
    });
    const interval = window.setInterval(loadNotifications, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    };
    const handlePreference = () => {
      fetchPreferences().then(() => {
        loadNotifications();
      });
    };
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("ambebe-notification-preference-changed", handlePreference);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("ambebe-notification-preference-changed", handlePreference);
    };
  }, [enabled, fetchPreferences, loadNotifications]);

  const notificationsPayload = useMemo(
    () => ({ ...notifications, onItemClick: handleNotificationClick }),
    [notifications, handleNotificationClick]
  );

  return enabled ? notificationsPayload : undefined;
}
