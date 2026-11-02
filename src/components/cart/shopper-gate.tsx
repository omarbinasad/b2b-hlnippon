import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import type { Viewer } from "@/lib/auth/session";

/** Shown on the cart and checkout to anyone who isn't an approved customer. */
export function ShopperGate({ viewer }: { viewer: Viewer }) {
  if (viewer.kind === "customer") {
    return <Notice title="Awaiting approval">Your business account is being reviewed. The cart and checkout open once it is approved.</Notice>;
  }
  if (viewer.kind === "admin") {
    return <Notice>Admin preview: the cart and checkout are for approved customers (switch “Demo view” to Approved customer to preview them).</Notice>;
  }
  return (
    <div className="space-y-3">
      <Notice title="Log in to order">The cart and checkout are available to approved business customers.</Notice>
      <div className="flex gap-2">
        <ButtonLink href="/login">Log in</ButtonLink>
        <ButtonLink href="/register" variant="secondary">Apply for an account</ButtonLink>
      </div>
    </div>
  );
}
