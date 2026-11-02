import { DeliveryLookup, type PrefectureDelivery } from "@/components/storefront/delivery-lookup";
import {
  ArrowLink,
  Benefits,
  BusinessSection,
  CategoryGrid,
  ContactStrip,
  DeliverySection,
  Hero,
  Journal,
  SectionHeading,
  Steps,
  wrap,
} from "@/components/storefront/home-sections";
import { QuickOrderSheet } from "@/components/quick-order/quick-order-sheet";
import { repositories } from "@/lib/data";
import { JP_PREFECTURES } from "@/lib/locations";
import { getHomeCategories } from "@/lib/storefront/home";
import { loadQuickOrderSheet } from "@/lib/storefront/quick-order";
import type { DeliveryRoute } from "@/lib/types";

const DAY: Record<string, string> = { sat: "Sat", sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" };

/** Prefecture → the existing delivery route that lists it (sample route data). */
function prefectureRoutes(routes: DeliveryRoute[]): PrefectureDelivery[] {
  return JP_PREFECTURES.map((prefecture) => {
    const r = routes.find((x) => x.active && x.areas.some((a) => a.toLowerCase() === prefecture.toLowerCase()));
    return { prefecture, route: r && { name: r.name, days: r.deliveryDays.map((d) => DAY[d] ?? d).join(", "), cutoff: r.cutoffTime } };
  });
}

export default async function HomePage() {
  const [featured, quickOrder, routes] = await Promise.all([
    // Featured top-level categories (the imported sample catalog; see homeContent.featuredCategories).
    getHomeCategories(),
    // Resolved per request for the current viewer: prices only for approved customers.
    loadQuickOrderSheet(),
    repositories.delivery.listRoutes({ perPage: 48 }),
  ]);

  return (
    <div className="bg-surface">
      <Hero />
      <Benefits />
      <CategoryGrid categories={featured} />

      <section id="quick-order" aria-labelledby="quick-order-title" className={`${wrap} scroll-mt-40 pb-12`}>
        <SectionHeading id="quick-order-title" title="Restock faster with quick order" action={<ArrowLink href="/shop">View full catalog</ArrowLink>} />
        <p className="-mt-3 mb-4 text-sm text-muted">Search by product name or SKU, enter quantities, then add everything to your cart at once.</p>
        <QuickOrderSheet {...quickOrder} />
      </section>

      <BusinessSection />
      <DeliverySection>
        <DeliveryLookup prefectures={prefectureRoutes(routes.items)} />
      </DeliverySection>
      <Steps />
      <Journal />
      <ContactStrip />
    </div>
  );
}
