import { renderReceiptPdf } from "@/pdf/render";
import { AuthError, requireAdmin } from "@/server/auth/guards";
import { getReceipt } from "@/server/services/invoices";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const row = await getReceipt(id);
  if (!row) return new Response("Not found", { status: 404 });
  const pdf = await renderReceiptPdf(row.receipt, row.payment, row.invoice);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${row.receipt.number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
