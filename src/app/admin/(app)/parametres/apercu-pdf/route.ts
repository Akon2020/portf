import { renderSamplePdf } from "@/pdf/render";
import { AuthError, requireAdmin } from "@/server/auth/guards";

/** Preview of the document layout with the saved color and logo. */
export async function GET() {
  try {
    await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const pdf = await renderSamplePdf();
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="apercu.pdf"', "Cache-Control": "private, no-store" },
  });
}
