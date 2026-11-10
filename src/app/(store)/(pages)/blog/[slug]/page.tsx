import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JournalCard } from "@/components/storefront/home-sections";
import { ImageSlot } from "@/components/storefront/image-slot";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { RichText } from "@/components/ui/rich-text";
import { expectedImageFiles } from "@/config/storefront";
import { seoMetadata } from "@/lib/content/seo";
import { repositories } from "@/lib/data";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await repositories.posts.getBySlug((await params).slug);
  return post ? seoMetadata(post, `/blog/${post.slug}`) : {};
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await repositories.posts.getBySlug(slug);
  if (!post) notFound();
  const more = await repositories.posts.list({ excludeSlug: post.slug, limit: 3 });

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span aria-hidden>/</span>
        <Link href="/blog" className="hover:text-foreground">Journal</Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="min-w-0 truncate">{post.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <article className="min-w-0">
          <header>
            <p className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">{post.tag}</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-5xl">{post.title}</h1>
            <p className="mt-3 text-base text-muted sm:text-lg">{post.excerpt}</p>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><Icon name="user" className="size-4" /> {post.authorName}</span>
              <span className="inline-flex items-center gap-1.5"><Icon name="calendar" className="size-4" /> {post.publishedAt && <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>}</span>
              <span>{post.readingMinutes} min read</span>
            </p>
          </header>

          <ImageSlot
            image={post.image}
            sizes="(min-width: 1024px) 60vw, 100vw"
            priority
            placeholder={expectedImageFiles.journal(post.slug)}
            decorativeAlt={post.image?.alt ?? ""}
            className="mt-6 aspect-[16/9] rounded-ui"
          />

          <RichText
            rich
            value={post.bodyHtml}
            className="mt-8 max-w-2xl !space-y-4 text-base leading-7 [&_h2]:!mt-8 [&_h2]:!text-xl [&_h2]:leading-snug sm:[&_h2]:!text-2xl [&_ul]:space-y-1.5"
          />

          {post.tags.length > 0 && (
            <ul aria-label="Tags" className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((t) => <li key={t} className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">{t}</li>)}
            </ul>
          )}
        </article>

        <aside aria-label="Order from us" className="lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-ui bg-gradient-to-br from-hero-from to-hero-to p-5 text-hero-text">
            <h2 className="text-lg font-semibold">Ready to restock?</h2>
            <p className="mt-1 text-sm text-hero-muted">Browse the catalog, or add several products to your cart at once.</p>
            <div className="mt-4 grid gap-2">
              <ButtonLink href="/shop" variant="secondary">Browse catalog</ButtonLink>
              <Link href="/#quick-order" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-ui border border-hero-muted/40 text-sm font-medium hover:bg-hero-tile">
                Quick order <Icon name="arrowRight" className="size-4" />
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {more.length > 0 && (
        <section aria-labelledby="more-guides" className="mt-12 border-t border-line pt-8">
          <h2 id="more-guides" className="text-2xl font-semibold tracking-tight">More guides</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {more.map((p) => <li key={p.id}><JournalCard post={p} /></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
