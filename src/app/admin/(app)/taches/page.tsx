import { CalendarDays, ChevronLeft, ChevronRight, Columns3, List, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewButton, PageHeader } from "@/components/admin/page-header";
import { PRIORITY_STYLES } from "@/components/admin/tasks/labels";
import { PushToggle, QuickAddTask, TaskBoard, TaskCheck, type BoardTask } from "@/components/admin/tasks/task-widgets";
import { describeRule } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { quickAddTaskAction, setTaskStatusAction } from "@/server/actions/tasks";
import { requireAdmin } from "@/server/auth/guards";
import { pushConfig } from "@/server/services/push";
import { listOpenTasks, startOfLocalDay, tasksBetween, type TaskRow } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Tâches et agenda" };

const TZ = "Africa/Lubumbashi";
const time = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: TZ });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const monthTitle = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const localKey = (date: Date) => new Date(date.getTime() + 2 * 3600_000).toISOString().slice(0, 10);

const VIEWS = [
  { value: "liste", label: "Liste", icon: List },
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "calendrier", label: "Calendrier", icon: CalendarDays },
] as const;

function dueLabel(task: TaskRow, now: Date): { text: string; overdue: boolean } | null {
  if (!task.dueAt) return null;
  const sameDay = localKey(task.dueAt) === localKey(now);
  return { text: sameDay ? `aujourd'hui ${time.format(task.dueAt)}` : `${dayMonth.format(task.dueAt)} ${time.format(task.dueAt)}`, overdue: task.status !== "done" && task.dueAt < now };
}

function TaskLine({ task, now }: { task: TaskRow; now: Date }) {
  const due = dueLabel(task, now);
  const done = task.checklist.filter((item) => item.done).length;
  return (
    <li className="flex items-start gap-2 px-2 py-2.5">
      <TaskCheck done={task.status === "done"} title={task.title} action={setTaskStatusAction.bind(null, task.id, task.status === "done" ? "todo" : "done")} />
      <div className="min-w-0 flex-1 pt-1">
        <Link href={`/admin/taches/${task.id}`} className={cn("block text-sm font-medium hover:text-accent", task.status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {due && <span className={due.overdue ? "font-medium text-destructive" : ""}>{due.text}</span>}
          {task.projectName && <span className="truncate">{task.clientName ? `${task.clientName} · ` : ""}{task.projectName}</span>}
          {task.recurrenceRule && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" aria-hidden="true" /> {describeRule(task.recurrenceRule)}
            </span>
          )}
          {task.checklist.length > 0 && <span>{done}/{task.checklist.length}</span>}
          {task.status === "blocked" && <span className="text-warning">bloquée</span>}
        </p>
      </div>
      <span className={cn("mt-1.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", PRIORITY_STYLES[task.priority].className)}>{PRIORITY_STYLES[task.priority].label}</span>
    </li>
  );
}

function Group({ title, tasks, now, tone }: { title: string; tasks: TaskRow[]; now: Date; tone?: string }) {
  if (tasks.length === 0) return null;
  return (
    <section className="admin-card p-3">
      <h2 className={cn("px-2 pb-1 pt-1 text-sm font-semibold", tone)}>
        {title} <span className="font-normal text-muted-foreground">({tasks.length})</span>
      </h2>
      <ul className="divide-y">
        {tasks.map((task) => (
          <TaskLine key={task.id} task={task} now={now} />
        ))}
      </ul>
    </section>
  );
}

async function CalendarView({ month, now }: { month: string; now: Date }) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  // Weeks start on Monday.
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - offset * 86_400_000);
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * 86_400_000));
  const from = new Date(gridStart.getTime() - 2 * 3600_000);
  const to = new Date(from.getTime() + 42 * 86_400_000);
  const list = await tasksBetween(from, to);
  const byDay = new Map<string, TaskRow[]>();
  for (const task of list) {
    const key = localKey(task.dueAt!);
    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }
  const shift = (delta: number) => {
    const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
    return date.toISOString().slice(0, 7);
  };
  const today = localKey(now);
  const currentMonth = days.filter((date) => date.getUTCMonth() === monthIndex - 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/admin/taches?vue=calendrier&mois=${shift(-1)}`} className="grid size-10 place-items-center rounded-xl border bg-card hover:bg-surface" aria-label="Mois précédent">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <h2 className="text-lg font-semibold first-letter:uppercase">{monthTitle.format(first)}</h2>
        <Link href={`/admin/taches?vue=calendrier&mois=${shift(1)}`} className="grid size-10 place-items-center rounded-xl border bg-card hover:bg-surface" aria-label="Mois suivant">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Month grid on larger screens. */}
      <div className="admin-card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b bg-surface/60 text-center text-xs font-medium text-muted-foreground">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((name) => (
            <div key={name} className="py-2">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const items = byDay.get(key) ?? [];
            const inMonth = date.getUTCMonth() === monthIndex - 1;
            return (
              <div key={key} className={cn("min-h-28 border-b border-r p-1.5 text-xs", !inMonth && "bg-surface/40 text-muted-foreground")}>
                <span className={cn("inline-grid size-6 place-items-center rounded-full", key === today && "bg-accent font-semibold text-accent-foreground")}>{date.getUTCDate()}</span>
                <ul className="mt-1 space-y-1">
                  {items.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/admin/taches/${task.id}`}
                        className={cn("block truncate rounded px-1.5 py-0.5 hover:opacity-80", task.status === "done" ? "bg-success/10 text-success line-through" : PRIORITY_STYLES[task.priority].className)}
                      >
                        {time.format(task.dueAt!)} {task.title}
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && <li className="px-1.5 text-muted-foreground">+{items.length - 3}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda list on phones. */}
      <ol className="space-y-3 md:hidden">
        {currentMonth
          .filter((date) => (byDay.get(date.toISOString().slice(0, 10)) ?? []).length > 0)
          .map((date) => {
            const key = date.toISOString().slice(0, 10);
            return (
              <li key={key} className="admin-card p-3">
                <p className={cn("px-2 text-sm font-semibold first-letter:uppercase", key === today && "text-accent")}>
                  {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date)}
                </p>
                <ul className="divide-y">
                  {(byDay.get(key) ?? []).map((task) => (
                    <TaskLine key={task.id} task={task} now={now} />
                  ))}
                </ul>
              </li>
            );
          })}
        {list.length === 0 && <li className="admin-card p-6 text-center text-sm text-muted-foreground">Aucune tâche datée ce mois-ci.</li>}
      </ol>
    </div>
  );
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ vue?: string; mois?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const view = VIEWS.some((item) => item.value === query.vue) ? query.vue! : "liste";
  const now = new Date();
  const month = query.mois && /^\d{4}-\d{2}$/.test(query.mois) ? query.mois : localKey(now).slice(0, 7);
  const tasks = view === "calendrier" ? [] : await listOpenTasks();

  const startToday = startOfLocalDay(now);
  const endToday = new Date(startToday.getTime() + 86_400_000);
  const endWeek = new Date(startToday.getTime() + 7 * 86_400_000);
  const open = tasks.filter((task) => task.status !== "done");
  const groups = {
    overdue: open.filter((task) => task.dueAt && task.dueAt < now),
    today: open.filter((task) => task.dueAt && task.dueAt >= now && task.dueAt < endToday),
    week: open.filter((task) => task.dueAt && task.dueAt >= endToday && task.dueAt < endWeek),
    later: open.filter((task) => task.dueAt && task.dueAt >= endWeek),
    none: open.filter((task) => !task.dueAt),
    done: tasks.filter((task) => task.status === "done"),
  };

  const board: BoardTask[] = tasks.map((task) => {
    const due = dueLabel(task, now);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due: due?.text ?? null,
      overdue: due?.overdue ?? false,
      project: task.projectName,
      checklist: task.checklist.length ? `${task.checklist.filter((item) => item.done).length}/${task.checklist.length}` : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Tâches et agenda"
        description={view === "calendrier" ? "Vue mensuelle des échéances." : `${open.length} tâches ouvertes, ${groups.overdue.length} en retard.`}
        actions={
          <>
            <PushToggle publicKey={pushConfig()?.publicKey ?? null} />
            <NewButton href="/admin/taches/nouveau" label="Nouvelle tâche" />
          </>
        }
      />
      <nav aria-label="Vues" className="mb-5 inline-flex rounded-xl border bg-card p-1">
        {VIEWS.map(({ value, label, icon: Icon }) => (
          <Link
            key={value}
            href={value === "liste" ? "/admin/taches" : `/admin/taches?vue=${value}`}
            aria-current={view === value ? "page" : undefined}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm", view === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      {view === "calendrier" ? (
        <CalendarView month={month} now={now} />
      ) : (
        <div className="space-y-4">
          <QuickAddTask action={quickAddTaskAction} />
          {view === "kanban" ? (
            <TaskBoard tasks={board} moveAction={setTaskStatusAction} />
          ) : tasks.length === 0 ? (
            <p className="admin-card p-8 text-center text-sm text-muted-foreground">Aucune tâche. Ajoutez-en une ci-dessus.</p>
          ) : (
            <div className="grid gap-4 *:min-w-0 xl:grid-cols-2">
              <div className="space-y-4">
                <Group title="En retard" tasks={groups.overdue} now={now} tone="text-destructive" />
                <Group title="Aujourd'hui" tasks={groups.today} now={now} tone="text-accent" />
                <Group title="Cette semaine" tasks={groups.week} now={now} />
              </div>
              <div className="space-y-4">
                <Group title="Plus tard" tasks={groups.later} now={now} />
                <Group title="Sans échéance" tasks={groups.none} now={now} />
                <Group title="Terminées (14 derniers jours)" tasks={groups.done} now={now} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
