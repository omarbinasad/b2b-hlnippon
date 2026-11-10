import type { Metadata } from "next";
import { AddressManager } from "@/components/account/address-manager";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const customer = await repositories.customers.getById(await getPortalCustomerId());
  return (
    <>
      <PageHeader title="Addresses" description="Delivery and billing addresses offered at checkout." />
      <AddressManager addresses={customer?.addresses ?? []} defaults={{ companyName: customer?.companyName, recipientName: customer?.contactName, phone: customer?.phone }} />
    </>
  );
}
