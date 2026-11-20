import { getClientIp } from "@/lib/ip";
import { renderQuotePdf } from "@/pdf/render";
import { RATE_LIMITS, consumeRateLimit } from "@/server/auth/rate-limit";
import { getQuoteByToken } from "@/server/services/quotes";

/** PDF download for the recipient, through the private document link. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getQuoteByToken(token);
  if (!found) {
    await consumeRateLimit(`document:invalid:${getClientIp(request.headers)}`, RATE_LIMITS.login);
    return new Response("Not found", { status: 404 });
  }
  const pdf = await renderQuotePdf(found.quote, found.items);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${found.quote.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
