import type { Paginated } from "@/lib/types";

/** Every row of a paginated list, for selectors that must offer all of them. Asks for pages the API allows (at most 100). */
export async function allPages<T>(fetchPage: (page: number, perPage: number) => Promise<Paginated<T>>) {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchPage(page, 100);
    rows.push(...result.items);
    if (page >= result.totalPages) return rows;
  }
}
