"use server";

import { revalidatePath } from "next/cache";
import { getRequestContext } from "../request-context";
import { acceptQuote, declineQuote, type DecisionResult } from "../services/quotes";

export type DecisionState = { done?: "accepted" | "declined"; error?: Exclude<DecisionResult, { ok: true }>["error"] };

export async function acceptQuoteAction(token: string, _state: DecisionState, formData: FormData): Promise<DecisionState> {
  if (formData.get("agree") !== "1") return { error: "name" };
  const result = await acceptQuote(token, String(formData.get("name") ?? ""), await getRequestContext());
  if (!result.ok) return { error: result.error };
  revalidatePath(`/f/${token}`);
  return { done: "accepted" };
}

export async function declineQuoteAction(token: string, _state: DecisionState): Promise<DecisionState> {
  const result = await declineQuote(token, await getRequestContext());
  if (!result.ok) return { error: result.error };
  revalidatePath(`/f/${token}`);
  return { done: "declined" };
}

export type NegotiationState = { done?: boolean; error?: "invalid" | "closed" | "expired" | "rateLimited" | "tooShort" | "invalidAmount" };

/** Client proposal from the public quote page: other budget and/or additional features. */
export async function negotiateQuoteAction(token: string, _state: NegotiationState, formData: FormData): Promise<NegotiationState> {
  const { negotiationInputSchema, proposeNegotiation } = await import("../services/negotiation");
  const parsed = negotiationInputSchema.safeParse({
    proposedTotal: String(formData.get("proposedTotal") ?? ""),
    requestedFeatures: String(formData.get("requestedFeatures") ?? ""),
    message: String(formData.get("message") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    return { error: code === "invalidAmount" ? "invalidAmount" : "tooShort" };
  }
  const result = await proposeNegotiation(token, parsed.data, await getRequestContext());
  if (!result.ok) return { error: result.error };
  revalidatePath(`/f/${token}`);
  return { done: true };
}
