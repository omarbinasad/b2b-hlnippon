import "server-only";

import { validateContactMessage } from "@/lib/validation/contact";
import type { ContactMessage } from "@/lib/types";
import type { ContactRepository } from "./repositories";

/* DEMO STORE: contact messages in server memory (lost on restart). Nothing is emailed. */
const state = globalThis as typeof globalThis & { __mockContactMessages?: ContactMessage[] };
state.__mockContactMessages ??= [];
export const mockContactMessages = state.__mockContactMessages;

export const mockContactRepository: ContactRepository = {
  async submit(input) {
    const errors = validateContactMessage(input);
    if (Object.keys(errors).length) return { ok: false, errors, message: "Some fields need attention." };
    const message: ContactMessage = {
      ...input,
      name: input.name.trim(),
      email: input.email.trim(),
      message: input.message.trim(),
      company: input.company?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      id: `msg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      receivedAt: new Date().toISOString(),
    };
    mockContactMessages.push(message);
    return { ok: true, value: message };
  },
};
