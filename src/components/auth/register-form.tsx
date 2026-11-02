"use client";

import { useState, useTransition } from "react";
import { registerAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { JP_PREFECTURES, prefectureLabel } from "@/lib/locations";
import type { FieldErrors } from "@/lib/types";
import { DOCUMENT_KINDS } from "@/lib/validation/documents";
import { BUSINESS_TYPES } from "@/lib/validation/registration";
import { DocumentField } from "./document-field";

const empty = { companyName: "", businessType: "", contactName: "", email: "", phone: "", tradeLicenseNumber: "", message: "" };
const emptyAddress = { prefecture: "", city: "", postalCode: "", addressLine1: "" };
type DocKind = keyof typeof DOCUMENT_KINDS;

/** Wholesale application. Validated again on the server; creates a pending account for staff review. */
export function RegisterForm() {
  const [values, setValues] = useState(empty);
  const [address, setAddress] = useState(emptyAddress);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [files, setFiles] = useState<Record<DocKind, File | null>>({ residence_card_front: null, residence_card_back: null, business_license: null });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const setAddr = (key: keyof typeof emptyAddress) => (e: { target: { value: string } }) => setAddress((v) => ({ ...v, [key]: e.target.value }));
  const err = (key: string) => errors[key];
  const aria = (key: string) => ({ "aria-invalid": Boolean(errors[key]) || undefined, "aria-describedby": errors[key] ? `rg-${key.replace(".", "-")}-error` : undefined });

  return (
    <form
      noValidate
      className="mt-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fileErrors = Object.entries(errors).filter(([k]) => k.startsWith("documents."));
        if (fileErrors.length) {
          setMessage("Remove or replace the files marked below.");
          return;
        }
        const form = new FormData();
        form.set("data", JSON.stringify({ ...values, address, acceptTerms }));
        for (const [kind, file] of Object.entries(files)) if (file) form.set(kind, file);
        startTransition(async () => {
          const result = await registerAction(form);
          if (!result) return; // redirected to the "application received" page
          setErrors(result.errors);
          setMessage(result.message);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rg-companyName" label="Business name" required error={err("companyName")}>
          <Input id="rg-companyName" value={values.companyName} onChange={set("companyName")} maxLength={120} autoComplete="organization" {...aria("companyName")} />
        </Field>
        <Field id="rg-businessType" label="Business type" required error={err("businessType")}>
          <Select id="rg-businessType" value={values.businessType} onChange={set("businessType")} {...aria("businessType")}>
            <option value="" disabled>Select…</option>
            {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field id="rg-contactName" label="Contact person" required error={err("contactName")}>
          <Input id="rg-contactName" value={values.contactName} onChange={set("contactName")} maxLength={200} autoComplete="name" {...aria("contactName")} />
        </Field>
        <Field id="rg-tradeLicenseNumber" label="Trade licence number" hint="Optional — speeds up the review." error={err("tradeLicenseNumber")}>
          <Input id="rg-tradeLicenseNumber" value={values.tradeLicenseNumber} onChange={set("tradeLicenseNumber")} maxLength={100} />
        </Field>
        <Field id="rg-email" label="Email" required error={err("email")}>
          <Input id="rg-email" type="email" value={values.email} onChange={set("email")} maxLength={200} autoComplete="email" {...aria("email")} />
        </Field>
        <Field id="rg-phone" label="Phone" required hint="e.g. 090-1234-5678" error={err("phone")}>
          <Input id="rg-phone" type="tel" inputMode="tel" value={values.phone} onChange={set("phone")} maxLength={20} autoComplete="tel" {...aria("phone")} />
        </Field>
      </div>
      <fieldset className="space-y-4 border-t border-line pt-4">
        <legend className="pt-4 text-sm font-semibold">Business address</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rg-address-postalCode" label="(〒) Postcode / 郵便番号" required hint="7 digits, e.g. 160-0023" error={err("address.postalCode")}>
            <Input id="rg-address-postalCode" value={address.postalCode} onChange={setAddr("postalCode")} maxLength={8} inputMode="numeric" autoComplete="postal-code" placeholder="1000000" {...aria("address.postalCode")} />
          </Field>
          <Field id="rg-address-prefecture" label="Prefecture / 都道府県" required error={err("address.prefecture")}>
            <Select id="rg-address-prefecture" value={address.prefecture} onChange={setAddr("prefecture")} autoComplete="address-level1" {...aria("address.prefecture")}>
              <option value="" disabled>Select…</option>
              {JP_PREFECTURES.map((p) => <option key={p} value={p}>{prefectureLabel(p)}</option>)}
            </Select>
          </Field>
        </div>
        <Field id="rg-address-city" label="Town, City / 市区町村" required error={err("address.city")}>
          <Input id="rg-address-city" value={address.city} onChange={setAddr("city")} maxLength={100} autoComplete="address-level2" placeholder="Shinjuku-ku" {...aria("address.city")} />
        </Field>
        <Field id="rg-address-addressLine1" label="Street address" required hint="Town, block and building, e.g. 1-2-3 Nishi-Shinjuku, Sample Bldg 4F" error={err("address.addressLine1")}>
          <Input id="rg-address-addressLine1" value={address.addressLine1} onChange={setAddr("addressLine1")} maxLength={200} autoComplete="address-line1" {...aria("address.addressLine1")} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-4">
        <legend className="pt-4 text-sm font-semibold">Documents</legend>
        <p className="text-xs text-muted">Optional. A copy of your Japan Residence Card (both sides) and your business license helps us review your application faster. Only our staff can see these files.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(DOCUMENT_KINDS) as DocKind[]).map((kind) => (
            <DocumentField
              key={kind}
              id={`rg-${kind}`}
              label={DOCUMENT_KINDS[kind]}
              file={files[kind]}
              error={err(`documents.${kind}`)}
              onChange={(file, error) => {
                setFiles((f) => ({ ...f, [kind]: file }));
                setErrors((e) => {
                  const next = { ...e };
                  delete next[`documents.${kind}`];
                  return error ? { ...next, [`documents.${kind}`]: error } : next;
                });
              }}
            />
          ))}
        </div>
        {errors.documents && <p className="text-xs text-danger">{errors.documents}</p>}
      </fieldset>

      <Field id="rg-message" label="Anything we should know?" hint="Optional: products you need, order frequency, delivery times." error={err("message")}>
        <Textarea id="rg-message" value={values.message} onChange={set("message")} maxLength={1000} />
      </Field>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 accent-brand" aria-invalid={Boolean(errors.acceptTerms) || undefined} />
          <span>I confirm these details are correct and may be used to review my application.</span>
        </label>
        {errors.acceptTerms && <p className="mt-1 text-xs text-danger">{errors.acceptTerms}</p>}
      </div>

      <p role="alert" className="text-sm text-danger">{message}</p>
      <Button type="submit" className="w-full sm:w-auto sm:px-8" disabled={pending}>{pending ? "Submitting…" : "Submit application"}</Button>
    </form>
  );
}
