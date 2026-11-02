"use client";

import { useState, useTransition } from "react";
import { updateCustomerAction } from "@/app/admin/customers/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Customer, CustomerDetailsInput, CustomerGroup, DeliveryRoute, FieldErrors } from "@/lib/types";

const BUSINESS_TYPES = ["Restaurant", "Hotel", "Caterer", "Grocery store", "Distributor", "Bakery", "Other"];

export function CustomerDetailsForm({ customer, groups, routes }: { customer: Customer; groups: CustomerGroup[]; routes: Pick<DeliveryRoute, "id" | "name">[] }) {
  const [values, setValues] = useState<Required<{ [K in keyof CustomerDetailsInput]: string }>>({
    companyName: customer.companyName,
    contactName: customer.contactName ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    businessType: customer.businessType ?? "",
    tradeLicenseNumber: customer.tradeLicenseNumber ?? "",
    vatRegistrationNumber: customer.vatRegistrationNumber ?? "",
    groupId: customer.groupId ?? "",
    deliveryRouteId: customer.deliveryRouteId ?? "",
    internalNote: customer.internalNote ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const input = (key: keyof typeof values, label: string, opts: { required?: boolean; hint?: string; type?: string; autoComplete?: string; list?: string } = {}) => {
    const id = `cd-${key}`;
    return (
      <Field id={id} label={label} required={opts.required} hint={opts.hint} error={errors[key]}>
        <Input
          id={id}
          type={opts.type ?? "text"}
          value={values[key]}
          onChange={set(key)}
          maxLength={200}
          list={opts.list}
          autoComplete={opts.autoComplete ?? "off"}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${id}-error` : opts.hint ? `${id}-hint` : undefined}
        />
      </Field>
    );
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateCustomerAction(customer.id, values);
          if (!result) return; // redirected back to the customer
          if (!result.ok) {
            setErrors(result.errors);
            setMessage(result.message);
          }
        });
      }}
      className="space-y-6"
    >
      <Card title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{input("companyName", "Business name", { required: true, autoComplete: "organization" })}</div>
          {input("contactName", "Contact person", { autoComplete: "name" })}
          {input("phone", "Phone", { type: "tel", hint: "Phone or email is required.", autoComplete: "tel" })}
          {input("email", "Email", { type: "email", autoComplete: "email" })}
        </div>
      </Card>

      <Card title="Business">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("businessType", "Business type", { list: "business-types" })}
          <datalist id="business-types">{BUSINESS_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          {input("tradeLicenseNumber", "Trade licence number")}
          {input("vatRegistrationNumber", "Invoice registration no.", { hint: "Qualified invoice issuer number (適格請求書発行事業者登録番号): T followed by 13 digits." })}
        </div>
      </Card>

      <Card title="Group and delivery">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cd-groupId" label="Customer group" hint="Future price and quantity rules will target the group." error={errors.groupId}>
            <Select id="cd-groupId" value={values.groupId} onChange={set("groupId")} aria-describedby="cd-groupId-hint">
              <option value="">No group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field id="cd-deliveryRouteId" label="Delivery route" hint="Suggests the delivery charge on admin orders." error={errors.deliveryRouteId}>
            <Select id="cd-deliveryRouteId" value={values.deliveryRouteId} onChange={set("deliveryRouteId")} aria-describedby="cd-deliveryRouteId-hint">
              <option value="">No route</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Internal note">
        <Field id="cd-internalNote" label="Note for staff" hint="Never shown to the customer." error={errors.internalNote}>
          <Textarea id="cd-internalNote" value={values.internalNote} onChange={set("internalNote")} maxLength={1000} aria-describedby="cd-internalNote-hint" />
        </Field>
      </Card>

      <p role="alert" className="text-sm text-danger">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={`/admin/customers/${customer.id}`} variant="secondary">Cancel</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      </div>
    </form>
  );
}
