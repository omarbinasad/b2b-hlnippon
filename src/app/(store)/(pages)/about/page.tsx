import type { Metadata } from "next";
import { ImageSlot } from "@/components/storefront/image-slot";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { applyCta } from "@/config/site";
import { expectedImageFiles } from "@/config/storefront";
import { repositories } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const { about } = await repositories.siteContent.get();
  return { title: "About us", description: about.text };
}

const eyebrow = "text-xs font-semibold tracking-[0.14em] text-cta-from uppercase";

export default async function AboutPage() {
  const { about: a } = await repositories.siteContent.get();
  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Intro */}
      <section aria-labelledby="about-title" className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className={eyebrow}>{a.eyebrow}</p>
          <h1 id="about-title" className="mt-2 font-serif text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-5xl">{a.title}</h1>
          <p className="mt-4 text-base text-muted sm:text-lg">{a.text}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/shop">Browse catalog <Icon name="arrowRight" className="size-4" /></ButtonLink>
            <ButtonLink href="/contact" variant="secondary">Contact us</ButtonLink>
          </div>
        </div>
        <ImageSlot
          image={a.image}
          imageClassName="object-top"
          original
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          placeholder={expectedImageFiles.owner}
          className="aspect-[4/3] rounded-[1.25rem]"
        />
      </section>

      {/* Mission and vision */}
      <section aria-label="Mission and vision" className="grid gap-4 md:grid-cols-2 md:gap-6">
        {a.pillars.map((p) => (
          <article key={p.title} className="relative isolate overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-hero-from to-hero-to p-6 text-hero-text sm:p-8">
            <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(var(--hero-tile)_1.5px,transparent_2px)] [background-size:26px_26px]" />
            <span aria-hidden className="grid size-12 place-items-center rounded-full border border-hero-muted/40 bg-hero-tile text-hero-accent">
              <Icon name={p.icon as IconName} className="size-6" />
            </span>
            <h2 className="mt-4 font-serif text-2xl font-semibold sm:text-3xl">{p.title}</h2>
            <p className="mt-3 text-base leading-7 text-hero-muted">{p.text}</p>
          </article>
        ))}
      </section>

      {/* Values */}
      <section aria-labelledby="values-title">
        <p className={eyebrow}>{a.valuesEyebrow}</p>
        <h2 id="values-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{a.valuesTitle}</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {a.values.map((v) => (
            <li key={v.title} className="rounded-ui border border-line bg-surface p-5 shadow-sm">
              <span aria-hidden className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon name={v.icon as IconName} className="size-5" />
              </span>
              <h3 className="mt-3 font-semibold">{v.title}</h3>
              <p className="mt-1 text-sm text-muted">{v.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Who we serve */}
      <section aria-labelledby="serve-title" className="rounded-[1.25rem] border border-line bg-brand-soft/50 p-5 sm:p-8">
        <p className={eyebrow}>{a.serveEyebrow}</p>
        <h2 id="serve-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{a.serveTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{a.serveText}</p>
        <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {a.serve.map((s) => (
            <li key={s.title} className="flex min-w-0 items-center gap-3 rounded-ui border border-line bg-surface p-3 sm:p-4">
              <Icon name={s.icon as IconName} className="size-5 shrink-0 text-brand" />
              <span className="min-w-0 text-sm font-semibold">{s.title}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Call to action */}
      <section aria-labelledby="about-cta" className="flex flex-col items-start justify-between gap-4 rounded-[1.25rem] bg-brand p-6 text-brand-contrast sm:flex-row sm:items-center sm:p-8">
        <div>
          <h2 id="about-cta" className="text-2xl font-semibold tracking-tight">{a.ctaTitle}</h2>
          <p className="mt-1 text-sm opacity-90">{a.ctaText}</p>
        </div>
        <ButtonLink href={applyCta.href} variant="secondary" size="lg" className="shrink-0">
          {applyCta.label} <Icon name="arrowRight" className="size-4" />
        </ButtonLink>
      </section>
    </div>
  );
}
