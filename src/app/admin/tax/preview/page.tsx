import type { Metadata } from "next";
import { TaxNav, TaxRules } from "@/components/admin/tax/tax-nav";
import { TaxPreview, type TaxPreviewExample } from "@/components/admin/tax/tax-preview";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Tax preview" };

export default async function TaxPreviewPage() {
  const [settings, rice, juice, chicken, cumin] = await Promise.all([
    repositories.tax.getSettings(),
    repositories.pricing.productOption("p-001"),
    repositories.pricing.productOption("p-013"),
    repositories.pricing.productOption("p-005"),
    repositories.pricing.productOption("p-011"),
  ]);
  const ex = (e: Omit<TaxPreviewExample, "lines"> & { lines: (TaxPreviewExample["lines"][number] | null)[] }): TaxPreviewExample | null =>
    e.lines.every(Boolean) ? { ...e, lines: e.lines as TaxPreviewExample["lines"] } : null;
  const examples = [
    ex({ label: "Tokyo: standard + reduced classes, line discount", address: { prefecture: "Tokyo", city: "Chiyoda-ku", postalCode: "100-0001" }, lines: [juice && { product: juice, quantity: 10, discount: 200 }, rice && { product: rice, variationId: "p-001-5", quantity: 4 }] }),
    ex({ label: "Shinjuku postcode rate beats the country rate", address: { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "160-0023" }, lines: [juice && { product: juice, quantity: 5 }] }),
    ex({ label: "Yokohama city rate + taxable shipping (if enabled)", address: { prefecture: "Kanagawa", city: "Yokohama-shi Naka-ku", postalCode: "" }, lines: [juice && { product: juice, quantity: 8 }, chicken && { product: chicken, quantity: 3 }] }),
    ex({ label: "Osaka prefecture rate", address: { prefecture: "Osaka", city: "Sakai-shi", postalCode: "" }, lines: [juice && { product: juice, quantity: 20 }, cumin && { product: cumin, quantity: 4 }] }),
    ex({ label: "Customer prices: Sample Kitchen Shinjuku, basmati 20 kg × 2", customerId: "cus-001", address: { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "160-0022" }, lines: [rice && { product: rice, variationId: "p-001-20", quantity: 2 }] }),
  ].filter((e): e is TaxPreviewExample => e !== null);

  return (
    <>
      <PageHeader title="Tax" description="Preview tax for an address, customer, cart and shipping method." />
      <TaxNav current="preview" />
      <div className="mb-6 space-y-3">
        <Notice tone="warning" title="Demo calculation with fictional rates">
          Current settings: tax {settings.enabled ? "on" : "off"}, prices {settings.pricesIncludeTax ? "include" : "exclude"} tax, shipping {settings.shippingTaxable ? "taxable" : "not taxed"}. No rate shown is a legal
          rate, and nothing is filed or collected.{!settings.enabled && " Tax is off by default, so previews show no tax until you enable it under Settings & rates."}
        </Notice>
        <TaxRules />
      </div>
      <TaxPreview examples={examples} />
    </>
  );
}
