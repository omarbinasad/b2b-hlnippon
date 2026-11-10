import type { Route } from "next";
import Link from "next/link";
import { StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { adminNavGroups } from "@/config/site";
import { canOpen } from "@/lib/auth/capabilities";
import { formatNumber } from "@/lib/format";
import type { Role } from "@/lib/types";

/** The dashboard for roles that can't see sales figures: their own shortcuts and work waiting. */
export function RoleDashboard({ role, openOrders, pendingRequests }: { role: Role; openOrders: number; pendingRequests: number }) {
  const can = (c: string) => role.capabilities.includes(c);
  const groups = adminNavGroups.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/admin" && canOpen(role.capabilities, i.href)) })).filter((g) => g.items.length);
  return (
    <>
      <PageHeader title="Dashboard" description={`${role.name}: ${role.description}`} />
      {(can("orders.view") || can("customer_approval.view")) && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
          {can("orders.view") && <Link href="/admin/orders?status=open"><StatCard label="Open orders" value={formatNumber(openOrders)} /></Link>}
          {can("customer_approval.view") && <Link href="/admin/customers/requests?status=pending"><StatCard label="Pending requests" value={formatNumber(pendingRequests)} /></Link>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <section key={g.label} className="rounded-ui border border-line bg-surface p-4">
            <h2 className="font-semibold">{g.label}</h2>
            <ul className="mt-2 space-y-1 text-sm">{g.items.map((i) => <li key={i.href}><Link href={i.href as Route} className="text-brand hover:underline">{i.label}</Link></li>)}</ul>
          </section>
        ))}
      </div>
    </>
  );
}
