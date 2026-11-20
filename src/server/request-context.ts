import { headers } from "next/headers";
import { cache } from "react";
import { getClientIp } from "@/lib/ip";

export interface RequestContext {
  ip: string;
  userAgent: string | null;
}

/** IP and user agent of the current request, for server components and actions. */
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const list = await headers();
  return {
    ip: getClientIp(list),
    userAgent: list.get("user-agent")?.slice(0, 500) ?? null,
  };
});
