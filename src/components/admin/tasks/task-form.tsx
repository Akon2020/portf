"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { RECURRENCE_PRESETS } from "@/lib/recurrence";
import type { TaskFormState } from "@/server/actions/tasks";
import type { Task } from "@/server/db/schema";
import { EntityForm } from "../entity-form";
import { Field, SelectField, TextAreaField, TextField } from "../fields";

type Action = (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;

export const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "blocked", label: "Bloquée" },
  { value: "done", label: "Terminée" },
];

export const TASK_PRIORITY_OPTIONS = [
  { value: "low", label: "Basse" },
  { value: "medium", label: "Normale" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

const REMINDERS = [
  { value: 0, label: "À l'heure prévue" },
  { value: 15, label: "15 min avant" },
  { value: 60, label: "1 h avant" },
  { value: 180, label: "3 h avant" },
  { value: 1440, label: "1 jour avant" },
  { value: 2880, label: "2 jours avant" },
  { value: 10080, label: "1 semaine avant" },
];

const inputClass = "h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function TaskForm({
  action,
  task,
  dueAtInput,
  projects,
  pushAvailable,
  defaultProjectId,
}: {
  action: Action;
  task?: Task | null;
  dueAtInput: string;
  projects: { id: string; label: string }[];
  pushAvailable: boolean;
  defaultProjectId?: string;
}) {
  const [checklist, setChecklist] = useState(() => (task?.checklist.length ? task.checklist : []).map((item) => ({ ...item })));
  const recurrence = task?.recurrenceRule ?? "";
  const presetKnown = RECURRENCE_PRESETS.some((preset) => preset.value === recurrence);
  const offsets = new Set(task ? task.reminderOffsets : [60]);
  const channels = new Set(task ? task.reminderChannels : ["email", "push"]);

  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <section className="space-y-4 admin-card p-5 sm:p-6">
            <TextField name="title" label="Titre" required defaultValue={task?.title} errors={errors} />
            <TextAreaField name="description" label="Description" rows={3} defaultValue={task?.description} errors={errors} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField name="status" label="Statut" options={TASK_STATUS_OPTIONS} defaultValue={task?.status ?? "todo"} errors={errors} />
              <SelectField name="priority" label="Priorité" options={TASK_PRIORITY_OPTIONS} defaultValue={task?.priority ?? "medium"} errors={errors} />
              <Field label="Échéance" htmlFor="dueAt" error={errors.dueAt} hint="Heure de Bukavu">
                <input id="dueAt" name="dueAt" type="datetime-local" defaultValue={dueAtInput} className={inputClass} />
              </Field>
              <TextField name="estimateMinutes" label="Durée estimée (min)" type="number" defaultValue={task?.estimateMinutes} errors={errors} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Projet client (facultatif)" htmlFor="clientProjectId" error={errors.clientProjectId}>
                <select id="clientProjectId" name="clientProjectId" defaultValue={task?.clientProjectId ?? defaultProjectId ?? ""} className={inputClass}>
                  <option value="">Aucun</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.label}
                    </option>
                  ))}
                </select>
              </Field>
              <TextField name="labels" label="Étiquettes" defaultValue={task?.labels.join(", ")} errors={errors} hint="Séparées par des virgules" />
            </div>
          </section>

          <section className="space-y-4 admin-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Récurrence et rappels</h2>
            <Field label="Répéter" htmlFor="recurrenceRule" error={errors.recurrenceRule} hint="La prochaine occurrence est créée quand la tâche est terminée.">
              <select id="recurrenceRule" name="recurrenceRule" defaultValue={recurrence} className={inputClass}>
                {RECURRENCE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
                {!presetKnown && <option value={recurrence}>{recurrence}</option>}
              </select>
            </Field>
            <fieldset>
              <legend className="text-sm font-medium">Rappels</legend>
              <p className="text-xs text-muted-foreground">Envoyés au passage du cron qui suit (précision de 5 à 15 minutes).</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {REMINDERS.map((option) => (
                  <label key={option.value} className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                    <input type="checkbox" name="reminderOffsets" value={option.value} defaultChecked={offsets.has(option.value)} className="size-4 accent-[var(--accent)]" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">Canaux</legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" name="reminderChannels" value="email" defaultChecked={channels.has("email")} className="size-4 accent-[var(--accent)]" />
                  E-mail
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" name="reminderChannels" value="push" defaultChecked={channels.has("push")} className="size-4 accent-[var(--accent)]" />
                  Notification {pushAvailable ? "" : "(clés VAPID à configurer)"}
                </label>
              </div>
            </fieldset>
          </section>

          <section className="space-y-3 admin-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Sous-tâches</h2>
            <ul className="space-y-2">
              {checklist.map((item, index) => (
                <li key={item.id || `new-${index}`} className="flex items-center gap-2">
                  <input type="hidden" name={`checklist[${index}].id`} value={item.id} />
                  <input
                    type="checkbox"
                    name={`checklist[${index}].done`}
                    aria-label={`Sous-tâche ${index + 1} terminée`}
                    defaultChecked={item.done}
                    className="size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <input
                    name={`checklist[${index}].label`}
                    aria-label={`Sous-tâche ${index + 1}`}
                    value={item.label}
                    onChange={(event) => setChecklist((current) => current.map((row, position) => (position === index ? { ...row, label: event.target.value } : row)))}
                    maxLength={300}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setChecklist((current) => current.filter((_, position) => position !== index))}
                    aria-label={`Retirer la sous-tâche ${index + 1}`}
                    className="grid size-10 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setChecklist((current) => [...current, { id: "", label: "", done: false }])}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface"
            >
              <Plus className="size-3.5" aria-hidden="true" /> Ajouter une sous-tâche
            </button>
          </section>
        </>
      )}
    </EntityForm>
  );
}
