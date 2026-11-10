import "server-only";

import { reportBreakdowns, reportSummary, type ReportOrder } from "@/lib/reports/aggregate";
import type { DateRange } from "@/lib/types";
import { mockCategories, mockProducts } from "./mock/catalog";
import { mockCustomerGroups, mockCustomers } from "./mock/customers";
import { mockOrders } from "./mock/orders";
import { storeDay } from "./mock-utils";

const orders = () => (mockOrders as unknown as ReportOrder[]).map((o) => ({ ...o, placedAt: storeDay(o.placedAt) }));

const ctx = {
  categoryOf(productId?: string) {
    const product = mockProducts.find((p) => p.id === productId);
    let c = mockCategories.find((x) => x.id === product?.categoryIds[0]);
    while (c?.parentId) c = mockCategories.find((x) => x.id === c!.parentId);
    return c?.name ?? "Uncategorised";
  },
  groupOf(customerId?: string) {
    if (!customerId) return "Walk-in";
    const groupId = mockCustomers.find((c) => c.id === customerId)?.groupId;
    return mockCustomerGroups.find((g) => g.id === groupId)?.name ?? "No group";
  },
};

export const mockReport = (range: DateRange) => ({ summary: reportSummary(orders(), range), ...reportBreakdowns(orders(), range, ctx) });
export const mockReportSummary = (range: DateRange) => reportSummary(orders(), range);
