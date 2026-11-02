import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { ShopperGate } from "@/components/cart/shopper-gate";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { siteConfig } from "@/config/site";
import { getShoppingCustomerId, getViewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const customerId = await getShoppingCustomerId();
  if (!customerId) {
    return (
      <>
        <PageHeader title="Checkout" />
        <ShopperGate viewer={await getViewer()} />
      </>
    );
  }

  const [cart, customer, methods] = await Promise.all([
    repositories.cart.get(customerId),
    repositories.customers.getById(customerId),
    repositories.payments.checkoutMethods(),
  ]);
  if (!cart.lines.length) redirect("/cart");
  const shippingAddresses = customer?.addresses.filter((a) => a.type === "shipping") ?? [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timeZone }).format(new Date());

  return (
    <>
      <PageHeader title="Checkout" description="Confirm delivery details and place your wholesale order." />
      <div className="space-y-6">
        <Notice tone="warning">
          Demo checkout: the order is created on this demo server only (it appears in your account and in Admin →
          Orders until the server restarts). No payment is taken and tax rates are fictional.
        </Notice>
        {!cart.valid ? (
          <Notice tone="warning" title="Some items need attention">
            Go back to the cart to fix quantities or remove unavailable items. <ButtonLink href="/cart" size="sm" variant="secondary">Back to cart</ButtonLink>
          </Notice>
        ) : shippingAddresses.length === 0 ? (
          <Notice tone="warning" title="No delivery address">Your account has no delivery address yet. Contact us to add one, then return to checkout.</Notice>
        ) : (
          <CheckoutForm
            shippingAddresses={shippingAddresses}
            billingAddresses={customer?.addresses.filter((a) => a.type === "billing") ?? []}
            methods={methods}
            today={today}
            idempotencyKey={crypto.randomUUID()}
          />
        )}
      </div>
    </>
  );
}
