import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { expectedImageFiles } from "@/config/storefront";
import { ProductCard, type CardAction } from "@/components/product/product-card";
import type { PriceAccess } from "@/components/shop/filter-sidebar";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import type { BlogPostSummary, Category, CtaLink, Money, ProductSummary, HeroSlide as HeroSlideContent, HomeSection, BrandFacet } from "@/lib/types";
import { HeroSlider } from "./hero-slider";
import { HeroPhoto } from "./hero-photo";
import { ImageSlot } from "./image-slot";

/* Home page sections (Server Components). Content comes from the admin Homepage screen via repositories.siteContent. */

export const wrap = "mx-auto w-full max-w-site px-4 sm:px-6";

/** Section of a given type, with its content fields. */
type Sec<T extends HomeSection["type"]> = Extract<HomeSection, { type: T }>;
const icon = (name: string) => name as IconName;
const iconName = icon;
const Cta = ({ link }: { link: CtaLink }) => <>{link.label}<Icon name="arrowRight" className="size-4" /></>;

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold tracking-[0.14em] text-cta-from uppercase">{children}</p>;
}

export function SectionHeading({ id, eyebrow, title, action }: { id: string; eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={id} className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href as "/shop"} className="inline-flex items-center gap-1 text-sm font-semibold text-brand underline-offset-4 hover:underline">
      {children} <Icon name="arrowRight" className="size-4" />
    </Link>
  );
}

/**
 * Photo slide, built to the owner's design: the photo fills the slide and the copy sits on a frosted card on the left.
 * Each theme has its own photo; the card is the same in both, slightly see-through so the photo shows behind it like glass.
 * The heading is Poppins, as in the design, unless Company & Branding chooses a heading font. From 1280px the slide keeps the photo's proportions and everything on
 * the card is sized against the slide's width (cqw), so it lines up with the photo at any width. Below that the photo is
 * cropped to its right-hand side and the card sits over the left. On phones the slide is a little wider than tall and
 * shows the phone photo when there is one; the card sits across the bottom, compact and centred, without the
 * description, and its two links stay on one row.
 */
function PhotoHeroSlide({ slide, image, first, pager }: { slide: HeroSlideContent; image: NonNullable<HeroSlideContent["image"]>; first: boolean; /** Room is left at the bottom for the pagination notch. */ pager: boolean }) {
  const Heading = first ? "h1" : "h2";
  return (
    <div className="@container relative isolate aspect-[10/9] min-h-[18rem] sm:aspect-auto sm:min-h-[32rem] xl:aspect-[2089/753] xl:min-h-0">
      <HeroPhoto image={image} imageDark={slide.imageDark} imageMobile={slide.imageMobile} imageMobileDark={slide.imageMobileDark} first={first} />
      <div
        className={[
          "absolute inset-x-2.5 flex flex-col justify-center border text-center sm:text-left border-hero-glass-line bg-hero-glass p-3.5 text-hero-glass-ink backdrop-blur-md backdrop-saturate-150 sm:inset-x-auto sm:top-6 sm:left-6 sm:w-[min(36rem,64%)] sm:p-8",
          pager ? "bottom-11 sm:bottom-12" : "bottom-3 sm:bottom-6",
          // A light edge along the top and a soft shadow make it read as glass.
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_10px_40px_rgb(0_0_0/0.16)]",
          // Same place in both photos: where the larger card was drawn in the designs, so it covers both.
          "rounded-2xl xl:top-[8.37%] xl:bottom-auto xl:left-[3.11%] xl:h-[81%] xl:w-[40.79%] xl:rounded-[1.3cqw] xl:px-[2.9cqw] xl:py-[2.6cqw]",
        ].join(" ")}
      >
        {slide.eyebrow && (
          <div className="flex items-center gap-3 xl:gap-[0.9cqw]">
            {/* On phones the copy is centred, so the line runs on both sides of the badge. */}
            <span aria-hidden="true" className="h-0.5 min-w-6 flex-1 rounded-full bg-hero-badge-to/80 sm:hidden" />
            <p className="shrink-0 rounded-full bg-gradient-to-b from-hero-badge-from to-hero-badge-to px-3 py-0.5 text-[0.6875rem] font-bold tracking-wide text-white uppercase shadow-sm sm:px-3.5 sm:py-1 sm:text-sm xl:px-[1.1cqw] xl:py-[0.38cqw] xl:text-[1.35cqw] xl:leading-none">{slide.eyebrow}</p>
            <span aria-hidden="true" className="h-0.5 min-w-6 flex-1 rounded-full bg-hero-badge-to/80" />
          </div>
        )}
        <Heading className="mt-2 font-[family-name:var(--font-heading,var(--font-poppins))] text-2xl leading-[1.05] sm:mt-3 sm:leading-[1.02] font-bold tracking-[-0.02em] sm:text-[2.6rem] xl:mt-[1.5cqw] xl:text-[3.3cqw] xl:leading-[0.98]">{slide.title}</Heading>
        <p className="mt-3 hidden leading-snug text-hero-glass-muted sm:block sm:text-lg xl:mt-[1.1cqw] xl:text-[1.32cqw] xl:leading-[1.32]">{slide.description}</p>
        <div className="mt-3 flex flex-nowrap items-center justify-center gap-3 sm:mt-5 sm:justify-start sm:flex-wrap sm:gap-x-8 sm:gap-y-3 xl:mt-[1.8cqw] xl:flex-col xl:items-start xl:gap-[1cqw]">
          <Link
            href={slide.cta.href as "/shop"}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-hero-cta-from to-hero-cta-to px-3.5 text-[0.8125rem] font-semibold whitespace-nowrap text-white sm:h-12 sm:gap-2.5 sm:px-6 shadow-lg shadow-black/20 transition hover:brightness-110 sm:text-lg xl:h-[3.3cqw] xl:gap-[0.9cqw] xl:rounded-[0.75cqw] xl:px-[1.9cqw] xl:text-[1.5cqw]"
          >
            {slide.cta.label}
            <Icon name="arrowRight" className="size-4 sm:size-5 xl:size-[1.5cqw]" />
          </Link>
          {slide.secondaryCta?.label && (
            <Link href={slide.secondaryCta.href as "/shop"} className="min-w-0 text-[0.8125rem] leading-tight font-semibold underline decoration-2 underline-offset-4 hover:opacity-80 sm:border-b-2 sm:border-current sm:pb-0.5 sm:text-lg sm:no-underline xl:text-[1.36cqw] xl:leading-tight">
              {slide.secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** One hero slide: brand-green card with copy on the left and an icon grid on the right, or the photo layout when it has an image. */
function HeroSlide({ slide, first, highlights, pager }: { slide: HeroSlideContent; first: boolean; highlights: Sec<"hero">["highlights"]; pager: boolean }) {
  const Heading = first ? "h1" : "h2";
  const image = slide.image;
  if (image) return <PhotoHeroSlide slide={slide} image={image} first={first} pager={pager} />;
  return (
    <div className="relative isolate flex min-h-[32rem] items-center bg-gradient-to-br from-hero-from to-hero-to text-hero-text sm:min-h-[30rem]">
      {image ? (
        <>
          <div className="absolute inset-0 -z-20">
            <ImageSlot image={image} sizes="(min-width: 1280px) 1280px, 100vw" original priority={first} placeholder={expectedImageFiles.hero} decorativeAlt="" labelPosition="corner" className="h-full w-full" />
          </div>
          {/* Keeps the copy readable over the photo: solid on the left, opening up to the right on large screens. */}
          <div className="absolute inset-0 -z-10 bg-hero-to/80 lg:bg-transparent lg:bg-gradient-to-r lg:from-hero-to lg:via-hero-to/85 lg:to-hero-to/10" />
        </>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(var(--hero-tile)_1.5px,transparent_2px)] [background-size:26px_26px]" />
      )}

      <div className="grid w-full items-center gap-10 px-6 pt-10 pb-20 sm:px-20 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:px-24 lg:pb-16">
        <div className="max-w-xl">
          <p className="inline-block rounded-full bg-gradient-to-r from-cta-from to-cta-to px-3 py-1 text-xs font-semibold text-white">{slide.eyebrow}</p>
          <Heading className="mt-4 font-serif text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">{slide.title}</Heading>
          <p className="mt-4 text-base text-hero-muted sm:text-lg">{slide.description}</p>
          <Link
            href={slide.cta.href as "/shop"}
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-cta-from to-cta-to px-7 text-base font-semibold text-white shadow-lg shadow-black/20 transition hover:brightness-110"
          >
            {slide.cta.label}
            <Icon name="arrowRight" className="size-5" />
          </Link>
          <ul className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
            {highlights.map((h) => (
              <li key={h.label} className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] font-medium sm:gap-2.5 sm:text-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-hero-muted/40 bg-hero-tile text-hero-accent sm:size-10">
                  <Icon name={icon(h.icon)} className="size-3.5 sm:size-5" />
                </span>
                <span className="min-w-0 leading-tight sm:max-w-24">{h.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {!image && slide.icons.length > 0 && (
          <div aria-hidden="true" className="relative hidden justify-self-center lg:block">
            <div className="absolute inset-6 -z-10 rounded-full bg-hero-accent/20 blur-3xl" />
            <ul className="grid grid-cols-3 gap-4">
              {slide.icons.map((ic, i) => (
                <li key={`${ic}-${i}`} className={`grid size-24 place-items-center rounded-3xl border border-hero-muted/20 bg-hero-tile backdrop-blur-sm ${i % 2 === 0 ? "text-hero-accent" : "text-hero-text"} ${i === 4 ? "bg-hero-muted/20" : ""}`}>
                  <Icon name={iconName(ic)} className="size-8" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function Hero({ section }: { section: Sec<"hero"> }) {
  const { slides, highlights } = section;
  return (
    <section aria-label="Featured" className={`${wrap} pt-4 pb-2 sm:pt-6`}>
      <HeroSlider
        label="Featured"
        arrows={!slides.some((s) => s.image)}
        slides={slides.map((slide, i) => ({ key: `${i}-${slide.title}`, label: slide.title, content: <HeroSlide slide={slide} first={i === 0} highlights={highlights} pager={slides.length > 1} /> }))}
      />
    </section>
  );
}

export function Benefits({ section }: { section: Sec<"benefits"> }) {
  return (
    <section aria-label="Why buy from us" className="border-b border-line bg-surface">
      <ul className={`${wrap} grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4 lg:divide-x lg:divide-line`}>
        {section.items.map((b) => (
          <li key={b.title} className="flex items-start gap-3 lg:px-5 lg:first:pl-0">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-brand/30 text-brand">
              <Icon name={icon(b.icon)} className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{b.title}</span>
              <span className="block text-xs text-muted">{b.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CategoryGrid({ section, categories }: { section: Sec<"categories">; categories: Category[] }) {
  return (
    <section id="categories" aria-labelledby="categories-title" className={`${wrap} scroll-mt-40 py-12`}>
      <SectionHeading id="categories-title" eyebrow={section.eyebrow} title={section.title} action={<ArrowLink href="/shop">View all products</ArrowLink>} />
      {/* Phones and tablets: swipeable row (scroll snap, next card peeks in). Desktop: 7 per row. */}
      <ul
        tabIndex={0}
        aria-label="Categories"
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-focus sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => (
          <li key={c.id} className="w-[42%] shrink-0 snap-start sm:w-[28%] md:w-[22%] lg:w-auto">
            <Link href={`/shop?category=${c.slug}`} className="group block h-full overflow-hidden rounded-ui border border-line bg-surface shadow-sm transition hover:border-brand hover:shadow-md">
              <ImageSlot
                image={c.image ? { src: c.image.src, alt: c.image.alt, width: c.image.width, height: c.image.height } : null}
                sizes="(min-width: 1024px) 14vw, (min-width: 768px) 22vw, (min-width: 640px) 28vw, 42vw"
                placeholder={expectedImageFiles.category(c.slug)}
                compact
                decorativeAlt=""
                className="aspect-[4/3]"
              />
              <span className="block px-3 py-2.5 text-center text-sm font-medium group-hover:text-brand">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BusinessSection({ section: b }: { section: Sec<"business"> }) {
  return (
    <section aria-labelledby="business-title" className={`${wrap} py-12`}>
      <div className="grid gap-7 rounded-md bg-panel-warm p-4 sm:p-8 xl:grid-cols-[minmax(0,1.26fr)_minmax(0,1fr)]">
        <div className="grid overflow-hidden rounded-[1.25rem] border border-panel-warm-line bg-surface sm:grid-cols-[53%_minmax(0,1fr)]">
          <ImageSlot
            image={b.image}
            imageClassName="object-[50%_15%]"
            // Full-resolution original (already .webp): no optimizer resize/re-compression blur.
            original
            sizes="(min-width: 1280px) 26vw, (min-width: 640px) 50vw, 100vw"
            placeholder={expectedImageFiles.owner}
            className="aspect-[4/3] w-full sm:aspect-auto sm:h-full sm:min-h-[29.75rem]"
          />
          <div className="flex flex-col justify-center px-6 py-8 sm:px-8 xl:px-9">
            {b.eyebrow && <div className="mb-2"><Eyebrow>{b.eyebrow}</Eyebrow></div>}
            <h2 id="business-title" className="max-w-[16rem] font-serif text-4xl leading-[1.05] font-bold tracking-tight xl:text-[2.5rem] min-[1400px]:text-[2.75rem]">{b.title}</h2>
            <p className="mt-6 text-base leading-relaxed text-foreground">{b.text}</p>
            <ButtonLink href={b.cta.href as "/shop"} variant="secondary" className="mt-7 h-[2.875rem]! self-start border-foreground! px-5! font-semibold">{b.cta.label}</ButtonLink>
          </div>
        </div>
        <ul className="flex flex-col divide-y divide-panel-warm-line rounded-[1.25rem] border border-panel-warm-line bg-surface px-5 sm:px-7">
          {b.cards.map((c) => (
            <li key={c.title} className="flex flex-1 items-center gap-5 py-6 sm:gap-6">
              <Icon name={icon(c.icon)} className="size-11 shrink-0 text-foreground [stroke-width:1.25]" />
              <div className="min-w-0">
                <p className="font-serif text-[1.375rem] leading-tight font-bold tracking-tight">{c.title}</p>
                <p className="mt-1.5 text-sm text-foreground">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function BrandsSection({ section, brands }: { section: Sec<"brands">; brands: BrandFacet[] }) {
  if (!brands.length) return null;
  return (
    <section aria-labelledby="brands-title" className="bg-surface-muted py-10">
      <div className={wrap}>
        <div className="border-b border-line text-center">
          <h2 id="brands-title" className="-mb-px inline-block border-b border-foreground px-1 pb-2.5 font-serif text-xl font-normal tracking-wide uppercase">{section.title}</h2>
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-4">
          {brands.map((b) => {
            const tile = (
              <>
                {b.logo ? (
                  <Image src={b.logo.src} alt={b.logo.alt || `${b.name} logo`} fill sizes="(min-width: 1024px) 12rem, (min-width: 640px) 25vw, 50vw" unoptimized={b.logo.src.startsWith("/media/")} loading="lazy" className="object-contain p-3" />
                ) : (
                  <span className="px-3 text-center text-sm font-semibold">{b.name}</span>
                )}
              </>
            );
            const box = "relative grid h-[5.75rem] w-full place-items-center overflow-hidden rounded-md border border-line bg-logo-tile text-logo-tile-ink";
            return (
              <li key={b.id} className="w-[calc((100%-1rem)/2)] sm:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-6rem)/7)]">
                {b.productCount > 0 ? (
                  <Link href={`/shop?brand=${b.slug}`} aria-label={`${b.name} products`} className={`${box} transition-shadow hover:shadow-md`}>{tile}</Link>
                ) : (
                  <div className={box}>{tile}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function DeliverySection({ section: d, children }: { section: Sec<"delivery">; children: ReactNode }) {
  return (
    <section id="delivery" aria-labelledby="delivery-title" className={`${wrap} scroll-mt-40 py-6`}>
      <div className="grid gap-6 overflow-hidden rounded-[1.25rem] border border-line bg-brand-soft/60 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <Eyebrow>{d.eyebrow}</Eyebrow>
          <h2 id="delivery-title" className="mt-2 max-w-md text-3xl font-semibold tracking-tight">{d.title}</h2>
          <p className="mt-2 text-sm text-muted">{d.text}</p>
          <div className="mt-5">{children}</div>
        </div>
        <ImageSlot image={d.image} sizes="(min-width: 1024px) 45vw, 100vw" placeholder={expectedImageFiles.delivery} decorativeAlt="" className="aspect-[16/9] w-full rounded-ui" />
      </div>
    </section>
  );
}

/** One look per position (the content has none): icon, title colour and badge colour. A fifth step starts again. */
const STEP_LOOKS = [
  { icon: "user", text: "text-step-1", badge: "bg-step-1-badge" },
  { icon: "store", text: "text-step-2", badge: "bg-step-2-badge" },
  { icon: "check", text: "text-step-3", badge: "bg-step-3-badge" },
  { icon: "cart", text: "text-step-4", badge: "bg-step-4-badge" },
] as const;

/**
 * "How it works", to the owner's design: each step is a soft round card with a numbered badge, an icon, a coloured title
 * and a short text, with arrows between them from 1280px. Two per row on tablets and small laptops, one per row on phones.
 */
export function Steps({ section }: { section: Sec<"steps"> }) {
  const last = section.items.length - 1;
  return (
    <section aria-labelledby="steps-title" className={`${wrap} py-12`}>
      <SectionHeading id="steps-title" eyebrow={section.eyebrow} title={section.title} />
      <ol className="mt-10 grid justify-items-center gap-x-10 gap-y-14 sm:grid-cols-2 xl:flex xl:items-center xl:justify-center xl:gap-0">
        {section.items.map((s, i) => {
          const look = STEP_LOOKS[i % STEP_LOOKS.length];
          return (
            <li key={`${i}-${s.title}`} className="flex items-center xl:flex-1 xl:justify-center">
              <div className="relative">
                <div className="grid size-56 place-items-center rounded-full bg-surface text-center shadow-[0_14px_34px_rgb(0_0_0/0.09)] ring-[12px] ring-step-ring xl:size-52 2xl:size-56">
                  <div className="flex w-[72%] flex-col items-center">
                    <Icon name={look.icon} className={`size-6 ${look.text}`} />
                    <h3 className={`mt-1.5 text-lg leading-tight font-bold ${look.text}`}>{s.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted 2xl:text-[0.8125rem]">{s.text}</p>
                  </div>
                </div>
                <span aria-hidden="true" className={`absolute -top-2 right-1 grid size-13 place-items-center rounded-full border-4 border-surface text-lg font-bold text-white shadow-md ${look.badge}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="sr-only">Step {i + 1}: </span>
              </div>
              {i < last && <Icon name="arrowRight" className="ml-4 hidden size-7 shrink-0 text-foreground xl:block 2xl:ml-6" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Article card: image, topic, title, summary and Read more (Home journal section, "More guides" on an article). */
export function JournalCard({ post }: { post: BlogPostSummary }) {
  const href = `/blog/${post.slug}` as const;
  return (
    <article className="grid h-full grid-cols-[7rem_minmax(0,1fr)] gap-3 rounded-ui border border-line bg-surface p-3 shadow-sm transition hover:border-brand sm:grid-cols-[8rem_minmax(0,1fr)]">
      <ImageSlot image={post.image} sizes="128px" placeholder={expectedImageFiles.journal(post.slug)} compact decorativeAlt="" className="aspect-square rounded-ui" />
      <div className="flex min-w-0 flex-col">
        <p className="text-[11px] font-semibold tracking-wide text-brand uppercase">{post.tag}</p>
        <h3 className="mt-1 text-sm leading-snug font-semibold">
          <Link href={href} className="hover:text-brand hover:underline">{post.title}</Link>
        </h3>
        <p className="mt-1 line-clamp-3 text-xs text-muted">{post.excerpt}</p>
        <ButtonLink href={href} variant="secondary" size="sm" aria-label={`Read more: ${post.title}`} className="mt-3 w-fit self-start lg:mt-auto">
          Read more <Icon name="arrowRight" className="size-3.5" />
        </ButtonLink>
      </div>
    </article>
  );
}

export function Journal({ section, posts }: { section: Sec<"journal">; posts: BlogPostSummary[] }) {
  return (
    <section id="journal" aria-labelledby="journal-title" className={`${wrap} scroll-mt-40 pb-12`}>
      <SectionHeading id="journal-title" eyebrow={section.eyebrow} title={section.title} action={<ArrowLink href="/blog">View all</ArrowLink>} />
      <ul className="grid gap-4 lg:grid-cols-3">
        {posts.map((post) => <li key={post.id}><JournalCard post={post} /></li>)}
      </ul>
    </section>
  );
}

export function ContactStrip({ section: c }: { section: Sec<"contact"> }) {
  return (
    <section aria-labelledby="contact-strip-title" className="bg-brand text-brand-contrast">
      <div className={`${wrap} flex flex-wrap items-center justify-between gap-4 py-7`}>
        <div>
          <h2 id="contact-strip-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.title}</h2>
          <p className="mt-1 text-sm opacity-90">{c.text}</p>
        </div>
        <Link href={c.cta.href as "/shop"} className="inline-flex h-11 items-center gap-2 rounded-ui bg-surface px-5 text-sm font-semibold text-foreground hover:bg-surface-muted">
          {c.cta.label} <Icon name="arrowRight" className="size-4" />
        </Link>
      </div>
    </section>
  );
}

export function Promo({ section: p }: { section: Sec<"promo"> }) {
  return (
    <section aria-labelledby={`promo-${p.id}`} className={`${wrap} py-6`}>
      <div className="grid items-center gap-6 overflow-hidden rounded-[1.25rem] border border-line bg-brand-soft/60 p-5 sm:p-8 lg:grid-cols-2">
        <div>
          <Eyebrow>{p.eyebrow}</Eyebrow>
          <h2 id={`promo-${p.id}`} className="mt-2 text-3xl font-semibold tracking-tight">{p.title}</h2>
          <p className="mt-2 text-sm text-muted">{p.text}</p>
          <ButtonLink href={p.cta.href as "/shop"} className="mt-5"><Cta link={p.cta} /></ButtonLink>
        </div>
        {p.image && <ImageSlot image={p.image} sizes="(min-width: 1024px) 45vw, 100vw" placeholder="" decorativeAlt="" className="aspect-[16/9] w-full rounded-ui" />}
      </div>
    </section>
  );
}

export function FeaturedProducts({ section, access, cards }: { section: Sec<"featuredProducts">; access: PriceAccess; cards: { product: ProductSummary; price?: Money; action: CardAction }[] }) {
  if (!cards.length) return null;
  return (
    <section id="featured" aria-labelledby="featured-title" className={`${wrap} scroll-mt-40 pb-12`}>
      <SectionHeading id="featured-title" eyebrow={section.eyebrow} title={section.title} action={<ArrowLink href="/shop">View all products</ArrowLink>} />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {cards.map(({ product, price, action }) => <li key={product.id}><ProductCard product={product} price={price} access={access} action={action} /></li>)}
      </ul>
    </section>
  );
}
