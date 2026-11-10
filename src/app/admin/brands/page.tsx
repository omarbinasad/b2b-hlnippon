import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AddBrandButton, BrandRowActions } from "@/components/admin/brands/brand-actions";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { boolParam, flatParams, listState } from "@/lib/list-params";

export const metadata: Metadata = { title: "Brands" };

const PATH = "/admin/brands";
const SORTS = ["name", "products", "order"] as const;

export default async function BrandsPage({ searchParams }: PageProps<"/admin/brands">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "name");
  const result = await repositories.catalogSettings.adminBrands({ ...state, showOnHome: boolParam(sp, "home"), perPage: 20 });
  const params = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };

  return (
    <>
      <PageHeader
        title="Brands"
        description="Assign brands to products, filter by them in the shop, and choose which logos appear on the homepage."
        actions={<AddBrandButton />}
      />
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search brands"
        searchPlaceholder="Brand name"
        filters={[{ name: "home", label: "Homepage", options: [{ value: "yes", label: "Shown on homepage" }, { value: "no", label: "Not shown" }], allLabel: "All brands" }]}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
      />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Brands">
            <thead>
              <tr>
                <th scope="col">Logo</th>
                <SortHeader label="Brand" field="name" {...sorting} />
                <SortHeader label="Products" field="products" defaultDir="desc" className="text-right" {...sorting} />
                <th scope="col">Homepage</th>
                <SortHeader label="Order" field="order" className="text-right" {...sorting} />
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="relative grid h-10 w-20 place-items-center overflow-hidden rounded-ui border border-line bg-logo-tile text-xs text-logo-tile-ink">
                      {b.logo ? <Image src={b.logo.src} alt={`${b.name} logo`} fill sizes="5rem" unoptimized={b.logo.src.startsWith("/media/")} className="object-contain p-1" /> : "No logo"}
                    </span>
                  </td>
                  <td className="font-medium">{b.name}</td>
                  <td className="text-right tabular-nums">
                    {b.productCount ? <Link href={`/shop?brand=${b.slug}`} className="hover:underline" aria-label={`${b.productCount} products of ${b.name}`}>{b.productCount}</Link> : 0}
                  </td>
                  <td>{b.showOnHome ? <Badge tone="success">Shown</Badge> : <span className="text-muted">Not shown</span>}</td>
                  <td className="text-right tabular-nums">{b.displayOrder ?? 0}</td>
                  <td><BrandRowActions brand={b} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No brands match this search" />
        )}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
