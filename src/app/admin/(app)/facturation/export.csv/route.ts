import { AuthError, requireAdmin } from "@/server/auth/guards";
import { invoicesCsv } from "@/server/services/invoices";

/** Invoices as CSV (semicolon separated, UTF-8 with BOM for spreadsheet software). */
export async function GET() {
  try {
    await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const csv = await invoicesCsv();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="factures-${date}.csv"`, "Cache-Control": "private, no-store" },
  });
}
