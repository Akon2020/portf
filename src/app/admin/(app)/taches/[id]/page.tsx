import { and, asc, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { TaskForm } from "@/components/admin/tasks/task-form";
import { ConfirmButton } from "@/components/admin/ui";
import { describeRule } from "@/lib/recurrence";
import { deleteTaskAction, saveTaskAction } from "@/server/actions/tasks";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { clientProjects, clients } from "@/server/db/schema";
import { pushConfig } from "@/server/services/push";
import { getTask, toLocalInput } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Tâche" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
const REMINDER_STATUS = { pending: "prévu", sent: "envoyé", cancelled: "annulé", failed: "échec" } as const;

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enregistre?: string; projet?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { enregistre, projet } = await searchParams;
  const isNew = id === "nouveau";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = isNew ? null : await getTask(id);
  if (!isNew && !detail) notFound();
  const projects = await getDb()
    .select({ id: clientProjects.id, name: clientProjects.name, client: clients.name })
    .from(clientProjects)
    .innerJoin(clients, eq(clients.id, clientProjects.clientId))
    .where(and(isNull(clientProjects.deletedAt), isNull(clients.deletedAt)))
    .orderBy(asc(clients.name), asc(clientProjects.name));
  const task = detail?.task ?? null;
  const defaultProjectId = isNew && projet && projects.some((project) => project.id === projet) ? projet : undefined;

  return (
    <>
      <PageHeader
        title={task ? task.title : "Nouvelle tâche"}
        back={{ href: "/admin/taches", label: "Tâches" }}
        description={enregistre ? "Tâche créée." : task?.recurrenceRule ? `Répétée ${describeRule(task.recurrenceRule)}` : undefined}
        actions={task && <ConfirmButton action={deleteTaskAction.bind(null, task.id)} confirmText="Supprimer cette tâche et ses rappels ?" label="Supprimer" />}
      />
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
        <TaskForm
          action={saveTaskAction.bind(null, task?.id ?? null)}
          task={task}
          defaultProjectId={defaultProjectId}
          dueAtInput={toLocalInput(task?.dueAt)}
          projects={projects.map((project) => ({ id: project.id, label: `${project.client} : ${project.name}` }))}
          pushAvailable={Boolean(pushConfig())}
        />
        {detail && detail.reminders.length > 0 && (
          <aside className="admin-card h-fit p-5">
            <h2 className="text-base font-semibold">Rappels</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {detail.reminders.map((reminder) => (
                <li key={reminder.id} className="flex justify-between gap-3">
                  <span>{dateTime.format(reminder.remindAt)}</span>
                  <span className="text-muted-foreground">{REMINDER_STATUS[reminder.status]}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </>
  );
}
