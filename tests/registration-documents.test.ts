import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DOCUMENT_BYTES, detectDocumentType, safeFileName, validateDocuments } from "../src/lib/validation/documents.ts";

const bytes = (...head: number[]) => new Uint8Array([...head, 0, 0, 0, 0, 0, 0, 0, 0]);
const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0);
const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const webp = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
const pdf = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);

test("document type comes from the file content, not the name", () => {
  assert.equal(detectDocumentType(jpeg), "image/jpeg");
  assert.equal(detectDocumentType(png), "image/png");
  assert.equal(detectDocumentType(webp), "image/webp");
  assert.equal(detectDocumentType(pdf), "application/pdf");
  assert.equal(detectDocumentType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(detectDocumentType(new TextEncoder().encode("<html>")), null);
});

test("validateDocuments: optional, one per kind, size and type limits", () => {
  assert.deepEqual(validateDocuments(), {});
  assert.deepEqual(validateDocuments([{ kind: "residence_card_front", fileName: "a.jpg", bytes: jpeg }, { kind: "business_license", fileName: "b.pdf", bytes: pdf }]), {});
  assert.ok(validateDocuments([{ kind: "residence_card_front", fileName: "a.jpg", bytes: new Uint8Array() }])["documents.residence_card_front"]);
  assert.ok(validateDocuments([{ kind: "business_license", fileName: "x.jpg", bytes: new TextEncoder().encode("not an image") }])["documents.business_license"]);
  const big = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
  big.set([0xff, 0xd8, 0xff]);
  assert.ok(validateDocuments([{ kind: "residence_card_front", fileName: "big.jpg", bytes: big }])["documents.residence_card_front"]);
  assert.ok(validateDocuments([{ kind: "residence_card_front", fileName: "a.jpg", bytes: jpeg }, { kind: "residence_card_front", fileName: "b.jpg", bytes: jpeg }]).documents);
});

test("safeFileName strips paths and markup", () => {
  assert.equal(safeFileName("C:\\Users\\me\\nid front.jpg"), "nid front.jpg");
  assert.equal(safeFileName("../../<script>.png"), "_script_.png");
  assert.equal(safeFileName(""), "document");
});
