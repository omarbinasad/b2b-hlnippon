/**
 * Identity document uploads (registration: identity document front/back, business license copy): allowed types, size limit, and content-based type detection.
 * The browser's file type and extension are never trusted; the backend must apply the same checks (plus virus scanning).
 */
import type { CustomerDocumentKind, DocumentContentType, DocumentUpload, FieldErrors } from "../types/index.ts";

/** Per file. Keep `serverActions.bodySizeLimit` in next.config.ts above three of these plus form overhead. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
export const DOCUMENT_KINDS: Record<CustomerDocumentKind, string> = {
  residence_card_front: "Identity document, front",
  residence_card_back: "Identity document, back",
  business_license: "Business license / 営業許可証",
};

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** File type from its first bytes (magic numbers), or null when it is not an allowed type. */
export function detectDocumentType(bytes: Uint8Array): DocumentContentType | null {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

/** Keeps a display-safe file name (no path, no control or markup characters). */
export function safeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[^\p{L}\p{N} ._()-]/gu, "_").trim().slice(-100);
  return clean || "document";
}

/** Errors keyed `documents.<kind>`. */
export function validateDocuments(docs: DocumentUpload[] = []): FieldErrors {
  const errors: FieldErrors = {};
  const seen = new Set<string>();
  for (const d of docs) {
    const key = `documents.${d.kind}`;
    if (!(d.kind in DOCUMENT_KINDS) || seen.has(d.kind)) {
      errors.documents = "Upload at most one file for each document.";
      continue;
    }
    seen.add(d.kind);
    if (d.bytes.length === 0) errors[key] = "The file is empty.";
    else if (d.bytes.length > MAX_DOCUMENT_BYTES) errors[key] = "The file is larger than 4 MB.";
    else if (!detectDocumentType(d.bytes)) errors[key] = "Use a JPG, PNG, WebP or PDF file.";
  }
  return errors;
}
