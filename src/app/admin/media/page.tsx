import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { MediaLibrary } from "@/components/admin/media/media-library";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { repositories } from "@/lib/data";
import type { MediaSortField } from "@/lib/data/repositories";
import { flatParams, listState, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Media library" };

const PATH = "/admin/media";
const SORTS = ["date", "name", "size"] as const satisfies readonly MediaSortField[];
const KINDS = ["image", "document"] as const;

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "date");
  const result = await repositories.media.list({ ...state, kind: oneOf(param(sp, "kind"), KINDS), perPage: 24 });
  const params = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };
  return (
    <>
      <PageHeader title="Media library" description="Images and files for pages, posts, the homepage and branding." />
      <MediaLibrary items={result.items}>
        <ListToolbar
          pathname={PATH}
          params={params}
          searchLabel="Search media"
          searchPlaceholder="Title or file name"
          filters={[{ name: "kind", label: "Type", options: [{ value: "image", label: "Images" }, { value: "document", label: "Documents" }], allLabel: "All types" }]}
          total={result.total}
          page={result.page}
          perPage={result.perPage}
        />
        <table className="mb-4 text-sm">
          <caption className="sr-only">Sort media</caption>
          <thead>
            <tr className="flex flex-wrap items-center gap-3 text-muted">
              <th scope="col" className="font-normal">Sort by</th>
              <SortHeader label="Newest" field="date" defaultDir="desc" {...sorting} />
              <SortHeader label="Name" field="name" {...sorting} />
              <SortHeader label="Size" field="size" defaultDir="desc" {...sorting} />
            </tr>
          </thead>
        </table>
      </MediaLibrary>
      {!result.items.length && <EmptyState title="No files found" description="Upload an image or change your search." />}
      <div className="mt-6 space-y-6">
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice images />
      </div>
    </>
  );
}
