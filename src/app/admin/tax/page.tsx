import { Can, WriteGuard } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { TaxNav, TaxRules } from "@/components/admin/tax/tax-nav";
import { TaxSettingsForm } from "@/components/admin/tax/tax-settings-form";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { TaxRateSortField } from "@/lib/data/repositories";
import { formatDateTime } from "@/lib/format";
import { boolParam, flatParams, listState, oneOf, param } from "@/lib/list-params";
import { locationLevelLabel } from "@/lib/tax/engine";

export const metadata: Metadata = { title: "Tax" };

const PATH = "/admin/tax";
const SORTS = ["match", "name", "percent"] as const satisfies readonly TaxRateSortField[];

export default async function TaxPage({ searchParams }: PageProps<"/admin/tax">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "match");
  const [settings, classes, taxClasses] = await Promise.all([repositories.tax.getSettings(), repositories.tax.classes(), repositories.catalogSettings.taxClasses()]);
  const rates = await repositories.tax.listRates({
    ...state,
    taxClass: oneOf(param(sp, "class"), taxClasses.map((c) => c.id)),
    enabled: boolParam(sp, "enabled"),
    perPage: 20,
  });
  const { notice, ...params } = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };
  const className = (id: string) => taxClasses.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        title="Tax"
        description={`Tax settings, classes and rates. Settings last saved ${formatDateTime(settings.updatedAt)}.`}
        actions={
          <Can cap="taxes.manage"><ButtonLink href="/admin/tax/rates/new">
            <Icon name="plus" className="size-4" /> New rate
          </ButtonLink></Can>
        }
      />
      <TaxNav current="settings" />
      <ActionNotice notice={notice} />
      <div className="mb-6 space-y-3">
        <Notice tone="warning" title="Fictional demo rates">
          None of these rates is a current legal rate. They exist to demonstrate the calculation. The future backend performs the authoritative tax calculation;
          tax filing, payment collection and refunds are not part of this module.
        </Notice>
        <TaxRules />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <div>
            <h2 className="mb-3 text-base font-semibold">Rates</h2>
            <ListToolbar
              pathname={PATH}
              params={params}
              searchLabel="Search rates"
              searchPlaceholder="Name, location or class"
              filters={[
                { name: "class", label: "Tax class", options: taxClasses.map((c) => ({ value: c.id, label: c.name })), allLabel: "All classes" },
                { name: "enabled", label: "Status", options: [{ value: "yes", label: "Enabled" }, { value: "no", label: "Disabled" }], allLabel: "Any" },
              ]}
              total={rates.total}
              page={rates.page}
              perPage={rates.perPage}
            />
            {rates.items.length ? (
              <Table caption="Tax rates">
                <thead>
                  <tr>
                    <SortHeader label="Rate (matching order)" field="match" {...sorting} />
                    <th scope="col">Class</th>
                    <th scope="col">Applies to</th>
                    <SortHeader label="Rate" field="percent" defaultDir="desc" className="text-right" {...sorting} />
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.items.map((r) => (
                    <tr key={r.id}>
                      <td className="min-w-52">
                        <Link href={`/admin/tax/rates/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
                        <span className="block text-xs text-muted">{r.id}{r.legacyWooId && ` · legacy #${r.legacyWooId}`}</span>
                      </td>
                      <td>{className(r.taxClass)}</td>
                      <td className="min-w-40">
                        {r.locationLabel}
                        <span className="block text-xs text-muted">{locationLevelLabel[r.location.type]}</span>
                      </td>
                      <td className="text-right tabular-nums">{r.percent}%</td>
                      <td><Badge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "Enabled" : "Disabled"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No rates match these filters" action={<ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink>} />
            )}
            <div className="mt-4">
              <Pagination page={rates.page} totalPages={rates.totalPages} pathname={PATH} searchParams={params} />
            </div>
          </div>

          <Card title="Tax classes" description="Assigned in the product editor (Tax panel). A variation inherits the product's class unless it sets its own.">
            <Table caption="Tax classes" density="compact">
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col" className="text-right">Products</th>
                  <th scope="col" className="text-right">Variation overrides</th>
                  <th scope="col">Fallback rate</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}<span className="block text-xs text-muted">{c.id}</span></td>
                    <td className="text-right tabular-nums">{c.products}</td>
                    <td className="text-right tabular-nums">{c.variationOverrides}</td>
                    <td className="text-sm">
                      {c.id === "exempt" ? (
                        <span className="text-muted">Never taxed</span>
                      ) : c.hasFallback ? (
                        <Badge tone="success">Country-wide rate set</Badge>
                      ) : (
                        <Badge tone="warning">None — unmatched addresses are untaxed</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card title="Settings">
            <WriteGuard cap="taxes.manage"><TaxSettingsForm settings={settings} classes={taxClasses} /></WriteGuard>
          </Card>
          <p className="text-sm">
            Check a cart and address in the <Link href="/admin/tax/preview" className="font-medium text-brand hover:underline">tax preview</Link>.
          </p>
          <MockPermissionNote permission="taxes.manage" />
          <DemoEditingNotice />
        </div>
      </div>
    </>
  );
}
