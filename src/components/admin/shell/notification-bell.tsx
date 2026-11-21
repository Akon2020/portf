"use client";

import { Bell, CalendarCheck, CheckCheck, CreditCard, FileText, Inbox, MessagesSquare, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = {
  message: Inbox,
  portal_message: MessagesSquare,
  quote_request: FileText,
  quote_negotiation: MessagesSquare,
  quote_accepted: FileText,
  quote_declined: FileText,
  payment: CreditCard,
  task_reminder: CalendarCheck,
  security: ShieldAlert,
};

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

function ago(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86_400), "day");
}

/** In-app notifications: unread badge, list in a panel, refreshed every minute and when the tab comes back. */
export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { unread: number; items: Item[] };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Offline: the previous list stays.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch after hydration
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    // Closes the panel after a navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the route change
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !root.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (ids?: string[]) => {
    setItems((current) => current.map((item) => (!ids || ids.includes(item.id) ? { ...item, read: true } : item)));
    setUnread((count) => (ids ? Math.max(0, count - ids.filter((id) => items.some((item) => item.id === id && !item.read)).length) : 0));
    await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) }).catch(() => undefined);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={unread ? `Notifications, ${unread} non lues` : "Notifications"}
        className="relative grid size-10 place-items-center rounded-xl border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-5 text-accent-foreground ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-50 max-h-[min(70vh,560px)] overflow-hidden rounded-2xl border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => void markRead()} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                <CheckCheck className="size-3.5" aria-hidden="true" /> Tout marquer comme lu
              </button>
            )}
          </div>
          <ul className="max-h-[min(60vh,480px)] divide-y overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune notification pour le moment.</li>
            ) : (
              items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                const content = (
                  <span className="flex gap-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", item.read ? "bg-surface text-muted-foreground" : "bg-accent/10 text-accent")}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !item.read && "font-semibold")}>{item.title}</span>
                      {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>}
                      <span className="mt-1 block text-[11px] text-muted-foreground">{ago(item.createdAt)}</span>
                    </span>
                    {!item.read && <span aria-label="Non lue" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                  </span>
                );
                return (
                  <li key={item.id}>
                    {item.url ? (
                      <Link href={item.url} onClick={() => !item.read && void markRead([item.id])} className="block px-4 py-3 hover:bg-surface/60">
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => !item.read && void markRead([item.id])} className="block w-full px-4 py-3 text-left hover:bg-surface/60">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
