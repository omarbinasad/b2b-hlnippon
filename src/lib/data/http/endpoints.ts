/**
 * The REST contract: one entry per repository method. TypeScript refuses to build if a method has no entry, so this
 * table can't fall behind the repository interfaces. The HTTP adapter (`./http-repositories.ts`) reads it to make calls,
 * and `scripts/generate-api-docs.ts` reads it to write docs/API-CONTRACTS.md and docs/openapi.yaml.
 *
 * The `actor` argument of repository methods is never sent: the backend takes the user from the session.
 */
import type { Repositories } from "../repositories";
import { STANDARD_PRICING_ID } from "../../pricing/standard.ts";

export interface CallParts {
  /** Replaces {name} in the route. */
  path?: Record<string, string | number>;
  query?: object;
  body?: unknown;
}

export interface EndpointSpec<A extends unknown[] = never[]> {
  /** "METHOD /path", relative to /api/v1. */
  route: string;
  /** Capability from src/lib/auth/capabilities.ts; "public" or "customer" for the others. */
  perm: string;
  /** Type names from src/lib/types or repositories.ts, for the docs. */
  req?: string;
  res?: string;
  note?: string;
  /** "save": 422 becomes a SaveResult. "nullable": 404 becomes null. "void": no body. "binary": file bytes. "multipart": form upload. */
  kind?: "save" | "nullable" | "void" | "binary" | "multipart";
  map?: (...args: A) => CallParts;
}

type Args<F> = F extends (...args: infer A) => unknown ? A : never;

/** Every repository and method, with its argument types. */
export type EndpointMap = { [R in keyof Repositories]: { [M in keyof Repositories[R]]: EndpointSpec<Args<Repositories[R][M]>> } };

const SAVE = { kind: "save" } as const;
const NULL = { kind: "nullable" } as const;
const VOID = { kind: "void" } as const;

export const ENDPOINTS: EndpointMap = {
  company: {
    get: { route: "GET /company", perm: "public", res: "CompanySettings", note: "Public settings only: this reaches the browser, so it must never hold secrets." },
    update: { route: "PUT /admin/company", perm: "company.manage", req: "CompanySettingsInput", res: "CompanySettings", ...SAVE, map: (input) => ({ body: input }) },
    completeSetup: { route: "POST /admin/company/setup-complete", perm: "company.manage", res: "CompanySettings" },
    resetDemo: { route: "POST /demo/company/reset", perm: "demo only", res: "CompanySettings", note: "Demo only. The backend doesn't need it." },
  },
  media: {
    list: { route: "GET /admin/media", perm: "media.view", res: "Paginated<MediaItem>", map: (query) => ({ query }) },
    getById: { route: "GET /admin/media/{id}", perm: "media.view", res: "MediaItem", ...NULL, map: (id) => ({ path: { id } }) },
    content: { route: "GET /media/{id}/content", perm: "public", kind: "binary", note: "The file. In production, public URLs on the media host usually replace this.", map: (id) => ({ path: { id } }) },
    upload: { route: "POST /admin/media", perm: "media.create", req: "MediaUpload", res: "MediaItem", kind: "multipart", note: "multipart/form-data. Check the content, scan and store safely.", map: (input) => ({ body: input }) },
    update: { route: "PATCH /admin/media/{id}", perm: "media.edit", req: "MediaUpdate", res: "MediaItem", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    remove: { route: "DELETE /admin/media/{id}", perm: "media.delete", ...VOID, map: (id) => ({ path: { id } }) },
  },
  staff: {
    roles: { route: "GET /admin/roles", perm: "roles.view", res: "Role[]" },
    role: { route: "GET /admin/roles/{id}", perm: "roles.view", res: "Role", ...NULL, map: (id) => ({ path: { id } }) },
    staffCounts: { route: "GET /admin/roles/staff-counts", perm: "roles.view", note: "Map of role id to number of staff." },
    saveRole: { route: "PUT /admin/roles/{id?}", perm: "roles.manage", req: "RoleInput", res: "Role", ...SAVE, note: "POST /admin/roles when creating. Refuse granting anything the user lacks. Administrator keeps everything and can't be renamed. Refuse removing roles.manage from the user's own role.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    duplicateRole: { route: "POST /admin/roles/{id}/duplicate", perm: "roles.manage", res: "Role", ...SAVE, map: (id) => ({ path: { id } }) },
    deleteRole: { route: "DELETE /admin/roles/{id}", perm: "roles.manage", ...SAVE, note: "Refused for built-in roles and roles in use.", map: (id) => ({ path: { id } }) },
    staff: { route: "GET /admin/staff", perm: "staff.view", res: "Paginated<StaffMember>", map: (query) => ({ query }) },
    staffMember: { route: "GET /admin/staff/{id}", perm: "staff.view", res: "StaffMember", ...NULL, map: (id) => ({ path: { id } }) },
    saveStaff: { route: "PUT /admin/staff/{id?}", perm: "staff.manage", req: "StaffInput", res: "StaffMember", ...SAVE, note: "POST /admin/staff when creating; invite: true emails an invitation. Refuse anything leaving no active administrator, assigning a role with more permissions than the user, or changing someone with more permissions than the user.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    removeStaff: { route: "DELETE /admin/staff/{id}", perm: "staff.manage", ...SAVE, note: "Refused for the last active administrator and for anyone with more permissions than the user.", map: (id) => ({ path: { id } }) },
  },
  emails: {
    templates: { route: "GET /admin/email-templates", perm: "emails.view", res: "EmailTemplate[]" },
    template: { route: "GET /admin/email-templates/{key}", perm: "emails.view", res: "EmailTemplate", ...NULL, map: (key) => ({ path: { key } }) },
    saveTemplate: { route: "PUT /admin/email-templates/{key}", perm: "emails.manage", req: "EmailTemplateInput", res: "EmailTemplate", ...SAVE, map: (key, input) => ({ path: { key }, body: input }) },
    resetTemplate: { route: "POST /admin/email-templates/{key}/reset", perm: "emails.manage", ...VOID, map: (key) => ({ path: { key } }) },
    preview: { route: "POST /admin/email-templates/{key}/preview", perm: "emails.view", note: "Renders with sample values. Escape values; sanitize the HTML.", map: (key, draft) => ({ path: { key }, body: draft ?? {} }) },
    sender: { route: "GET /admin/email-sender", perm: "emails.view", res: "EmailSenderSettings" },
    saveSender: { route: "PUT /admin/email-sender", perm: "emails.manage", req: "EmailSenderSettings", res: "EmailSenderSettings", ...SAVE, map: (input) => ({ body: input }) },
    logs: { route: "GET /admin/email-logs", perm: "emails.view", res: "Paginated<EmailLog>", map: (query) => ({ query }) },
    retry: { route: "POST /admin/email-logs/{id}/retry", perm: "emails.manage", res: "EmailLog", ...SAVE, map: (id) => ({ path: { id } }) },
  },
  reminders: {
    list: { route: "GET /admin/reminder-campaigns", perm: "reminders.view", res: "Paginated<ReminderCampaign>", map: (query) => ({ query }) },
    getById: { route: "GET /admin/reminder-campaigns/{id}", perm: "reminders.view", res: "ReminderCampaign", ...NULL, map: (id) => ({ path: { id } }) },
    save: { route: "PUT /admin/reminder-campaigns/{id?}", perm: "reminders.manage", req: "ReminderCampaignInput", res: "ReminderCampaign", ...SAVE, note: "POST when creating.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    remove: { route: "DELETE /admin/reminder-campaigns/{id}", perm: "reminders.manage", ...VOID, map: (id) => ({ path: { id } }) },
    preview: { route: "GET /admin/reminder-campaigns/{id}/preview", perm: "reminders.view", res: "ReminderPreview", ...NULL, note: "Next date, groups A and B, who is left out and why.", map: (id) => ({ path: { id } }) },
    simulate: { route: "POST /demo/reminder-campaigns/{id}/simulate", perm: "demo only", ...SAVE, note: "Demo only. The real sending is a scheduled job; it must dedupe per customer, campaign and date.", map: (id) => ({ path: { id } }) },
    history: { route: "GET /admin/reminder-campaigns/{id}/history", perm: "reminders.view", res: "Paginated<EmailLog>", map: (id, query) => ({ path: { id }, query }) },
  },
  coupons: {
    list: { route: "GET /admin/coupons", perm: "coupons.view", res: "Paginated<Coupon>", map: (query) => ({ query }) },
    getById: { route: "GET /admin/coupons/{id}", perm: "coupons.view", res: "Coupon", ...NULL, map: (id) => ({ path: { id } }) },
    usage: { route: "GET /admin/coupons/{id}/usage", perm: "coupons.view", res: "Paginated<CouponUsage>", map: (id, query) => ({ path: { id }, query }) },
    save: { route: "PUT /admin/coupons/{id?}", perm: "coupons.edit", req: "CouponInput", res: "Coupon", ...SAVE, note: "POST when creating. Codes are unique, compared in capitals.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    setEnabled: { route: "PATCH /admin/coupons/{id}/enabled", perm: "coupons.edit", ...VOID, map: (id, enabled) => ({ path: { id }, body: { enabled } }) },
    remove: { route: "DELETE /admin/coupons/{id}", perm: "coupons.delete", ...VOID, note: "Orders keep their own record of the code and amount.", map: (id) => ({ path: { id } }) },
  },
  savedLists: {
    list: { route: "GET /customer/lists", perm: "customer", res: "SavedList[]", note: "The customer is always the signed-in one.", map: () => ({}) },
    get: { route: "GET /customer/lists/{id}", perm: "customer", res: "SavedListDetail", ...NULL, map: (_c, id) => ({ path: { id } }) },
    create: { route: "POST /customer/lists", perm: "customer", res: "SavedList", ...SAVE, map: (_c, name, lines) => ({ body: { name, lines } }) },
    createFromOrder: { route: "POST /customer/lists/from-order", perm: "customer", res: "SavedList", ...SAVE, map: (_c, orderId, name) => ({ body: { orderId, name } }) },
    rename: { route: "PATCH /customer/lists/{id}", perm: "customer", res: "SavedList", ...SAVE, map: (_c, id, name) => ({ path: { id }, body: { name } }) },
    remove: { route: "DELETE /customer/lists/{id}", perm: "customer", ...VOID, map: (_c, id) => ({ path: { id } }) },
    addItem: { route: "POST /customer/lists/{id}/items", perm: "customer", req: "SavedListLineInput", res: "SavedList", ...SAVE, map: (_c, id, line) => ({ path: { id }, body: line }) },
    setQuantity: { route: "PATCH /customer/lists/{id}/items/{itemId}", perm: "customer", res: "SavedList", ...SAVE, map: (_c, id, itemId, quantity) => ({ path: { id, itemId }, body: { quantity } }) },
    removeItem: { route: "DELETE /customer/lists/{id}/items/{itemId}", perm: "customer", res: "SavedList", ...SAVE, map: (_c, id, itemId) => ({ path: { id, itemId } }) },
    addToCart: { route: "POST /customer/lists/{id}/add-to-cart", perm: "customer", ...SAVE, map: (_c, id) => ({ path: { id } }) },
  },
  quotations: {
    list: { route: "GET /quotations", perm: "quotations.view or customer", res: "Paginated<Quotation>", note: "Customers only ever see their own.", map: (query) => ({ query }) },
    counts: { route: "GET /admin/quotations/counts", perm: "quotations.view" },
    getById: { route: "GET /quotations/{id}", perm: "quotations.view or customer", res: "Quotation", ...NULL, map: (id) => ({ path: { id } }) },
    request: { route: "POST /customer/quotations", perm: "customer", req: "QuotationRequestInput", res: "Quotation", ...SAVE, map: (_c, input) => ({ body: input }) },
    sendQuote: { route: "POST /admin/quotations/{id}/quote", perm: "quotations.edit", req: "QuotationQuoteInput", res: "Quotation", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    decline: { route: "POST /admin/quotations/{id}/decline", perm: "quotations.edit", res: "Quotation", ...SAVE, map: (id, reason) => ({ path: { id }, body: { reason } }) },
    respond: { route: "POST /customer/quotations/{id}/respond", perm: "customer", res: "Quotation", ...SAVE, note: "Accepting creates an order at the quoted prices. An expired quote is refused.", map: (_c, id, answer) => ({ path: { id }, body: { answer } }) },
  },
  adminNotifications: {
    feed: { route: "GET /admin/notifications", perm: "dashboard.view", res: "AdminNotificationFeed", map: (query) => ({ query }) },
    markRead: { route: "POST /admin/notifications/{id}/read", perm: "dashboard.view", ...VOID, map: (id) => ({ path: { id } }) },
    markAllRead: { route: "POST /admin/notifications/read-all", perm: "dashboard.view", ...VOID },
  },
  contact: {
    submit: { route: "POST /contact", perm: "public", req: "ContactMessageInput", res: "ContactMessage", ...SAVE, note: "Rate-limit it.", map: (input) => ({ body: input }) },
  },
  posts: {
    list: { route: "GET /posts", perm: "public", res: "BlogPostSummary[]", note: "Live posts only.", map: (query) => ({ query }) },
    getBySlug: { route: "GET /posts/{slug}", perm: "public", res: "BlogPost", ...NULL, map: (slug) => ({ path: { slug } }) },
    archive: { route: "GET /posts/archive", perm: "public", res: "Paginated<BlogPostSummary>", note: "categories: comma-separated names; a post matches if it's in any of them. Names can't contain commas.", map: (query) => ({ query }) },
    categories: { route: "GET /posts/categories", perm: "public" },
    terms: { route: "GET /admin/post-terms/{kind}", perm: "posts.view", map: (kind) => ({ path: { kind } }) },
    saveTerm: { route: "PUT /admin/post-terms/{kind}", perm: "posts.edit", ...SAVE, note: "from null adds; otherwise renames on every post.", map: (kind, from, name) => ({ path: { kind }, body: { from, name } }) },
    deleteTerm: { route: "DELETE /admin/post-terms/{kind}/{name}", perm: "posts.delete", ...SAVE, note: "Refused if a published post would be left without a category.", map: (kind, name) => ({ path: { kind, name } }) },
    adminList: { route: "GET /admin/posts", perm: "posts.view", res: "Paginated<BlogPost>", map: (query) => ({ query }) },
    statusCounts: { route: "GET /admin/posts/status-counts", perm: "posts.view" },
    getById: { route: "GET /admin/posts/{id}", perm: "posts.view", res: "BlogPost", ...NULL, map: (id) => ({ path: { id } }) },
    save: { route: "PUT /admin/posts/{id?}", perm: "posts.edit", req: "BlogPostInput", res: "BlogPost", ...SAVE, note: "POST when creating. Sanitize the HTML on save.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    trash: { route: "POST /admin/posts/{id}/trash", perm: "posts.delete", ...VOID, map: (id) => ({ path: { id } }) },
    restore: { route: "POST /admin/posts/{id}/restore", perm: "posts.edit", ...VOID, map: (id) => ({ path: { id } }) },
    deleteForever: { route: "DELETE /admin/posts/{id}", perm: "posts.delete", ...VOID, note: "Only from the trash.", map: (id) => ({ path: { id } }) },
  },
  pages: {
    getLiveBySlug: { route: "GET /pages/{slug}", perm: "public", res: "ContentPage", ...NULL, note: "A customers-only page must return 404 to anyone else.", map: (slug) => ({ path: { slug } }) },
    listLive: { route: "GET /pages", perm: "public", res: "ContentPage[]" },
    adminList: { route: "GET /admin/pages", perm: "pages.view", res: "Paginated<ContentPage>", map: (query) => ({ query }) },
    statusCounts: { route: "GET /admin/pages/status-counts", perm: "pages.view" },
    getById: { route: "GET /admin/pages/{id}", perm: "pages.view", res: "ContentPage", ...NULL, map: (id) => ({ path: { id } }) },
    save: { route: "PUT /admin/pages/{id?}", perm: "pages.edit", req: "ContentPageInput", res: "ContentPage", ...SAVE, note: "POST when creating. Sanitize the HTML on save; refuse reserved addresses.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    trash: { route: "POST /admin/pages/{id}/trash", perm: "pages.delete", ...VOID, map: (id) => ({ path: { id } }) },
    restore: { route: "POST /admin/pages/{id}/restore", perm: "pages.edit", ...VOID, map: (id) => ({ path: { id } }) },
    deleteForever: { route: "DELETE /admin/pages/{id}", perm: "pages.delete", ...VOID, note: "Only from the trash.", map: (id) => ({ path: { id } }) },
  },
  navigation: {
    list: { route: "GET /admin/menus", perm: "menus.view", res: "NavigationMenu[]" },
    getById: { route: "GET /admin/menus/{id}", perm: "menus.view", res: "NavigationMenu", ...NULL, map: (id) => ({ path: { id } }) },
    resolved: { route: "GET /navigation/{location}", perm: "public", res: "ResolvedMenuItem[]", note: "Real URLs; links to pages that aren't live are left out.", map: (location) => ({ path: { location } }) },
    save: { route: "PUT /admin/menus/{id?}", perm: "menus.edit", req: "NavigationMenuInput", res: "NavigationMenu", ...SAVE, note: "POST when creating. One menu per location.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    remove: { route: "DELETE /admin/menus/{id}", perm: "menus.edit", ...VOID, map: (id) => ({ path: { id } }) },
  },
  siteContent: {
    get: { route: "GET /site-content", perm: "public", res: "SiteContent" },
    update: { route: "PUT /admin/site-content", perm: "homepage.edit", req: "SiteContentInput", res: "SiteContent", ...SAVE, map: (input) => ({ body: input }) },
  },
  products: {
    list: { route: "GET /products", perm: "public", res: "Paginated<ProductSummary>", note: "Never includes customer prices.", map: (query) => ({ query }) },
    getBySlug: { route: "GET /products/{slug}", perm: "public", res: "Product", ...NULL, map: (slug) => ({ path: { slug } }) },
    listCategories: { route: "GET /categories", perm: "public", res: "Category[]" },
    listBrands: { route: "GET /brands", perm: "public", res: "BrandFacet[]" },
    featuredBrands: { route: "GET /brands/featured", perm: "public", res: "BrandFacet[]", note: "Brands marked for the homepage, lowest displayOrder first.", map: (max) => ({ query: { max } }) },
    adminList: { route: "GET /admin/products", perm: "products.view", res: "Paginated<AdminProductRow>", map: (query) => ({ query }) },
    getById: { route: "GET /admin/products/{id}", perm: "products.view", res: "Product", ...NULL, map: (id) => ({ path: { id } }) },
    create: { route: "POST /admin/products", perm: "products.create", req: "ProductInput", res: "Product", ...SAVE, map: (input) => ({ body: input }) },
    update: { route: "PUT /admin/products/{id}", perm: "products.edit", req: "ProductInput", res: "Product", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    duplicate: { route: "POST /admin/products/{id}/duplicate", perm: "products.create", res: "Product", ...SAVE, map: (id) => ({ path: { id } }) },
    setStatus: { route: "PATCH /admin/products/{id}/status", perm: "products.edit", res: "Product", ...SAVE, map: (id, status) => ({ path: { id }, body: { status } }) },
    setStock: { route: "PATCH /admin/products/{id}/stock", perm: "inventory.edit", res: "Product", ...SAVE, note: "Never changes existing orders. Record a stock movement; protect against concurrent changes.", map: (id, variationId, change, context) => ({ path: { id }, body: { variationId, change, context } }) },
    inventory: { route: "GET /admin/inventory", perm: "inventory.view", res: "Paginated<InventoryRow>", map: (query) => ({ query }) },
    inventoryCounts: { route: "GET /admin/inventory/counts", perm: "inventory.view" },
    allStockMovements: { route: "GET /admin/inventory/movements", perm: "inventory.view", res: "Paginated<StockMovement>", map: (query) => ({ query }) },
    stockMovements: { route: "GET /admin/products/{id}/stock-movements", perm: "inventory.view", res: "Paginated<StockMovement>", map: (id, query) => ({ path: { id }, query }) },
    search: { route: "GET /admin/products/search", perm: "products.view", res: "ProductPick[]", note: "Picker search, at most 20 results.", map: (term, options) => ({ query: { q: term, ...options } }) },
    getPicks: { route: "GET /admin/products/picks", perm: "products.view", res: "ProductPick[]", map: (ids) => ({ query: { ids: ids.join(",") } }) },
  },
  categories: {
    all: { route: "GET /admin/categories/all", perm: "products.view", res: "Category[]" },
    list: { route: "GET /admin/categories", perm: "products.view", res: "Paginated<AdminCategoryRow>", map: (query) => ({ query }) },
    getById: { route: "GET /admin/categories/{id}", perm: "products.view", res: "Category", ...NULL, map: (id) => ({ path: { id } }) },
    create: { route: "POST /admin/categories", perm: "products.create", req: "CategoryInput", res: "Category", ...SAVE, map: (input) => ({ body: input }) },
    update: { route: "PUT /admin/categories/{id}", perm: "products.edit", req: "CategoryInput", res: "Category", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    listProducts: { route: "GET /admin/categories/{id}/products", perm: "products.view", res: "Paginated<ProductPick>", map: (id, query) => ({ path: { id }, query }) },
    assignProducts: { route: "POST /admin/categories/{id}/products", perm: "products.edit", ...SAVE, map: (id, change) => ({ path: { id }, body: change }) },
  },
  catalogSettings: {
    brands: { route: "GET /admin/brands", perm: "products.view", res: "Brand[]" },
    tags: { route: "GET /admin/product-tags", perm: "products.view", res: "Tag[]" },
    storeDefaults: { route: "GET /admin/catalog-defaults", perm: "products.view" },
    createBrand: { route: "POST /admin/brands", perm: "products.edit", res: "Brand", ...SAVE, map: (name) => ({ body: { name } }) },
    adminBrands: { route: "GET /admin/brands/list", perm: "products.view", res: "Paginated<AdminBrandRow>", map: (query) => ({ query }) },
    saveBrand: { route: "PUT /admin/brand-records/{id?}", perm: "products.edit", req: "BrandInput", res: "Brand", ...SAVE, note: "POST when creating. The logo comes from the media library.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    brandUsage: { route: "GET /admin/brands/usage", perm: "products.view", res: "TermUsage[]" },
    renameBrand: { route: "PATCH /admin/brands/{name}", perm: "products.edit", res: "Brand", ...SAVE, map: (from, name) => ({ path: { name: from }, body: { name } }) },
    deleteBrand: { route: "DELETE /admin/brands/{name}", perm: "products.delete", ...SAVE, map: (name) => ({ path: { name } }) },
    createAttributeValue: { route: "POST /admin/attributes/{id}/values", perm: "products.edit", res: "AttributeValue", ...SAVE, map: (id, name) => ({ path: { id }, body: { name } }) },
    attributes: { route: "GET /admin/attributes", perm: "products.view", res: "Attribute[]" },
    shippingClasses: { route: "GET /admin/shipping/class-options", perm: "products.view", res: "ShippingClass[]" },
    taxClasses: { route: "GET /admin/tax/class-options", perm: "products.view", res: "TaxClassOption[]" },
  },
  pricing: {
    getCustomerPrices: { route: "POST /customer/prices", perm: "customer or products.view", res: "ResolvedPrice[]", note: "Never cache publicly. A staff session gets the standard wholesale price: rules for all approved customers and sale prices, no group or customer rules.", map: (_c, productIds) => ({ body: { productIds } }) },
    productIdsInPriceRange: { route: "GET /customer/products-in-price-range", perm: "customer or products.view", note: "A staff session uses the standard wholesale price.", map: (_c, range) => ({ query: range }) },
    priceBounds: { route: "GET /customer/price-bounds", perm: "customer or products.view", kind: "nullable", note: "A staff session uses the standard wholesale price." },
    listRules: { route: "GET /admin/price-rules", perm: "pricing.view", res: "Paginated<PriceRuleListItem>", map: (query) => ({ query }) },
    getRule: { route: "GET /admin/price-rules/{id}", perm: "pricing.view", res: "PriceRuleListItem", ...NULL, map: (id) => ({ path: { id } }) },
    createRule: { route: "POST /admin/price-rules", perm: "pricing.create", req: "PriceRuleInput", res: "PriceRule", ...SAVE, map: (input) => ({ body: input }) },
    updateRule: { route: "PUT /admin/price-rules/{id}", perm: "pricing.edit", req: "PriceRuleInput", res: "PriceRule", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    setRuleStatus: { route: "PATCH /admin/price-rules/{id}/status", perm: "pricing.edit", res: "PriceRule", ...SAVE, map: (id, status) => ({ path: { id }, body: { status } }) },
    productOption: { route: "GET /admin/price-rules/product-options/{id}", perm: "pricing.view", res: "RuleProductOption", ...NULL, map: (id) => ({ path: { id } }) },
    testRules: { route: "POST /admin/price-rules/test", perm: "pricing.view", req: "RuleTestQuery", res: "RuleTestResult", ...NULL, map: (query) => ({ body: query }) },
  },
  quantityRules: {
    list: { route: "GET /admin/quantity-rules", perm: "pricing.view", res: "Paginated<QuantityRuleListItem>", map: (query) => ({ query }) },
    get: { route: "GET /admin/quantity-rules/{id}", perm: "pricing.view", res: "QuantityRuleListItem", ...NULL, map: (id) => ({ path: { id } }) },
    create: { route: "POST /admin/quantity-rules", perm: "pricing.create", req: "QuantityLimitRuleInput", res: "QuantityLimitRule", ...SAVE, map: (input) => ({ body: input }) },
    update: { route: "PUT /admin/quantity-rules/{id}", perm: "pricing.edit", req: "QuantityLimitRuleInput", res: "QuantityLimitRule", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    setStatus: { route: "PATCH /admin/quantity-rules/{id}/status", perm: "pricing.edit", res: "QuantityLimitRule", ...SAVE, map: (id, status) => ({ path: { id }, body: { status } }) },
    effectiveFor: { route: "GET /quantity-limits", perm: "public", kind: "nullable", map: (productId, variationId) => ({ query: { productId, variationId } }) },
  },
  customers: {
    remove: { route: "DELETE /admin/customers/{id}", perm: "customers.delete", ...SAVE, note: "Refused once the customer has an order: suspend them instead. Personal data: log it.", map: (id) => ({ path: { id } }) },
    list: { route: "GET /admin/customers", perm: "customers.view", res: "Paginated<CustomerListItem>", map: (query) => ({ query }) },
    getById: { route: "GET /customers/{id}", perm: "customers.view or customer", res: "Customer", ...NULL, note: "Customers only ever get themselves.", map: (id) => ({ path: { id } }) },
    getListItem: { route: "GET /admin/customers/{id}/summary", perm: "customers.view", res: "CustomerListItem", ...NULL, map: (id) => ({ path: { id } }) },
    statusCounts: { route: "GET /admin/customers/status-counts", perm: "customers.view" },
    search: { route: "GET /admin/customers/search", perm: "customers.view", map: (term, options) => ({ query: { q: term, ...options } }) },
    register: { route: "POST /register", perm: "public", req: "RegistrationInput", res: "Customer", ...SAVE, note: "Rate-limit it. Duplicate email or phone: 422.", map: (input) => ({ body: input }) },
    getDocument: { route: "GET /admin/customers/{id}/documents/{documentId}", perm: "customer_approval.view", kind: "binary", note: "Private storage, never cached.", map: (id, documentId) => ({ path: { id, documentId } }) },
    create: { route: "POST /admin/customers", perm: "customers.create", req: "CustomerQuickInput", res: "Customer", ...SAVE, map: (input) => ({ body: input }) },
    update: { route: "PUT /admin/customers/{id}", perm: "customers.edit", req: "CustomerDetailsInput", res: "Customer", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    updateProfile: { route: "PUT /customer/profile", perm: "customer", req: "CustomerProfileInput", res: "Customer", ...SAVE, map: (_id, input) => ({ body: input }) },
    setStatus: { route: "POST /admin/customers/{id}/status", perm: "customer_approval.approve", res: "Customer", ...SAVE, note: "A reason is required to reject or suspend.", map: (id, status, reason) => ({ path: { id }, body: { status, reason } }) },
    saveAddress: { route: "PUT /customers/{id}/addresses", perm: "customers.edit or customer", req: "AddressInput", res: "Customer", ...SAVE, note: "Creates without an address id. One default per address type.", map: (id, input) => ({ path: { id }, body: input }) },
    deleteAddress: { route: "DELETE /customers/{id}/addresses/{addressId}", perm: "customers.edit or customer", res: "Customer", ...SAVE, map: (id, addressId) => ({ path: { id, addressId } }) },
    listGroups: { route: "GET /admin/customer-groups/all", perm: "customers.view", res: "CustomerGroup[]" },
    listGroupSummaries: { route: "GET /admin/customer-groups", perm: "customers.view", res: "Paginated<CustomerGroupListItem>", map: (query) => ({ query }) },
    getGroup: { route: "GET /admin/customer-groups/{id}", perm: "customers.view", res: "CustomerGroupListItem", ...NULL, map: (id) => ({ path: { id } }) },
    createGroup: { route: "POST /admin/customer-groups", perm: "customers.create", req: "CustomerGroupInput", res: "CustomerGroup", ...SAVE, map: (input) => ({ body: input }) },
    updateGroup: { route: "PUT /admin/customer-groups/{id}", perm: "customers.edit", req: "CustomerGroupInput", res: "CustomerGroup", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    assignGroupMembers: { route: "POST /admin/customer-groups/{id}/members", perm: "customers.edit", res: "CustomerGroupListItem", ...SAVE, map: (id, change) => ({ path: { id }, body: change }) },
    listNotifications: { route: "GET /customer/notifications", perm: "customer", res: "Paginated<CustomerNotification>", map: (_c, query) => ({ query }) },
  },
  orders: {
    remove: { route: "DELETE /admin/orders/{id}", perm: "orders.delete", ...SAVE, note: "Only a cancelled order with no payment, refund or invoice. 422 otherwise.", map: (id) => ({ path: { id } }) },
    list: { route: "GET /orders", perm: "orders.view or customer", res: "Paginated<OrderListItem>", note: "Customers only ever get their own.", map: (query) => ({ query }) },
    getById: { route: "GET /orders/{id}", perm: "orders.view or customer", res: "Order", ...NULL, note: "Another customer's order is 404.", map: (id, customerId) => ({ path: { id }, query: { customerId } }) },
    calculationSettings: { route: "GET /admin/orders/calculation-settings", perm: "orders.view", res: "OrderCalculationSettings" },
    searchCustomers: { route: "GET /admin/orders/customers", perm: "orders_create.create", map: (term, limit) => ({ query: { q: term, limit } }) },
    customerContext: { route: "GET /admin/orders/customers/{id}", perm: "orders_create.create", res: "OrderCustomerContext", ...NULL, map: (id) => ({ path: { id } }) },
    orderableProduct: { route: "GET /orderable-products/{id}", perm: "orders_create.create or products.view or customer", res: "OrderableProduct", ...NULL, note: "customerId prices it for that customer (staff creating an order). standard=true gives the standard wholesale price (staff viewing the store). Neither: walk-in catalog prices.", map: (id, customerId) => ({ path: { id }, query: customerId === STANDARD_PRICING_ID ? { standard: true } : { customerId } }) },
    quoteLine: { route: "POST /admin/orders/quote-line", perm: "orders_create.create", res: "OrderLineQuote", ...NULL, map: (customerId, productId, variationId, quantity) => ({ body: { customerId, productId, variationId, quantity } }) },
    create: { route: "POST /admin/orders", perm: "orders_create.create", req: "CreateOrderInput", res: "Order", ...SAVE, note: "Snapshot item details. Walk-in orders need only a name.", map: (input) => ({ body: input }) },
    updateStatus: { route: "POST /admin/orders/{id}/status", perm: "order_status.edit", res: "Order", ...SAVE, note: "received → preparing → on_the_way → delivered, or cancelled with a reason.", map: (id, status, _a, note) => ({ path: { id }, body: { status, note } }) },
    addNote: { route: "POST /admin/orders/{id}/notes", perm: "orders_edit.edit", res: "Order", ...SAVE, map: (id, note) => ({ path: { id }, body: note }) },
    adjustItem: { route: "POST /admin/orders/{id}/adjust-item", perm: "order_prices.edit or order_quantities.edit or delivered_weight.edit", req: "AdjustItemInput", res: "Order", ...SAVE, note: "Delivered weight: line = agreed price × delivered ÷ ordered weight. Keep the original for comparison.", map: (id, input) => ({ path: { id }, body: input }) },
    edit: { route: "POST /admin/orders/{id}/edit", perm: "order_items.edit or order_discounts.edit or order_addresses.edit or orders_edit.edit", req: "OrderEdit", res: "Order", ...SAVE, note: "Check the permission for the kind of edit: add and remove need order_items.edit, discount order_discounts.edit, address order_addresses.edit, delivery date and shipping orders_edit.edit. Recalculates with the order's own tax basis; never changes the catalog.", map: (id, edit) => ({ path: { id }, body: edit }) },
    issueInvoice: { route: "POST /admin/orders/{id}/invoices", perm: "invoices.create", res: "Order", ...SAVE, note: "Issued documents are frozen.", map: (id, input) => ({ path: { id }, body: input }) },
    checkout: { route: "POST /customer/checkout", perm: "customer", req: "CheckoutInput", res: "Order", ...SAVE, note: "Re-price and re-check everything. The same idempotencyKey returns the order already placed.", map: (_c, input) => ({ body: input }) },
    accountSummary: { route: "GET /customer/summary", perm: "customer", res: "AccountSummary" },
    listInvoices: { route: "GET /customer/invoices", perm: "customer", res: "Paginated<InvoiceListItem>", map: (query) => ({ query: { ...query, customerId: undefined } }) },
    checkoutPreview: { route: "POST /customer/checkout/preview", perm: "customer", req: "CheckoutInput", res: "CheckoutPreview", ...SAVE, map: (_c, input) => ({ body: input }) },
    refund: { route: "POST /admin/orders/{id}/refunds", perm: "refunds.refund", req: "RefundInput", res: "Order", ...SAVE, note: "The backend moves the money, and must be idempotent.", map: (id, input) => ({ path: { id }, body: input }) },
    recordPayment: { route: "POST /admin/orders/{id}/payments", perm: "orders_edit.edit", req: "RecordPaymentInput", res: "Order", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    previewEdit: { route: "POST /admin/orders/{id}/edit/preview", perm: "order_items.edit or order_discounts.edit or order_addresses.edit or orders_edit.edit", req: "OrderEdit", res: "OrderEditPreview", ...SAVE, map: (id, edit) => ({ path: { id }, body: edit }) },
  },
  cart: {
    get: { route: "GET /customer/cart", perm: "customer", res: "Cart", note: "Re-priced on every read. Never cache publicly." },
    add: { route: "POST /customer/cart/lines", perm: "customer", ...SAVE, map: (_c, lines) => ({ body: { lines } }) },
    setQuantity: { route: "PATCH /customer/cart/lines/{lineId}", perm: "customer", res: "Cart", ...SAVE, map: (_c, lineId, quantity) => ({ path: { lineId }, body: { quantity } }) },
    quickOrder: { route: "GET /quick-order", perm: "public", res: "QuickOrderPage", note: "Prices for an approved customer, and the standard wholesale price for a staff session; none for guests and applicants. 10 products per page; a product with options gives one line per option.", map: (_c, query) => ({ query }) },
    remove: { route: "DELETE /customer/cart/lines/{lineId}", perm: "customer", res: "Cart", ...SAVE, map: (_c, lineId) => ({ path: { lineId } }) },
    applyCoupon: { route: "POST /customer/cart/coupon", perm: "customer", res: "Cart", ...SAVE, note: "Re-checked on every read and at checkout.", map: (_c, code) => ({ body: { code } }) },
    removeCoupon: { route: "DELETE /customer/cart/coupon", perm: "customer", res: "Cart", ...SAVE },
  },
  delivery: {
    listRoutes: { route: "GET /admin/delivery-schedules", perm: "delivery.view", res: "Paginated<DeliveryRoute>", map: (query) => ({ query }) },
    forCustomer: { route: "GET /customer/deliveries", perm: "customer", res: "CustomerDeliveryLocation[]" },
    getRoute: { route: "GET /admin/delivery-schedules/{id}", perm: "delivery.view", res: "DeliveryRoute", ...NULL, map: (id) => ({ path: { id } }) },
    routeDetail: { route: "GET /admin/delivery-schedules/{id}/detail", perm: "delivery.view", res: "DeliveryRouteDetail", ...NULL, map: (id) => ({ path: { id } }) },
    saveRoute: { route: "PUT /admin/delivery-schedules/{id?}", perm: "delivery.manage", req: "DeliveryRouteInput", res: "DeliveryRoute", ...SAVE, note: "POST when creating.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    deleteRoute: { route: "DELETE /admin/delivery-schedules/{id}", perm: "delivery.manage", ...SAVE, note: "Refused while a reminder campaign uses it.", map: (id) => ({ path: { id } }) },
    listReminders: { route: "GET /admin/reminders-legacy", perm: "reminders.view", res: "Paginated<Reminder>", note: "Older model; not used by a screen now. Can be dropped.", map: (query) => ({ query }) },
  },
  locations: {
    lookupPostcode: { route: "GET /postcodes/{postalCode}", perm: "public", res: "PostcodeLookup", map: (postalCode) => ({ path: { postalCode } }) },
  },
  settings: {
    getStore: { route: "GET /store", perm: "public", res: "StoreSettings", note: "Read-only view of the company settings." },
  },
  shipping: {
    listZones: { route: "GET /admin/shipping/zones", perm: "shipping.view", res: "Paginated<ShippingZoneListItem>", map: (query) => ({ query }) },
    getZone: { route: "GET /admin/shipping/zones/{id}", perm: "shipping.view", res: "ShippingZoneListItem", ...NULL, map: (id) => ({ path: { id } }) },
    createZone: { route: "POST /admin/shipping/zones", perm: "shipping.manage", req: "ShippingZoneInput", res: "ShippingZone", ...SAVE, map: (input) => ({ body: input }) },
    updateZone: { route: "PUT /admin/shipping/zones/{id}", perm: "shipping.manage", req: "ShippingZoneInput", res: "ShippingZone", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    deleteZone: { route: "DELETE /admin/shipping/zones/{id}", perm: "shipping.manage", ...SAVE, note: "The fallback zone can't be deleted.", map: (id) => ({ path: { id } }) },
    quote: { route: "POST /shipping/quote", perm: "customer or shipping.view", req: "ShippingQuoteInput", res: "ShippingQuoteResult", note: "Authoritative. Repeat at cart, checkout and order creation. Tester numbers are staff-only.", map: (input) => ({ body: input }) },
    listRules: { route: "GET /admin/shipping/rules", perm: "shipping.view", res: "ShippingRule[]" },
    getRule: { route: "GET /admin/shipping/rules/{id}", perm: "shipping.view", res: "ShippingRule", ...NULL, map: (id) => ({ path: { id } }) },
    saveRule: { route: "PUT /admin/shipping/rules/{id?}", perm: "shipping.manage", req: "ShippingRuleInput", res: "ShippingRule", ...SAVE, note: "POST when creating.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    deleteRule: { route: "DELETE /admin/shipping/rules/{id}", perm: "shipping.manage", ...VOID, map: (id) => ({ path: { id } }) },
    listClasses: { route: "GET /admin/shipping/classes", perm: "shipping.view", res: "ShippingClassUsage[]" },
    saveClass: { route: "PUT /admin/shipping/classes/{id?}", perm: "shipping.manage", req: "ShippingClassInput", res: "ShippingClassUsage", ...SAVE, note: "POST when creating.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    deleteClass: { route: "DELETE /admin/shipping/classes/{id}", perm: "shipping.manage", ...SAVE, note: "Refused while products use it.", map: (id) => ({ path: { id } }) },
    listPickups: { route: "GET /admin/shipping/pickups", perm: "shipping.view", res: "PickupLocation[]" },
    savePickup: { route: "PUT /admin/shipping/pickups/{id?}", perm: "shipping.manage", req: "PickupLocationInput", res: "PickupLocation", ...SAVE, note: "POST when creating.", map: (id, input) => ({ path: { id: id ?? "" }, body: input }) },
    deletePickup: { route: "DELETE /admin/shipping/pickups/{id}", perm: "shipping.manage", ...VOID, map: (id) => ({ path: { id } }) },
    getGeneral: { route: "GET /admin/shipping/settings", perm: "shipping.view", res: "ShippingGeneralSettings" },
    updateGeneral: { route: "PUT /admin/shipping/settings", perm: "shipping.manage", req: "ShippingGeneralSettings", ...VOID, map: (input) => ({ body: input }) },
    setMethodEnabled: { route: "PATCH /admin/shipping/zones/{zoneId}/methods/{methodId}", perm: "shipping.manage", ...SAVE, map: (zoneId, methodId, enabled) => ({ path: { zoneId, methodId }, body: { enabled } }) },
    testDraftZone: { route: "POST /admin/shipping/zones/test", perm: "shipping.manage", res: "RuledQuote", map: (zone, input) => ({ body: { zone, ...input } }) },
  },
  tax: {
    getSettings: { route: "GET /admin/tax/settings", perm: "taxes.view", res: "TaxSettings" },
    updateSettings: { route: "PUT /admin/tax/settings", perm: "taxes.manage", req: "TaxSettingsInput", res: "TaxSettings", ...SAVE, map: (input) => ({ body: input }) },
    classes: { route: "GET /admin/tax/classes", perm: "taxes.view", res: "TaxClassUsage[]" },
    listRates: { route: "GET /admin/tax/rates", perm: "taxes.view", res: "Paginated<TaxRateListItem>", map: (query) => ({ query }) },
    getRate: { route: "GET /admin/tax/rates/{id}", perm: "taxes.view", res: "TaxRateListItem", ...NULL, map: (id) => ({ path: { id } }) },
    createRate: { route: "POST /admin/tax/rates", perm: "taxes.manage", req: "TaxRateInput", res: "TaxRate", ...SAVE, map: (input) => ({ body: input }) },
    updateRate: { route: "PUT /admin/tax/rates/{id}", perm: "taxes.manage", req: "TaxRateInput", res: "TaxRate", ...SAVE, map: (id, input) => ({ path: { id }, body: input }) },
    deleteRate: { route: "DELETE /admin/tax/rates/{id}", perm: "taxes.manage", ...SAVE, map: (id) => ({ path: { id } }) },
    snapshotFor: { route: "POST /tax/snapshot", perm: "orders_create.create", req: "ShippingAddress", res: "OrderTaxSnapshot", map: (address) => ({ body: address }) },
    preview: { route: "POST /admin/tax/preview", perm: "taxes.view", req: "TaxPreviewInput", res: "TaxPreviewResult", map: (input) => ({ body: input }) },
  },
  payments: {
    listMethods: { route: "GET /admin/payment-methods", perm: "payments.view", res: "PaymentMethodListItem[]" },
    getMethod: { route: "GET /admin/payment-methods/{id}", perm: "payments.view", res: "PaymentMethodListItem", ...NULL, map: (id) => ({ path: { id } }) },
    updateMethod: { route: "PUT /admin/payment-methods/{id}", perm: "payments.manage", req: "PaymentMethodInput", res: "PaymentMethodSettings", ...SAVE, note: "Gateway secrets stay on the backend, never in this API.", map: (id, input) => ({ path: { id }, body: input }) },
    reorderMethods: { route: "POST /admin/payment-methods/reorder", perm: "payments.manage", ...SAVE, map: (ids) => ({ body: { ids } }) },
    checkoutMethods: { route: "GET /customer/payment-methods", perm: "customer", res: "CheckoutPaymentMethod[]" },
  },
  analytics: {
    report: { route: "GET /admin/reports", perm: "reports.view", res: "ReportData", note: "Compute in the database. Definitions: src/lib/reports/aggregate.ts.", map: (range) => ({ query: range }) },
    getDashboard: { route: "GET /admin/dashboard", perm: "dashboard.view", res: "DashboardSummary", map: (query) => ({ query: { from: query.range.from, to: query.range.to, compareFrom: query.compare?.from, compareTo: query.compare?.to } }) },
  },
};
