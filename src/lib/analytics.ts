"use client";

type EventParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: string, params?: EventParams) {
  if (typeof window === "undefined") return;

  const payload = { event: name, ...params };
  const win = window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: string, eventName: string, eventParams?: EventParams) => void;
    posthog?: { capture?: (eventName: string, eventParams?: EventParams) => void };
  };

  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push(payload);
  }

  if (typeof win.gtag === "function") {
    win.gtag("event", name, params);
  }

  if (typeof win.posthog?.capture === "function") {
    win.posthog.capture(name, params);
  }

  window.dispatchEvent(new CustomEvent("ambebe:track", { detail: payload }));
}
