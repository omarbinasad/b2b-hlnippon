import { getCapabilities } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

/*
 * Staff view of an uploaded identity document. MOCK: the role comes from a cookie, so this is not protection;
 * the backend must check the staff session and customer_approval.view, and log each view.
 */
export async function GET(_req: Request, ctx: RouteContext<"/admin/customers/[id]/documents/[documentId]">) {
  if (!(await getCapabilities()).includes("customer_approval.view")) return new Response("Your role can't open identity documents.", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const { id, documentId } = await ctx.params;
  const found = await repositories.customers.getDocument(id, documentId);
  if (!found) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const { document, bytes } = found;
  // Images open in the browser (sandboxed); PDFs download, since browser PDF viewers don't run in a sandbox.
  const disposition = document.contentType === "application/pdf" ? "attachment" : "inline";
  return new Response(bytes.slice().buffer, {
    headers: {
      // Type detected from the content at upload, never the browser's claim.
      "Content-Type": document.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
