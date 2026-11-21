"use server";

import { z } from "@/lib/zod";
import { RATE_LIMITS, consumeRateLimit } from "../auth/rate-limit";
import { getRequestContext } from "../request-context";
import { checkSubmission } from "../services/anti-spam";
import { TOPICS, receiveInbound, type Locale } from "../services/inbox";

export interface PublicFormState {
  ok?: boolean;
  /** Error codes, translated by the client in the visitor's language. */
  errors?: Record<string, string>;
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "required").max(120, "tooLong"),
  email: z.string().trim().max(254, "tooLong").pipe(z.email("email")),
  phone: z
    .string()
    .trim()
    .max(30, "tooLong")
    .refine((value) => value === "" || /^[+\d][\d\s().-]{6,}$/.test(value), "phone")
    .transform((value) => value || null),
  topic: z.enum(TOPICS, "required"),
  message: z.string().trim().min(50, "min50").max(5000, "tooLong"),
  consent: z.literal("1", "consent"),
});

function toErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return errors;
}

export async function submitContactAction(locale: Locale, _state: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const meta = await getRequestContext();
  const parsed = contactSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    topic: formData.get("topic") ?? "",
    message: formData.get("message") ?? "",
    consent: formData.get("consent") ?? "",
  });
  if (!parsed.success) return { ok: false, errors: toErrors(parsed.error.issues) };

  const verdict = await checkSubmission(formData, meta.ip);
  if (!verdict.ok) {
    if (verdict.reason === "turnstile") return { ok: false, errors: { form: "turnstile" } };
    if (verdict.reason === "too_slow") return { ok: false, errors: { form: "expired" } };
    // Bots get the same answer as everyone, nothing is stored.
    console.warn(`[contact] submission dropped (${verdict.reason}) from ${meta.ip}`);
    if (verdict.reason === "honeypot") {
      const { recordAppSignal } = await import("@/monitoring/record");
      await recordAppSignal({ ip: meta.ip, method: "POST", path: "/contact", query: "", userAgent: meta.userAgent }, { ruleId: "form.honeypot-field", category: "honeypot", severity: "medium", score: 20 });
    }
    return { ok: true };
  }

  const limit = await consumeRateLimit(`contact:ip:${meta.ip}`, RATE_LIMITS.contactForm);
  if (!limit.allowed) {
    const { recordAppSignal } = await import("@/monitoring/record");
    await recordAppSignal({ ip: meta.ip, method: "POST", path: "/contact", query: "", userAgent: meta.userAgent }, { ruleId: "form.contact-flood", category: "rate_abuse", severity: "medium", score: 15 });
    return { ok: false, errors: { form: "rateLimited" } };
  }

  await receiveInbound({ ...parsed.data, locale: locale === "en" ? "en" : "fr" }, meta);
  const [{ trackInBackground }, { visitorHash }] = await Promise.all([import("@/monitoring/transport"), import("@/monitoring/record")]);
  trackInBackground({ type: "analytics_event", data: { name: "contact_submit", props: { topic: parsed.data.topic }, path: "/contact", visitorHash: visitorHash(meta.ip, meta.userAgent ?? "") } });
  return { ok: true };
}
