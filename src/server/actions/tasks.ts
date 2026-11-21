"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { issuesToErrors, parseFormData } from "@/lib/form-data";
import { requireAdmin } from "../auth/guards";
import type { Task } from "../db/schema";
import { getRequestContext } from "../request-context";
import { TaskError, deleteTask, saveTask, setTaskStatus, taskInputSchema, toggleChecklistItem } from "../services/tasks";

export interface TaskFormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

async function actor() {
  const { user } = await requireAdmin({ roles: ["super_admin", "editor"] });
  return { id: user.id, ...(await getRequestContext()) };
}

function refresh(id?: string) {
  revalidatePath("/admin/taches");
  if (id) revalidatePath(`/admin/taches/${id}`);
  revalidatePath("/admin", "layout");
}

export async function saveTaskAction(id: string | null, _state: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await actor();
  const raw = parseFormData(formData, { booleans: [] }) as Record<string, unknown>;
  // Checkboxes of the checklist arrive as "on" strings.
  if (Array.isArray(raw.checklist)) {
    raw.checklist = (raw.checklist as Record<string, unknown>[]).map((item) => ({ ...item, done: item.done === "on" || item.done === "1" || item.done === true }));
  }
  raw.reminderOffsets = formData.getAll("reminderOffsets").map(String);
  raw.reminderChannels = formData.getAll("reminderChannels").map(String);
  const parsed = taskInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "La tâche contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  let taskId: string;
  try {
    taskId = await saveTask(id, parsed.data, user);
  } catch (error) {
    if (error instanceof TaskError) return { ok: false, message: error.message };
    throw error;
  }
  refresh(taskId);
  if (!id) redirect(formData.get("stay") === "1" ? "/admin/taches" : `/admin/taches/${taskId}?enregistre=1`);
  return { ok: true, message: "Tâche enregistrée." };
}

/** Quick add from the list: title and optional due date only. */
export async function quickAddTaskAction(_state: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await actor();
  const parsed = taskInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    status: "todo",
    priority: String(formData.get("priority") ?? "medium"),
    reminderOffsets: formData.get("dueAt") ? ["60"] : [],
    reminderChannels: ["email", "push"],
  });
  if (!parsed.success) return { ok: false, message: issuesToErrors(parsed.error.issues).title ?? "Tâche invalide." };
  await saveTask(null, parsed.data, user);
  refresh();
  return { ok: true, message: "Tâche ajoutée." };
}

export async function setTaskStatusAction(id: string, status: Task["status"]): Promise<void> {
  await setTaskStatus(id, status, await actor());
  refresh(id);
}

export async function toggleChecklistAction(taskId: string, itemId: string): Promise<void> {
  await actor();
  await toggleChecklistItem(taskId, itemId);
  refresh(taskId);
}

export async function deleteTaskAction(id: string): Promise<void> {
  await deleteTask(id, await actor());
  refresh();
  redirect("/admin/taches");
}
