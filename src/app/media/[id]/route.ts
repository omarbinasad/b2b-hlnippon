import { repositories } from "@/lib/data";

/** Serves files uploaded to the demo media library. Only checked raster images and PDFs are ever stored here. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const file = await repositories.media.content((await params).id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
      ...(file.contentType === "application/pdf" ? { "Content-Disposition": "attachment" } : {}),
    },
  });
}
