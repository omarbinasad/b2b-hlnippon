import "server-only";

import { repositories } from "@/lib/data";
import type { RuleTarget } from "@/lib/types";

/** Options for the rule forms: categories (parents before children), groups and names for the current target. */
export async function loadRuleFormData(target?: RuleTarget) {
  const [all, groups, initialPicks, initialProduct] = await Promise.all([
    repositories.categories.all(),
    repositories.customers.listGroups(),
    target?.type === "products" ? repositories.products.getPicks(target.productIds) : Promise.resolve([]),
    target?.type === "variations" ? repositories.pricing.productOption(target.productId) : Promise.resolve(null),
  ]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const roots = all.filter((c) => !c.parentId).sort(byName);
  const categories = roots.flatMap((r) => [r, ...all.filter((c) => c.parentId === r.id).sort(byName)]).map(({ id, name, parentId }) => ({ id, name, parentId }));
  return { categories, groups, initialPicks, initialProduct };
}
