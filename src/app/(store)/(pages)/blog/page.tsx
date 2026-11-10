import type { Metadata } from "next";
import Link from "next/link";
import { CategoryCheckbox } from "@/components/storefront/blog-filters";
import { JournalCard } from "@/components/storefront/home-sections";
import { ImageSlot } from "@/components/storefront/image-slot";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { expectedImageFiles } from "@/config/storefront";
import { repositories } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/format";
import { param } from "@/lib/list-params";
import type { BlogPostSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Journal", description: "Guides and news from our wholesale team." };

const PATH = "/blog";
const PER_PAGE = 12;

function Suggested({ posts, className }: { posts: BlogPostSummary[]; className?: string }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="suggested-heading" className={className}>
      <h2 id="suggested-heading" className="text-sm font-semibold">Suggested articles</h2>
      <ul className="mt-3 space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
            <ImageSlot image={p.image} sizes="64px" placeholder={expectedImageFiles.journal(p.slug)} compact decorativeAlt="" className="aspect-square rounded-ui" />
            <span className="min-w-0">
              <Link href={`/blog/${p.slug}`} className="line-clamp-2 text-sm leading-snug font-medium hover:text-brand hover:underline">{p.title}</Link>
              {p.publishedAt && <span className="mt-0.5 block text-xs text-muted">{formatDate(p.publishedAt)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BlogArchivePage({ searchParams }: PageProps<"/blog">) {
  const sp = await searchParams;
  const search = param(sp, "q");
  const raw = sp.category;
  const chosen = [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => c.trim()).filter(Boolean))].slice(0, 20);
  const page = Number(param(sp, "page")) || 1;
  const [result, categories, suggested] = await Promise.all([
    repositories.posts.archive({ search, categories: chosen, page, perPage: PER_PAGE }),
    repositories.posts.categories(),
    repositories.posts.list({ limit: 4 }),
  ]);
  const filtered = Boolean(search) || chosen.length > 0;
  const from = result.total ? (result.page - 1) * result.perPage + 1 : 0;
  const to = Math.min(result.page * result.perPage, result.total);

  return (
    <>
      <PageHeader title="Journal" description="Guides and news from our wholesale team." />
      <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside aria-label="Filter articles" className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <form action={PATH} role="search" className="space-y-5 rounded-ui border border-line bg-surface p-4">
            <div>
              <label htmlFor="blog-q" className="text-sm font-semibold">Search articles</label>
              <div className="mt-2 flex gap-2">
                <input id="blog-q" name="q" type="search" defaultValue={search ?? ""} placeholder="Search articles" className="h-10 min-w-0 flex-1 rounded-ui border border-line bg-surface px-3 text-sm focus:border-brand focus:ring-3 focus:ring-brand/25 focus:outline-none" />
                <Button type="submit" variant="secondary" aria-label="Search" className="h-10 px-3"><Icon name="search" className="size-4" /></Button>
              </div>
            </div>
            {categories.length > 0 && (
              <fieldset>
                <legend className="text-sm font-semibold">Categories</legend>
                <div className="mt-2 -mx-2 grid gap-0.5">
                  {categories.map((c) => <CategoryCheckbox key={c} name="category" value={c} label={c} checked={chosen.includes(c)} />)}
                </div>
              </fieldset>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm">Apply filters</Button>
              {filtered && <Link href={PATH} className="text-sm font-medium text-brand hover:underline">Clear</Link>}
            </div>
          </form>
          <Suggested posts={suggested} className="hidden rounded-ui border border-line bg-surface p-4 lg:block" />
        </aside>

        <div className="min-w-0">
          <p role="status" className="mb-4 text-sm text-muted">
            {result.total ? `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(result.total)} articles` : "No articles"}
            {chosen.length > 0 && <> in {chosen.join(", ")}</>}
            {search && <> matching “{search}”</>}
          </p>
          {result.items.length ? (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((post) => <li key={post.id}><JournalCard post={post} /></li>)}
            </ul>
          ) : (
            <EmptyState title="No articles found" description={filtered ? "Try another search or fewer categories." : undefined} action={filtered ? <Link href={PATH} className="text-sm font-medium text-brand hover:underline">Clear filters</Link> : undefined} />
          )}
          <div className="mt-6"><Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={{ ...(search ? { q: search } : {}), category: chosen }} /></div>
        </div>

        <Suggested posts={suggested} className="rounded-ui border border-line bg-surface p-4 lg:hidden" />
      </div>
    </>
  );
}
