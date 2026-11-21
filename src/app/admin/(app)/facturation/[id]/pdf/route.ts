import { renderInvoicePdf } from "@/pdf/render";
import { AuthError, requireAdmin } from "@/server/auth/guards";
import { getInvoice } from "@/server/services/invoices";

/** PDF preview for the admin, drafts included. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const data = await getInvoice(id);
  if (!data) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf(data.invoice, data.items);
  const name = data.invoice.number ?? `brouillon-${id.slice(0, 8)}`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
