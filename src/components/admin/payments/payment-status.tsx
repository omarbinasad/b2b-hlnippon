import { Badge } from "@/components/ui/badge";
import type { PaymentMethodListItem } from "@/lib/data/repositories";

/** Enabled / configuration / checkout availability, always shown together so the state is unambiguous. */
export function PaymentStatusBadges({ method }: { method: PaymentMethodListItem }) {
  const a = method.availability;
  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge tone={method.enabled ? "success" : "neutral"}>{method.enabled ? "Enabled" : "Disabled"}</Badge>
      {method.id === "online" ? (
        <Badge tone={method.online?.status === "connected" ? "success" : "warning"}>{method.online?.status === "connected" ? "Connected" : "Not connected"}</Badge>
      ) : (
        <Badge tone={a.configured ? "info" : "warning"}>{a.configured ? "Configured" : "Needs details"}</Badge>
      )}
      <Badge tone={a.availableAtCheckout ? "brand" : "neutral"}>{a.availableAtCheckout ? "Available at checkout" : "Not available at checkout"}</Badge>
    </span>
  );
}
