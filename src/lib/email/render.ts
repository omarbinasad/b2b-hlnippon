/** Email template placeholders. Pure and tested. Values are escaped, so customer data can't add markup to a message. */

const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}/g;

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fills `{{name}}` placeholders. `html` escapes values for a message body; subjects are plain text. */
export function renderTemplate(text: string, vars: Record<string, string>, { html = false } = {}) {
  return text.replace(TOKEN, (whole, key: string) => {
    const v = vars[key];
    if (v === undefined) return whole;
    return html ? escapeHtml(v) : v;
  });
}

export const placeholdersIn = (text: string) => [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]))];

export function validateTemplate(input: { subject: string; bodyHtml: string }, allowed: string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const subject = input.subject.trim();
  if (subject.length < 2) errors.subject = "Enter a subject.";
  else if (subject.length > 200) errors.subject = "Keep it under 200 characters.";
  if (input.bodyHtml.trim().length < 2) errors.bodyHtml = "Enter the message.";
  const unknown = (text: string) => placeholdersIn(text).filter((p) => !allowed.includes(p));
  const badSubject = unknown(input.subject);
  if (badSubject.length && !errors.subject) errors.subject = `Unknown placeholder: ${badSubject.join(", ")}`;
  const badBody = unknown(input.bodyHtml);
  if (badBody.length && !errors.bodyHtml) errors.bodyHtml = `Unknown placeholder: ${badBody.join(", ")}`;
  return errors;
}
