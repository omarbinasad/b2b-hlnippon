import "server-only";

import type { MediaItem } from "@/lib/types";
import { detectDocumentType, safeFileName } from "@/lib/validation/documents";
import { clone, now } from "./mock-store-helpers";
import { matches, paginate, sortBy, type SortKey } from "./mock-utils";
import type { MediaRepository } from "./repositories";

export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

const sampleImage = (id: string, url: string, title: string, width: number, height: number, size: number): MediaItem => ({
  id,
  url,
  kind: "image",
  fileName: url.split("/").pop() ?? id,
  title,
  alt: title,
  contentType: "image/webp",
  size,
  width,
  height,
  sample: true,
  uploadedAt: "2026-01-01T00:00:00+09:00",
  uploadedBy: "Sample data",
});

/*
 * DEMO: uploads stay in server memory and are lost on restart. No virus scan or image processing. The backend stores
 * files in private or object storage and returns the public URL.
 */
const store = globalThis as typeof globalThis & { __mockMedia?: { items: MediaItem[]; files: Map<string, { bytes: Uint8Array; contentType: string }> } };
store.__mockMedia ??= {
  items: [
    sampleImage("med-logo-light", "/brand/hl-logo-on-light.webp", "Sample logo for light backgrounds", 922, 266, 40_000),
    sampleImage("med-logo-dark", "/brand/hl-logo-on-dark.webp", "Sample logo for dark backgrounds", 922, 266, 40_000),
    sampleImage("med-owner", "/images/owner.webp", "Sample owner photo", 800, 800, 80_000),
  ],
  files: new Map(),
};
const media = store.__mockMedia;

export const mockMediaRepository: MediaRepository = {
  async list({ search, kind, sort = "date", dir, page, perPage } = {}) {
    const filtered = media.items.filter((m) => (!kind || m.kind === kind) && matches(search, m.title, m.fileName, m.alt));
    const key = (m: MediaItem): SortKey => (sort === "name" ? m.title.toLowerCase() : sort === "size" ? m.size : m.uploadedAt);
    return clone(paginate(sortBy(filtered, key, dir ?? (sort === "name" ? "asc" : "desc")), page, perPage));
  },
  async getById(id) {
    const m = media.items.find((x) => x.id === id);
    return m ? clone(m) : null;
  },
  async content(id) {
    return media.files.get(id) ?? null;
  },
  async upload(input, actor) {
    const contentType = detectDocumentType(input.bytes);
    if (!contentType) return { ok: false, errors: { file: "Use a JPEG, PNG, WebP or PDF file." }, message: "That file type isn't allowed." };
    if (input.bytes.length > MAX_MEDIA_BYTES) return { ok: false, errors: { file: "The file is larger than 4 MB." }, message: "That file is too large." };
    const id = `med-${crypto.randomUUID().slice(0, 8)}`;
    const fileName = safeFileName(input.fileName);
    const title = input.title?.trim().slice(0, 120) || fileName.replace(/\.[^.]+$/, "");
    const item: MediaItem = {
      id,
      url: `/media/${id}`,
      kind: contentType === "application/pdf" ? "document" : "image",
      fileName,
      title,
      alt: input.alt?.trim().slice(0, 200) ?? "",
      contentType,
      size: input.bytes.length,
      width: input.width,
      height: input.height,
      uploadedAt: now(),
      uploadedBy: actor.name,
    };
    media.items.unshift(item);
    media.files.set(id, { bytes: input.bytes, contentType });
    return { ok: true, value: clone(item) };
  },
  async update(id, input) {
    const m = media.items.find((x) => x.id === id);
    if (!m) return { ok: false, errors: {} as Record<string, string>, message: "That file no longer exists." };
    const title = input.title.trim();
    if (title.length < 1 || title.length > 120) return { ok: false, errors: { title: "Enter a title of up to 120 characters." }, message: "Some fields need attention." };
    if (input.alt.length > 200) return { ok: false, errors: { alt: "Keep it under 200 characters." }, message: "Some fields need attention." };
    m.title = title;
    m.alt = input.alt.trim();
    return { ok: true, value: clone(m) };
  },
  async remove(id) {
    const i = media.items.findIndex((x) => x.id === id && !x.sample);
    if (i >= 0) media.items.splice(i, 1);
    media.files.delete(id);
  },
};
