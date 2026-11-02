import { Notice } from "@/components/ui/feedback";

/** Shown wherever admin data can be edited in the demo. `images` adds the note about local-only image previews. */
export function DemoEditingNotice({ images = false }: { images?: boolean }) {
  return (
    <Notice tone="warning" title="Demo editing — not saved to a database">
      Changes are kept in this demo server&apos;s memory only: they survive a page refresh, but are lost when the server
      restarts and are visible to anyone using this demo.{images && " Image files are previewed in your browser and never uploaded."}
    </Notice>
  );
}

const messages: Record<string, { tone: "info" | "warning"; text: string }> = {
  created: { tone: "info", text: "Created in the demo store." },
  "customer-created": { tone: "info", text: "Customer added in the demo store. Complete addresses and other details below when you have them. Nothing was sent to the customer." },
  "order-created": { tone: "info", text: "Order created in the demo store. No confirmation was sent to the customer and no payment was taken." },
  saved: { tone: "info", text: "Saved to the demo store." },
  duplicated: { tone: "info", text: "Duplicated as a new draft. Review the name, slug and SKUs, then save." },
  archived: { tone: "info", text: "Archived. It is hidden from the store; filter by status “Archived” to find it." },
  restored: { tone: "info", text: "Restored as a draft." },
  deleted: { tone: "info", text: "Deleted from the demo store." },
  "payment-incomplete": { tone: "warning", text: "That method could not be enabled: complete its details first (Edit)." },
  status: { tone: "info", text: "Order status updated in the demo store. No message was sent to the customer." },
  error: { tone: "warning", text: "That action could not be completed. The item may no longer exist." },
};

/** Labels UI actions whose permission checks are mocked. */
export function MockPermissionNote({ permission }: { permission: string }) {
  return (
    <p className="text-xs text-muted">
      Mock permission: <code className="rounded bg-surface-muted px-1">{permission}</code> — granted to the demo admin. The backend will enforce real
      authorization.
    </p>
  );
}

/** One-line result of a redirecting action (`?notice=…`). */
export function ActionNotice({ notice }: { notice?: string }) {
  const message = notice ? messages[notice] : undefined;
  if (!message) return null;
  return (
    <div role="status" className="mb-4">
      <Notice tone={message.tone}>{message.text}</Notice>
    </div>
  );
}
