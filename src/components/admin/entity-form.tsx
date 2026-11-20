"use client";

import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/server/actions/content";
import type { FieldErrors } from "./fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Wraps an admin form: pending state, global message and field errors are
 * passed to the render function so every field can show its own error.
 */
export function EntityForm({
  action,
  children,
  submitLabel = "Enregistrer",
}: {
  action: Action;
  children: (errors: FieldErrors) => React.ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const message = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.message) message.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {children(state.errors ?? {})}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <Button type="submit" disabled={pending} className="h-10 px-5">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {submitLabel}
        </Button>
        {state.message && (
          <p
            ref={message}
            tabIndex={-1}
            role="status"
            className={state.ok ? "flex items-center gap-1.5 text-sm text-success" : "text-sm text-destructive"}
          >
            {state.ok && <CheckCircle2 className="size-4" aria-hidden="true" />}
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
