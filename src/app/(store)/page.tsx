import { DeliveryLookup, type PrefectureDelivery } from "@/components/storefront/delivery-lookup";
import {
  ArrowLink,
  Benefits,
  BrandsSection,
  BusinessSection,
  CategoryGrid,
  ContactStrip,
  DeliverySection,
  FeaturedProducts,
  Hero,
  Journal,
  Promo,
  SectionHeading,
  Steps,
  wrap,
} from "@/components/storefront/home-sections";
import { QuickOrderSheet } from "@/components/quick-order/quick-order-sheet";
import { repositories } from "@/lib/data";
import { allPages } from "@/lib/data/all-pages";
import { regionNames } from "@/lib/locations";
import { getHomeCategories } from "@/lib/storefront/home";
import { loadFeaturedProducts } from "@/lib/storefront/product-cards";
import { loadQuickOrderSheet } from "@/lib/storefront/quick-order";
import type { DeliveryRoute, HomeSection } from "@/lib/types";

const DAY: Record<string, string> = { sat: "Sat", sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" };

/** Prefecture → the existing delivery route that lists it (sample route data). */
function prefectureRoutes(routes: DeliveryRoute[]): PrefectureDelivery[] {
  // A country without a region list offers the areas the routes cover.
  const list = regionNames();
  const areas = list.length ? list : [...new Set(routes.flatMap((r) => r.areas))];
  return areas.map((prefecture) => {
    const r = routes.find((x) => x.active && x.areas.some((a) => a.toLowerCase() === prefecture.toLowerCase()));
    return { prefecture, route: r && { name: r.name, days: r.deliveryDays.map((d) => DAY[d] ?? d).join(", "), cutoff: r.cutoffTime } };
  });
}

export default async function HomePage() {
  const { sections } = await repositories.siteContent.get();
  const on = sections.filter((x) => x.enabled);
  const has = <T extends HomeSection["type"]>(type: T) => on.find((x): x is Extract<HomeSection, { type: T }> => x.type === type);
  // Only what the visible sections need is loaded.
  const categoriesSection = has("categories");
  const featuredSection = has("featuredProducts");
  const journalSection = has("journal");
  const brandsSection = has("brands");
  const [categories, featured, quickOrder, routes, posts, brands] = await Promise.all([
    categoriesSection ? getHomeCategories(categoriesSection.slugs, categoriesSection.max) : [],
    featuredSection ? loadFeaturedProducts(featuredSection.max) : null,
    // Resolved per request for the current viewer: prices only for approved customers.
    has("quickOrder") ? loadQuickOrderSheet() : null,
    has("delivery") ? allPages((page, perPage) => repositories.delivery.listRoutes({ page, perPage })) : null,
    journalSection ? repositories.posts.list({ limit: journalSection.max }) : [],
    brandsSection ? repositories.products.featuredBrands(brandsSection.max) : [],
  ]);

  return (
    <div className="bg-surface">
      {on.map((section) => {
        switch (section.type) {
          case "hero":
            return <Hero key={section.id} section={section} />;
          case "benefits":
            return <Benefits key={section.id} section={section} />;
          case "categories":
            return <CategoryGrid key={section.id} section={section} categories={categories} />;
          case "featuredProducts":
            return featured && <FeaturedProducts key={section.id} section={section} {...featured} />;
          case "quickOrder":
            return (
              quickOrder && (
                <section key={section.id} id="quick-order" aria-labelledby="quick-order-title" className={`${wrap} scroll-mt-40 pb-12`}>
                  <SectionHeading id="quick-order-title" title={section.title} action={<ArrowLink href="/shop">View full catalog</ArrowLink>} />
                  <p className="-mt-3 mb-4 text-sm text-muted">{section.text}</p>
                  <QuickOrderSheet {...quickOrder} />
                </section>
              )
            );
          case "business":
            return <BusinessSection key={section.id} section={section} />;
          case "brands":
            return <BrandsSection key={section.id} section={section} brands={brands} />;
          case "promo":
            return <Promo key={section.id} section={section} />;
          case "delivery":
            return (
              <DeliverySection key={section.id} section={section}>
                <DeliveryLookup prefectures={prefectureRoutes(routes ?? [])} />
              </DeliverySection>
            );
          case "steps":
            return <Steps key={section.id} section={section} />;
          case "journal":
            return <Journal key={section.id} section={section} posts={posts} />;
          case "contact":
            return <ContactStrip key={section.id} section={section} />;
        }
      })}
    </div>
  );
}
