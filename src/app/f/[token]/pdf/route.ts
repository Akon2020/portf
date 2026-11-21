import { getClientIp } from "@/lib/ip";
import { recordAppSignal } from "@/monitoring/record";
import { renderInvoicePdf, renderQuotePdf, renderReceiptPdf } from "@/pdf/render";
import { RATE_LIMITS, consumeRateLimit } from "@/server/auth/rate-limit";
import { getInvoiceByToken, getReceiptByToken } from "@/server/services/invoices";
import { getQuoteByToken } from "@/server/services/quotes";

function pdfResponse(pdf: Buffer, name: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** PDF download for the recipient, through the private document link (quote, invoice or receipt). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getQuoteByToken(token);
  if (quote) return pdfResponse(await renderQuotePdf(quote.quote, quote.items), quote.quote.number ?? "devis");
  const invoice = await getInvoiceByToken(token);
  if (invoice) return pdfResponse(await renderInvoicePdf(invoice.invoice, invoice.items), invoice.invoice.number ?? "facture");
  const receipt = await getReceiptByToken(token);
  if (receipt) return pdfResponse(await renderReceiptPdf(receipt.receipt, receipt.payment, receipt.invoice), receipt.receipt.number);
  const ip = getClientIp(request.headers);
  await consumeRateLimit(`document:invalid:${ip}`, RATE_LIMITS.login);
  await recordAppSignal({ ip, method: "GET", path: "/f/[jeton]/pdf", query: "", userAgent: request.headers.get("user-agent") }, { ruleId: "document.invalid-token", category: "invalid_token", severity: "medium", score: 10 });
  return new Response("Not found", { status: 404 });
}
