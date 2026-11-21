"use client";

import { Bell, BellOff, CheckCircle2, Circle, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { TaskFormState } from "@/server/actions/tasks";
import type { TaskStatus } from "@/server/db/schema";
import { PRIORITY_STYLES } from "./labels";


export function QuickAddTask({ action }: { action: (state: TaskFormState, formData: FormData) => Promise<TaskFormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [title, setTitle] = useState("");
  return (
    <form
      action={(formData) => {
        formAction(formData);
        setTitle("");
      }}
      className="admin-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
    >
      <label htmlFor="quick-title" className="sr-only">
        Nouvelle tâche
      </label>
      <input
        id="quick-title"
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Ajouter une tâche..."
        maxLength={200}
        className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring"
      />
      <div className="flex gap-2">
        <label htmlFor="quick-due" className="sr-only">
          Échéance
        </label>
        <input id="quick-due" name="dueAt" type="datetime-local" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm sm:w-52 sm:flex-none" />
        <button type="submit" disabled={pending || title.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          <span className="hidden sm:inline">Ajouter</span>
          <span className="sr-only sm:hidden">Ajouter</span>
        </button>
      </div>
      {state.message && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Round checkbox that completes or reopens a task. */
export function TaskCheck({ done, title, action }: { done: boolean; title: string; action: () => Promise<void> }) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(done);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={optimistic ? `Rouvrir : ${title}` : `Terminer : ${title}`}
      disabled={pending}
      onClick={() => {
        setOptimistic((value) => !value);
        start(() => action());
      }}
      className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-success"
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : optimistic ? <CheckCircle2 className="size-5 text-success" aria-hidden="true" /> : <Circle className="size-5" aria-hidden="true" />}
    </button>
  );
}

export interface BoardTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  due: string | null;
  overdue: boolean;
  project: string | null;
  checklist: string | null;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "À faire" },
  { status: "in_progress", label: "En cours" },
  { status: "blocked", label: "Bloquées" },
  { status: "done", label: "Terminées" },
];

/** Kanban: drag and drop on desktop, a status menu on every card for touch and keyboard. */
export function TaskBoard({ tasks, moveAction }: { tasks: BoardTask[]; moveAction: (id: string, status: TaskStatus) => Promise<void> }) {
  const [items, setItems] = useState(tasks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server data refreshed after a move
    setItems(tasks);
  }, [tasks]);

  const move = (id: string, status: TaskStatus) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    start(() => moveAction(id, status));
  };

  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
      {COLUMNS.map((column) => {
        const list = items.filter((item) => item.status === column.status);
        return (
          <section
            key={column.status}
            aria-label={column.label}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(column.status);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData("text/plain");
              if (id) move(id, column.status);
            }}
            className={cn("w-[82vw] max-w-xs shrink-0 snap-start rounded-2xl bg-surface/70 p-3 transition-colors sm:w-72 lg:w-auto lg:max-w-none", over === column.status && "ring-2 ring-accent")}
          >
            <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
              {column.label}
              <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{list.length}</span>
            </h2>
            <ul className="min-h-24 space-y-2">
              {list.map((task) => (
                <li
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", task.id);
                    setDragging(task.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className={cn("admin-card cursor-grab p-3 active:cursor-grabbing", dragging === task.id && "opacity-50")}
                >
                  <Link href={`/admin/taches/${task.id}`} className="block text-sm font-medium hover:text-accent">
                    {task.title}
                  </Link>
                  {task.project && <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.project}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={cn("rounded-full px-2 py-0.5 font-medium", PRIORITY_STYLES[task.priority]?.className)}>{PRIORITY_STYLES[task.priority]?.label}</span>
                    {task.due && <span className={cn("rounded-full bg-card px-2 py-0.5", task.overdue && task.status !== "done" ? "text-destructive" : "text-muted-foreground")}>{task.due}</span>}
                    {task.checklist && <span className="text-muted-foreground">{task.checklist}</span>}
                  </div>
                  <label className="mt-2 block">
                    <span className="sr-only">Déplacer {task.title}</span>
                    <select value={task.status} onChange={(event) => move(task.id, event.target.value as TaskStatus)} className="h-8 w-full rounded-lg border bg-background px-2 text-xs">
                      {COLUMNS.map((option) => (
                        <option key={option.status} value={option.status}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

/** Enables Web Push on this device: service worker, subscription, then saved on the server. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "off" | "on" | "denied">("unknown");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) return "unsupported" as const;
      if (Notification.permission === "denied") return "denied" as const;
      const registration = await navigator.serviceWorker.getRegistration("/admin");
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? ("on" as const) : ("off" as const);
    })()
      .then((value) => !cancelled && setState(value))
      .catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  if (state === "unknown") return null;
  if (state === "unsupported") {
    return <p className="text-xs text-muted-foreground">{publicKey ? "Notifications non prises en charge par ce navigateur." : "Notifications : clés VAPID à configurer sur le serveur."}</p>;
  }

  const enable = () =>
    start(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) });
        const response = await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Erreur");
        setState("on");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Activation impossible.");
      }
    });

  const disable = () =>
    start(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/admin");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/admin/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState("off");
    });

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || state === "denied"}
        onClick={state === "on" ? disable : enable}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-sm hover:bg-surface disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : state === "on" ? <BellOff className="size-4" aria-hidden="true" /> : <Bell className="size-4" aria-hidden="true" />}
        {state === "on" ? "Couper les notifications" : state === "denied" ? "Notifications bloquées" : "Activer les notifications"}
      </button>
      {message && (
        <span role="alert" className="text-xs text-destructive">
          {message}
        </span>
      )}
    </span>
  );
}
