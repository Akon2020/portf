"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReplyState } from "@/server/actions/inbox";

/** Reply editor: plain text with paragraphs, saved templates can be inserted. */
export function ReplyBox({
  action,
  templates,
  recipient,
}: {
  action: (state: ReplyState, formData: FormData) => Promise<ReplyState>;
  templates: { title: string; body: string }[];
  recipient: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // A successful send clears the editor for the next message.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server result
    if (state.ok) setBody("");
  }, [state]);

  return (
    <form action={formAction} className="space-y-3 admin-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="reply-body" className="text-sm font-medium">
          Répondre à <span className="font-mono text-xs text-muted-foreground">{recipient}</span>
        </label>
        {templates.length > 0 && (
          <select
            aria-label="Insérer un modèle"
            defaultValue=""
            onChange={(event) => {
              const template = templates[Number(event.target.value)];
              if (template) {
                setBody((current) => (current.trim() ? `${current}\n\n${template.body}` : template.body));
                area.current?.focus();
              }
              event.target.value = "";
            }}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">Insérer un modèle</option>
            {templates.map((template, index) => (
              <option key={template.title} value={index}>
                {template.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        ref={area}
        id="reply-body"
        name="body"
        rows={8}
        required
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Votre réponse. Une ligne vide sépare les paragraphes, les liens sont rendus cliquables."
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || body.trim().length < 2} className="h-10 px-5">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          Envoyer
        </Button>
        {state.message && (
          <p role="status" className={state.ok ? "flex items-center gap-1.5 text-sm text-success" : "text-sm text-destructive"}>
            {state.ok && <CheckCircle2 className="size-4" aria-hidden="true" />}
            {state.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Envoyée dans le même fil que le message du visiteur, avec citation.</p>
      </div>
    </form>
  );
}
