/** Storefront category navigation tree. Run with `npm test`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildCategoryTree, type CategoryNode } from "../src/lib/catalog/category-tree.ts";
import type { Category } from "../src/lib/types/index.ts";

const cat = (id: string, name: string, parentId?: string) => ({ id, name, slug: id, parentId });
const count = (nodes: CategoryNode[]): number => nodes.reduce((n, c) => n + 1 + count(c.children), 0);

describe("buildCategoryTree", () => {
  it("nests at any depth and sorts by name at every level", () => {
    const tree = buildCategoryTree([cat("b", "Beta"), cat("a", "Alpha"), cat("a2", "Zed", "a"), cat("a1", "Ant", "a"), cat("deep", "Deep", "a1")]);
    assert.deepEqual(tree.map((n) => n.name), ["Alpha", "Beta"]);
    assert.deepEqual(tree[0].children.map((n) => n.name), ["Ant", "Zed"]);
    assert.deepEqual(tree[0].children[0].children.map((n) => n.slug), ["deep"]);
  });

  it("drops subtrees whose parent is not in the list (hidden parents)", () => {
    const tree = buildCategoryTree([cat("a", "Alpha"), cat("orphan", "Orphan", "hidden-parent"), cat("orphan-child", "Child", "orphan")]);
    assert.deepEqual(tree.map((n) => n.slug), ["a"]);
    assert.equal(count(tree), 1);
  });

  it("survives parent cycles", () => {
    const tree = buildCategoryTree([cat("root", "Root"), cat("x", "X", "y"), cat("y", "Y", "x")]);
    assert.deepEqual(tree.map((n) => n.slug), ["root"]);
  });

  it("covers the complete sample-catalog hierarchy", () => {
    const fixture = JSON.parse(readFileSync(new URL("../src/lib/data/fixtures/sample-catalog.json", import.meta.url), "utf8")) as { categories: Category[] };
    const active = fixture.categories.filter((c) => c.status === "active");
    const tree = buildCategoryTree(active);
    assert.equal(count(tree), active.length);
    assert.equal(tree.length, active.filter((c) => !c.parentId).length);
  });
});
