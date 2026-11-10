/** Pure menu tree operations and validation, for the menu builder, the mock and tests. */
import type { MenuItem, NavigationMenuInput } from "../types/content.ts";

export const MAX_MENU_DEPTH = 3;

type Errors = Record<string, string>;

export interface ItemPosition {
  parentId: string | null;
  index: number;
}

export function findPosition(items: MenuItem[], id: string, parentId: string | null = null): ItemPosition | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return { parentId, index: i };
    const inner = findPosition(items[i].children, id, items[i].id);
    if (inner) return inner;
  }
  return null;
}

function findItem(items: MenuItem[], id: string): MenuItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const inner = findItem(item.children, id);
    if (inner) return inner;
  }
  return null;
}

/** Levels the item occupies itself, counting its children. */
export const heightOf = (item: MenuItem): number => 1 + Math.max(0, ...item.children.map(heightOf));

/** How deep the item sits; the top level is 1. */
export function depthOf(items: MenuItem[], id: string, depth = 1): number {
  for (const item of items) {
    if (item.id === id) return depth;
    const inner = depthOf(item.children, id, depth + 1);
    if (inner) return inner;
  }
  return 0;
}

export function removeItem(items: MenuItem[], id: string): MenuItem[] {
  return items.filter((i) => i.id !== id).map((i) => ({ ...i, children: removeItem(i.children, id) }));
}

export function updateItem(items: MenuItem[], id: string, patch: Partial<MenuItem>): MenuItem[] {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : { ...i, children: updateItem(i.children, id, patch) }));
}

function insertAt(items: MenuItem[], item: MenuItem, parentId: string | null, index: number): MenuItem[] {
  if (parentId === null) {
    const copy = [...items];
    copy.splice(index, 0, item);
    return copy;
  }
  return items.map((i) => {
    if (i.id !== parentId) return { ...i, children: insertAt(i.children, item, parentId, index) };
    const children = [...i.children];
    children.splice(index, 0, item);
    return { ...i, children };
  });
}

/** Puts `id` at a position. Refused (same tree back) if it would nest an item in itself or go too deep. */
export function moveItem(items: MenuItem[], id: string, to: ItemPosition): MenuItem[] {
  const item = findItem(items, id);
  if (!item) return items;
  if (to.parentId !== null && (to.parentId === id || findItem(item.children, to.parentId))) return items;
  const parentDepth = to.parentId === null ? 0 : depthOf(items, to.parentId);
  if (parentDepth + heightOf(item) > MAX_MENU_DEPTH) return items;
  const from = findPosition(items, id);
  const without = removeItem(items, id);
  // Removing an earlier sibling shifts the target one place left.
  const index = from && from.parentId === to.parentId && from.index < to.index ? to.index - 1 : to.index;
  return insertAt(without, item, to.parentId, index);
}

const siblings = (items: MenuItem[], parentId: string | null) => (parentId === null ? items : (findItem(items, parentId)?.children ?? []));

export function moveUp(items: MenuItem[], id: string) {
  const p = findPosition(items, id);
  return p && p.index > 0 ? moveItem(items, id, { parentId: p.parentId, index: p.index - 1 }) : items;
}

export function moveDown(items: MenuItem[], id: string) {
  const p = findPosition(items, id);
  return p && p.index < siblings(items, p.parentId).length - 1 ? moveItem(items, id, { parentId: p.parentId, index: p.index + 2 }) : items;
}

/** Makes the item a child of the sibling above it. */
export function indent(items: MenuItem[], id: string) {
  const p = findPosition(items, id);
  if (!p || p.index === 0) return items;
  const above = siblings(items, p.parentId)[p.index - 1];
  return moveItem(items, id, { parentId: above.id, index: above.children.length });
}

/** Moves the item out to sit right after its parent. */
export function outdent(items: MenuItem[], id: string) {
  const p = findPosition(items, id);
  if (!p || p.parentId === null) return items;
  const parent = findPosition(items, p.parentId);
  return parent ? moveItem(items, id, { parentId: parent.parentId, index: parent.index + 1 }) : items;
}

const SAFE_URL = /^(?:https?:\/\/\S+|mailto:\S+|tel:\S+|\/(?!\/)\S*|#\S*)$/;

export function validateMenu(input: NavigationMenuInput): Errors {
  const errors: Errors = {};
  if (input.name.trim().length < 2) errors.name = "Enter a menu name.";
  const walk = (items: MenuItem[], depth: number) => {
    for (const item of items) {
      if (depth > MAX_MENU_DEPTH) errors[`item.${item.id}`] = `Menus can go ${MAX_MENU_DEPTH} levels deep.`;
      if (!item.label.trim()) errors[`item.${item.id}.label`] = "Enter a label.";
      else if (item.label.length > 60) errors[`item.${item.id}.label`] = "Keep the label under 60 characters.";
      if (item.kind === "custom" && !SAFE_URL.test(item.url?.trim() ?? "")) errors[`item.${item.id}.url`] = "Use a link like /shop or https://example.com.";
      if (item.kind !== "custom" && !item.ref) errors[`item.${item.id}.ref`] = "Choose what this links to.";
      walk(item.children, depth + 1);
    }
  };
  walk(input.items, 1);
  return errors;
}
