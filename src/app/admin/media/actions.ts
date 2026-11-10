"use server";

/*
 * Media library mutations. DEMO: files stay in server memory. TODO(auth): the permission is mocked; the backend must
 * authorize every call, scan uploads and store files safely.
 */
import { revalidatePath } from "next/cache";
import { actorWith } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { FieldErrors, MediaItem, MediaKind, Paginated } from "@/lib/types";

export type MediaActionResult<T = MediaItem> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const denied = { ok: false as const, errors: {}, message: "You don't have permission to manage media (mock permission)." };

const size = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : undefined;
};

export async function listMediaAction(query: { search?: string; kind?: MediaKind; page?: number }): Promise<Paginated<MediaItem> | null> {
  if (!(await actorWith("media.view"))) return null;
  return repositories.media.list({ search: typeof query.search === "string" ? query.search.slice(0, 100) : undefined, kind: query.kind === "image" || query.kind === "document" ? query.kind : undefined, page: Number(query.page) || 1, perPage: 24 });
}

export async function uploadMediaAction(form: FormData): Promise<MediaActionResult> {
  const by = await actorWith("media.create");
  if (!by) return denied;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, errors: { file: "Choose a file." }, message: "Choose a file." };
  const result = await repositories.media.upload(
    { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()), width: size(form.get("width")), height: size(form.get("height")) },
    by,
  );
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "The file couldn't be uploaded." };
  revalidatePath("/admin/media");
  return { ok: true, value: result.value };
}

export async function updateMediaAction(id: string, raw: { title?: unknown; alt?: unknown }): Promise<MediaActionResult> {
  const by = await actorWith("media.edit");
  if (!by) return denied;
  const result = await repositories.media.update(String(id), { title: typeof raw.title === "string" ? raw.title : "", alt: typeof raw.alt === "string" ? raw.alt : "" }, by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  revalidatePath("/admin/media");
  return { ok: true, value: result.value };
}

export async function removeMediaAction(id: string): Promise<MediaActionResult<{ id: string }>> {
  const by = await actorWith("media.delete");
  if (!by) return denied;
  await repositories.media.remove(String(id), by);
  revalidatePath("/admin/media");
  return { ok: true, value: { id: String(id) } };
}
