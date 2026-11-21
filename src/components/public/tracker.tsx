"use client";

import { useEffect } from "react";

function send(name: string, props: Record<string, string | number | boolean> = {}) {
  const body = JSON.stringify({ name, path: window.location.pathname, props });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/t", new Blob([body], { type: "application/json" }));
  else void fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
}

/**
 * Light audience events, no cookie: clicks on elements marked data-track,
 * outbound links, and engaged time when the page is left.
 */
export function Tracker() {
  useEffect(() => {
    if (navigator.doNotTrack === "1") return;
    let visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    let engaged = 0;

    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("a, button");
      if (!target) return;
      const tracked = target.closest<HTMLElement>("[data-track]");
      if (tracked) {
        send(tracked.dataset.track!, { label: (tracked.dataset.trackLabel ?? tracked.textContent ?? "").trim().slice(0, 80) });
        return;
      }
      if (target instanceof HTMLAnchorElement && target.host && target.host !== window.location.host) {
        const host = target.host.replace(/^www\./, "");
        const name = host === "wa.me" ? "whatsapp_click" : host.includes("calendly") ? "calendly_click" : "outbound_click";
        send(name, { host });
      }
    };
    const flush = () => {
      if (visibleSince) engaged += Date.now() - visibleSince;
      visibleSince = 0;
      if (engaged > 3000) send("engaged_time", { ms: Math.min(engaged, 3_600_000) });
      engaged = 0;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else visibleSince = Date.now();
    };
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);
  return null;
}
