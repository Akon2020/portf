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
