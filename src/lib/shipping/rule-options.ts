import "server-only";

import { repositories } from "@/lib/data";

/** Choices for the rule builder's dropdowns. */
export async function ruleOptions() {
  const [categories, classes, groups, zones] = await Promise.all([repositories.products.listCategories(), repositories.shipping.listClasses(), repositories.customers.listGroups(), repositories.shipping.listZones({ perPage: 200 })]);
  return {
    categories: categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.slug, label: c.name })),
    classes: classes.map((c) => ({ value: c.id, label: c.name })),
    groups: groups.map((g) => ({ value: g.id, label: g.name })),
    zones: zones.items.map((z) => ({ value: z.id, label: z.name })),
  };
}
