import type { Instrumentation } from "next";

/** Server errors are stored for Monitoring > Journaux, without ever throwing. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { track } = await import("./monitoring/transport");
    const value = error as Error & { digest?: string };
    await track({
      type: "error",
      data: {
        message: String(value?.message ?? error).slice(0, 2000),
        stack: value?.stack?.slice(0, 8000) ?? null,
        digest: value?.digest ?? null,
        method: request.method,
        path: request.path.split("?")[0].slice(0, 500),
        routeType: context.routeType,
      },
    });
  } catch {
    // Monitoring must never break the response.
  }
};
