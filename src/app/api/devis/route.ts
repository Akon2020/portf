import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { RATE_LIMITS, consumeRateLimit } from "@/server/auth/rate-limit";
import { isSameOrigin } from "@/server/http/origin";
import { checkSubmission } from "@/server/services/anti-spam";
import { quoteRequestSchema, submitQuoteRequest } from "@/server/services/quote-requests";
import { AttachmentError, storeAttachments } from "@/server/storage/private";

const MAX_BODY = 52 * 1024 * 1024;

function errorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return errors;
}

/** Public quote request, multipart because of optional attachments. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ errors: { form: "expired" } }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return NextResponse.json({ errors: { attachments: "fileSize" } }, { status: 413 });
  }
  const ip = getClientIp(request.headers);
  const meta = { ip, userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ errors: { form: "expired" } }, { status: 400 });
  }
  const locale = form.get("locale") === "en" ? "en" : "fr";

  const parsed = quoteRequestSchema.safeParse({
    projectType: form.get("projectType") ?? "",
    services: form.getAll("services").map(String),
    description: form.get("description") ?? "",
    features: form.getAll("features").map(String),
    featuresOther: form.get("featuresOther") ?? "",
    hasDesign: form.get("hasDesign") ?? "",
    referenceLinks: form.get("referenceLinks") ?? "",
    budgetRange: form.get("budgetRange") ?? "",
    currency: form.get("currency") ?? "USD",
    deadline: form.get("deadline") ?? "",
    name: form.get("name") ?? "",
    email: form.get("email") ?? "",
    phone: form.get("phone") ?? "",
    company: form.get("company") ?? "",
    preferredContact: form.get("preferredContact") ?? "",
    consent: form.get("consent") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ errors: errorsFrom(parsed.error.issues) }, { status: 422 });

  const verdict = await checkSubmission(form, ip);
  if (!verdict.ok) {
    if (verdict.reason === "turnstile") return NextResponse.json({ errors: { form: "turnstile" } }, { status: 422 });
    if (verdict.reason === "too_slow") return NextResponse.json({ errors: { form: "expired" } }, { status: 422 });
    console.warn(`[devis] submission dropped (${verdict.reason}) from ${ip}`);
    return NextResponse.json({ ok: true });
  }

  const limit = await consumeRateLimit(`quote:ip:${ip}`, RATE_LIMITS.contactForm);
  if (!limit.allowed) return NextResponse.json({ errors: { form: "rateLimited" } }, { status: 429 });

  let attachments;
  try {
    attachments = await storeAttachments(form.getAll("attachments").filter((value): value is File => value instanceof File));
  } catch (error) {
    if (error instanceof AttachmentError) return NextResponse.json({ errors: { attachments: error.code } }, { status: 422 });
    throw error;
  }

  await submitQuoteRequest(parsed.data, attachments, locale, meta);
  return NextResponse.json({ ok: true });
}
