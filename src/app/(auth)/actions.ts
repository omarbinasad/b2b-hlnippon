"use server";

/*
 * Online wholesale application. DEMO: saves a pending customer in the mock repository's memory; no login account,
 * password or email is created. The backend must add rate limiting / bot protection and real accounts.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { repositories } from "@/lib/data";
import type { DocumentUpload, FieldErrors, RegistrationInput } from "@/lib/types";
import { DOCUMENT_KINDS, MAX_DOCUMENT_BYTES } from "@/lib/validation/documents";

export type RegisterActionResult = { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

/** Optional files named after the document kinds (`residence_card_front`, `residence_card_back`, `business_license`); empty file inputs are skipped. */
async function readDocuments(form: FormData): Promise<DocumentUpload[] | FieldErrors> {
  const docs: DocumentUpload[] = [];
  for (const kind of Object.keys(DOCUMENT_KINDS) as DocumentUpload["kind"][]) {
    const file = form.get(kind);
    if (!(file instanceof File) || file.size === 0) continue;
    // Checked before reading so an oversized file is never buffered twice; content is checked in validation.
    if (file.size > MAX_DOCUMENT_BYTES) return { [`documents.${kind}`]: "The file is larger than 4 MB." };
    docs.push({ kind, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  }
  return docs;
}

/** `form`: `data` (JSON of the text fields) plus the optional document files. */
export async function registerAction(form: FormData): Promise<RegisterActionResult | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? "{}"));
  } catch {
    raw = {};
  }
  const documents = await readDocuments(form);
  if (!Array.isArray(documents)) return { ok: false, errors: documents, message: "Some fields need attention." };
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const a = (o.address && typeof o.address === "object" ? o.address : {}) as Record<string, unknown>;
  const input: RegistrationInput = {
    companyName: str(o.companyName),
    businessType: str(o.businessType, 60),
    contactName: str(o.contactName),
    email: str(o.email),
    phone: str(o.phone, 30),
    tradeLicenseNumber: str(o.tradeLicenseNumber, 120) || undefined,
    address: { prefecture: str(a.prefecture, 40), city: str(a.city, 120), area: str(a.area, 120) || undefined, postalCode: str(a.postalCode, 10), addressLine1: str(a.addressLine1) },
    message: str(o.message, 1200) || undefined,
    acceptTerms: o.acceptTerms === true,
    documents,
  };
  const result = await repositories.customers.register(input);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  revalidatePath("/admin/customers");
  revalidatePath("/admin", "layout");
  redirect("/application-pending");
}
