"use client";

import { useState, useTransition } from "react";
import { sendContactMessageAction } from "@/app/(store)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { CONTACT_LIMITS, CONTACT_TOPICS } from "@/lib/validation/contact";
import type { ContactTopic, FieldErrors } from "@/lib/types";

const empty = { name: "", company: "", email: "", phone: "", topic: "general" as ContactTopic, message: "", website: "" };

/** Contact form. DEMO: the message is saved on the demo server only and no email is sent (backend work). */
export function ContactForm() {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const aria = (key: string) => ({ "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `contact-${key}-error` : undefined });

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <Icon name="check" className="size-6" />
        </span>
        <h3 className="text-lg font-semibold">Message received</h3>
        <p className="max-w-sm text-sm text-muted">
          Demo: your message was saved on this demo server only. No email was sent, and nobody has been notified.
        </p>
        <Button variant="secondary" onClick={() => { setValues(empty); setSent(false); }}>Send another message</Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await sendContactMessageAction(values);
          if (r.ok) {
            setErrors({});
            setMessage("");
            setSent(true);
          } else {
            setErrors(r.errors);
            setMessage(r.message);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact-name" label="Your name" required error={errors.name}>
          <Input id="contact-name" value={values.name} onChange={set("name")} maxLength={CONTACT_LIMITS.name} autoComplete="name" {...aria("name")} />
        </Field>
        <Field id="contact-company" label="Company" error={errors.company}>
          <Input id="contact-company" value={values.company} onChange={set("company")} maxLength={CONTACT_LIMITS.company} autoComplete="organization" {...aria("company")} />
        </Field>
        <Field id="contact-email" label="Email" required error={errors.email}>
          <Input id="contact-email" type="email" value={values.email} onChange={set("email")} maxLength={CONTACT_LIMITS.email} autoComplete="email" {...aria("email")} />
        </Field>
        <Field id="contact-phone" label="Phone" hint="Optional." error={errors.phone}>
          <Input id="contact-phone" type="tel" value={values.phone} onChange={set("phone")} maxLength={CONTACT_LIMITS.phone} autoComplete="tel" {...aria("phone")} />
        </Field>
      </div>
      <Field id="contact-topic" label="Topic" required error={errors.topic}>
        <Select id="contact-topic" value={values.topic} onChange={set("topic")} {...aria("topic")}>
          {Object.entries(CONTACT_TOPICS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      <Field id="contact-message" label="Message" required error={errors.message}>
        <Textarea id="contact-message" rows={6} value={values.message} onChange={set("message")} maxLength={CONTACT_LIMITS.message} {...aria("message")} />
      </Field>
      {/* Spam trap: hidden from people, and left empty by them. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
      </div>
      <p role="alert" className="text-sm text-danger empty:hidden">{message}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Demo: messages stay on this demo server and no email is sent.</p>
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button>
      </div>
    </form>
  );
}
