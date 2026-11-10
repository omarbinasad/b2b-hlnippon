import type { TaxRates } from "@/lib/orders/calc";
import type { reportBreakdowns, ReportSummary } from "@/lib/reports/aggregate";
import type { DeliveryDate } from "@/lib/delivery/schedule";
import type { Segments } from "@/lib/reminders/segment";
import type { RuledQuote, ShippingGeneralSettings, ShippingRule, ShippingRuleInput } from "@/lib/shipping/rules";
import type { PriceResolution, QuantityLimits, RuleConflict } from "@/lib/pricing/engine";
import type { StockChange, StockChangeContext } from "@/lib/orders/stock";
import type { ShippingItem } from "@/lib/shipping/engine";
import type { TaxCalculation } from "@/lib/tax/engine";
import type {
  AccountStatus,
  Actor,
  AdminNotificationFeed,
  CompanySettings,
  CompanySettingsInput,
  MediaItem,
  MediaKind,
  MediaUpdate,
  MediaUpload,
  BlogPost,
  DateRange,
  Role,
  RoleInput,
  StaffInput,
  StaffMember,
  EmailLog,
  EmailLogStatus,
  EmailSenderSettings,
  EmailTemplate,
  EmailTemplateInput,
  EmailTemplateKey,
  ReminderCampaign,
  ReminderCampaignInput,
  PickupLocation,
  PickupLocationInput,
  ShippingClassInput,
  ShippingClassUsage,
  Coupon,
  CouponInput,
  CouponListStatus,
  CouponUsage,
  AccountSummary,
  CustomerDeliveryLocation,
  CustomerProfileInput,
  InvoiceListItem,
  Quotation,
  QuotationQuoteInput,
  QuotationRequestInput,
  QuotationStatus,
  SavedList,
  SavedListDetail,
  SavedListLineInput,
  InventoryRow,
  BlogPostInput,
  ContentPage,
  ContentPageInput,
  ContentStatus,
  MenuLocation,
  NavigationMenu,
  NavigationMenuInput,
  ResolvedMenuItem,
  SiteContent,
  SiteContentInput,
  TermKind,
  TermUsage,
  BlogPostSummary,
  ContactMessage,
  ContactMessageInput,
  Cart,
  CartLineInput,
  QuickOrderPage,
  QuickOrderQuery,
  CheckoutInput,
  CheckoutPreview,
  RegistrationInput,
  CustomerDocument,
  AdjustItemInput,
  AdminCategoryRow,
  AdminProductRow,
  Attribute,
  AttributeValue,
  Brand,
  BrandFacet,
  BrandInput,
  AdminBrandRow,
  Category,
  CategoryInput,
  CategoryStatus,
  CreateOrderInput,
  AddressInput,
  Customer,
  CustomerDetailsInput,
  CustomerGroup,
  CustomerGroupInput,
  CustomerListItem,
  CustomerQuickInput,
  CustomerNotification,
  DashboardQuery,
  DashboardSummary,
  DeliveryRoute,
  FieldErrors,
  ID,
  Money,
  NotificationKind,
  Order,
  OrderableProduct,
  InvoiceKind,
  OrderEdit,
  OrderEditPreview,
  OrderLineQuote,
  OrderCustomerContext,
  PostcodeLookup,
  OrderNoteType,
  OrderStatus,
  OrderType,
  RecordPaymentInput,
  RefundInput,
  PageQuery,
  Paginated,
  PaymentStatus,
  PriceRule,
  PriceRuleAudience,
  PriceRuleInput,
  QuantityLimitRule,
  QuantityLimitRuleInput,
  RuleStatus,
  RuleTarget,
  Product,
  ProductInput,
  ProductPick,
  ProductStatus,
  ProductType,
  ProductSummary,
  Reminder,
  ReminderChannel,
  ReminderType,
  ResolvedPrice,
  ShippingAddress,
  ShippingCartLine,
  ShippingZone,
  ShippingZoneInput,
  StoreSettings,
  OrderTaxSnapshot,
  CheckoutPaymentMethod,
  PaymentAvailability,
  PaymentMethodId,
  PaymentMethodInput,
  PaymentMethodSettings,
  TaxPreviewLineInput,
  TaxRate,
  TaxRateInput,
  TaxSettings,
  TaxSettingsInput,
  ShippingClass,
  StockMovement,
  StockStatus,
  Tag,
  TaxClass,
  TaxClassOption,
} from "@/lib/types";

/**
 * Data-access contracts used by pages. The mock implementation lives in
 * `./mock-repositories.ts`; a Laravel or Django implementation should
 * implement these same interfaces (e.g. `./api-repositories.ts`) and be
 * selected in `./index.ts` — page components should not need to change.
 *
 * All searching, filtering, sorting and pagination happen behind these
 * interfaces (server-side), never in the browser.
 */

export type SortDir = "asc" | "desc";

/** Options shared by every listing: free-text search, sort, pagination. */
export interface ListQuery<SortField extends string> extends PageQuery {
  search?: string;
  sort?: SortField;
  dir?: SortDir;
}

/** Inclusive calendar dates ("YYYY-MM-DD") in the store time zone. */
export interface DateBounds {
  from?: string;
  to?: string;
}

// --- Results ------------------------------------------------------------------

/** Outcome of a create/update. Validation failures carry field errors (API: 422 `error.fields`). */
export type SaveResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message?: string };

// --- Products -----------------------------------------------------------------

export type ProductSortField = "name" | "sku" | "price" | "stock" | "updated";

export interface ProductListQuery extends ListQuery<ProductSortField> {
  /** Includes products in subcategories. */
  categorySlug?: string;
  /** Limit to products in ANY of these categories (subcategories included); combined with `categorySlug` (AND). */
  categorySlugs?: string[];
  /** Products carrying ANY of these brands. */
  brandSlugs?: string[];
  /** Restrict to these product ids (e.g. the result of a customer price-range lookup). */
  productIds?: ID[];
  stockStatus?: StockStatus;
  /** Only products flagged as featured. */
  featured?: boolean;
}

export interface AdminProductListQuery extends ProductListQuery {
  /** Omitted = published and draft (archived only when asked for). */
  status?: ProductStatus;
  type?: ProductType;
  /**
   * "missing": not purchasable for lack of a store-currency price (simple product without a price, or an enabled
   * variation without one) — e.g. imported products whose source price is in another currency. "set": fully priced.
   */
  pricing?: "missing" | "set";
}

export interface InventoryQuery extends PageQuery {
  search?: string;
  stockStatus?: StockStatus;
}

export interface ProductRepository {
  /** Public catalog: published + visible products only, never prices. Sortable by name or updated. */
  list(query?: ProductListQuery): Promise<Paginated<ProductSummary>>;
  getBySlug(slug: string): Promise<Product | null>;
  /** Public (active) categories. */
  listCategories(): Promise<Category[]>;
  /** Brands used by publicly listed products, with counts (shop filter). */
  listBrands(): Promise<BrandFacet[]>;
  /** Brands chosen for the homepage, in display order. productCount says whether a link to the shop would find anything. */
  featuredBrands(max: number): Promise<BrandFacet[]>;

  /** Admin catalog rows, any status, with prices. */
  adminList(query?: AdminProductListQuery): Promise<Paginated<AdminProductRow>>;
  /** Admin: full product including drafts/archived and prices. */
  getById(id: ID): Promise<Product | null>;
  create(input: ProductInput): Promise<SaveResult<Product>>;
  /** Stock changes made by the edit are recorded in the stock movement history under `byName`. */
  update(id: ID, input: ProductInput, byName?: string): Promise<SaveResult<Product>>;
  /** Copies a product as a new draft with unique slug/SKUs. */
  duplicate(id: ID): Promise<SaveResult<Product>>;
  /** Archive (hide from the store, keep history) or restore. */
  setStatus(id: ID, status: ProductStatus): Promise<SaveResult<Product>>;
  /**
   * Global stock change for a product or one variation (e.g. from an order page): a status for
   * status-managed stock, a count for counted stock. Options sharing the product's stock change together.
   * Never changes existing orders. Recorded in the stock movement history.
   */
  setStock(id: ID, variationId: ID | undefined, change: StockChange, context: StockChangeContext): Promise<SaveResult<Product>>;
  /** Every stockable line (simple products and options), excluding archived products. */
  inventory(query?: InventoryQuery): Promise<Paginated<InventoryRow>>;
  inventoryCounts(): Promise<{ total: number; low: number; out: number }>;
  /** Stock changes across all products, newest first. */
  allStockMovements(query?: ListQuery<never> & DateBounds): Promise<Paginated<StockMovement & { productName: string }>>;
  /** Stock change history of a product (all its options), newest first. */
  stockMovements(id: ID, query?: PageQuery): Promise<Paginated<StockMovement>>;
  /** Small server-side search for pickers (never the full catalog). Excludes archived products. */
  search(term: string, options?: { excludeIds?: ID[]; limit?: number }): Promise<ProductPick[]>;
  /** Picks for known IDs, in the given order (e.g. selected upsells). */
  getPicks(ids: ID[]): Promise<ProductPick[]>;
}

// --- Categories (admin) -------------------------------------------------------

export type CategorySortField = "path" | "name" | "products";

export interface CategoryListQuery extends ListQuery<CategorySortField> {
  status?: CategoryStatus;
}

export interface CategoryRepository {
  /** Every category including hidden ones (for pickers). */
  all(): Promise<Category[]>;
  list(query?: CategoryListQuery): Promise<Paginated<AdminCategoryRow>>;
  getById(id: ID): Promise<Category | null>;
  create(input: CategoryInput): Promise<SaveResult<Category>>;
  update(id: ID, input: CategoryInput): Promise<SaveResult<Category>>;
  /** Products directly in this category (not subcategories), paginated. */
  listProducts(id: ID, query?: PageQuery): Promise<Paginated<ProductPick>>;
  /** Adds/removes the category on products. Returns the number of products changed. */
  assignProducts(id: ID, change: { add?: ID[]; remove?: ID[] }): Promise<SaveResult<number>>;
}

// --- Catalog settings (taxonomies and classes used by the product form) --------

export type BrandSortField = "name" | "products" | "order";

export interface BrandListQuery extends ListQuery<BrandSortField> {
  showOnHome?: boolean;
}

export interface CatalogSettingsRepository {
  brands(): Promise<Brand[]>;
  /** Most used first (for "most used tags" suggestions). */
  tags(): Promise<Tag[]>;
  /** Store-wide defaults shown as placeholders in the product form. */
  storeDefaults(): Promise<{ lowStockThreshold: number }>;
  createBrand(name: string): Promise<SaveResult<Brand>>;
  /** Admin brand list, with logos and product counts. */
  adminBrands(query?: BrandListQuery): Promise<Paginated<AdminBrandRow>>;
  /** Creates when id is null. */
  saveBrand(id: ID | null, input: BrandInput): Promise<SaveResult<Brand>>;
  /** Brands with the number of products carrying each. */
  brandUsage(): Promise<TermUsage[]>;
  renameBrand(from: string, name: string): Promise<SaveResult<Brand>>;
  /** Removes it from the products that carry it. */
  deleteBrand(name: string): Promise<SaveResult<{ name: string }>>;
  /** Adds a reusable value to a store-wide attribute. */
  createAttributeValue(attributeId: ID, name: string): Promise<SaveResult<AttributeValue>>;
  /** Store-wide reusable attributes with their values. */
  attributes(): Promise<Attribute[]>;
  /** Classes referenced by the future shipping-rate settings. */
  shippingClasses(): Promise<ShippingClass[]>;
  /** Classes referenced by the future tax-rate settings. */
  taxClasses(): Promise<TaxClassOption[]>;
}

// --- Pricing and quantity rules ------------------------------------------------

export type PriceRuleSortField = "name" | "audience" | "target" | "priority" | "updated";

export interface PriceRuleListQuery extends ListQuery<PriceRuleSortField> {
  audienceType?: PriceRuleAudience["type"];
  targetType?: RuleTarget["type"];
  status?: RuleStatus;
  /** true = only rules that overlap or conflict with another active rule. */
  withConflicts?: boolean;
}

/** A detected overlap with another rule, with its name for display. */
export interface RuleConflictItem extends RuleConflict {
  otherName: string;
}

/** Rule with display names and detected overlaps, so lists can search, sort and warn. */
export interface PriceRuleListItem extends PriceRule {
  audienceName: string;
  targetName: string;
  conflicts: RuleConflictItem[];
}

export type QuantityRuleSortField = "name" | "target" | "priority" | "updated";

export interface QuantityRuleListQuery extends ListQuery<QuantityRuleSortField> {
  targetType?: RuleTarget["type"];
  status?: RuleStatus;
}

export interface QuantityRuleListItem extends QuantityLimitRule {
  targetName: string;
  conflicts: RuleConflictItem[];
}

/** One purchasable option for rule pickers. */
export interface RuleProductOption {
  productId: ID;
  name: string;
  unitLabel: string;
  variations: { id: ID; label: string; sku: string; basePrice?: Money; status: string }[];
  basePrice?: Money;
}

export interface RuleTestQuery {
  customerId?: ID;
  productId: ID;
  variationId?: ID;
  quantity: number;
}

/** Everything the "Test rules" panel shows. DEMO calculation — the backend enforces the real one. */
export interface RuleTestResult {
  customer?: { id: ID; companyName: string; status: AccountStatus; groupName?: string };
  product: { id: ID; name: string; unitLabel: string; variationLabel?: string };
  /** Undefined when no customer was given (quantity limits only). */
  price?: PriceResolution;
  limits: QuantityLimits;
  quantityError?: string;
}

export interface PricingRepository {
  /** Prices for a single customer at quantity 1. Never cache publicly. */
  getCustomerPrices(customerId: ID, productIds: ID[]): Promise<ResolvedPrice[]>;
  /**
   * Ids of products this (approved) customer can buy within the price range at quantity 1 —
   * own price incl. rules; for variable products, any active variation. Unpriced products never
   * match. Customer-scoped (shop price filter); never exposed to guests.
   */
  productIdsInPriceRange(customerId: ID, range: { min?: Money; max?: Money }): Promise<ID[]>;
  /** Lowest and highest price this (approved) customer can buy at, at quantity 1, for the shop's price slider; null if none. */
  priceBounds(customerId: ID): Promise<{ min: Money; max: Money } | null>;
  listRules(query?: PriceRuleListQuery): Promise<Paginated<PriceRuleListItem>>;
  getRule(id: ID): Promise<PriceRuleListItem | null>;
  createRule(input: PriceRuleInput, actor: Actor): Promise<SaveResult<PriceRule>>;
  updateRule(id: ID, input: PriceRuleInput, actor: Actor): Promise<SaveResult<PriceRule>>;
  setRuleStatus(id: ID, status: RuleStatus, actor: Actor): Promise<SaveResult<PriceRule>>;
  /** Product with its variations and base prices, for rule targets and the test panel. */
  productOption(productId: ID): Promise<RuleProductOption | null>;
  /** Price + quantity limits for a customer, product option and quantity, with explanations. */
  testRules(query: RuleTestQuery): Promise<RuleTestResult | null>;
}

export interface QuantityRuleRepository {
  list(query?: QuantityRuleListQuery): Promise<Paginated<QuantityRuleListItem>>;
  get(id: ID): Promise<QuantityRuleListItem | null>;
  create(input: QuantityLimitRuleInput, actor: Actor): Promise<SaveResult<QuantityLimitRule>>;
  update(id: ID, input: QuantityLimitRuleInput, actor: Actor): Promise<SaveResult<QuantityLimitRule>>;
  setStatus(id: ID, status: RuleStatus, actor: Actor): Promise<SaveResult<QuantityLimitRule>>;
  /** Effective per-line limits for a product option (most specific rule wins). */
  effectiveFor(productId: ID, variationId?: ID): Promise<QuantityLimits | null>;
}

// --- Customers ----------------------------------------------------------------

export type CustomerSortField = "company" | "registered" | "status" | "group" | "orders" | "spend";

export interface CustomerListQuery extends ListQuery<CustomerSortField>, DateBounds {
  status?: AccountStatus;
  groupId?: ID;
  prefecture?: string;
  /** true = has at least one non-cancelled order; false = none. */
  hasOrders?: boolean;
  /** Pending customers come first, each part in the requested sort order. */
  pendingFirst?: boolean;
}

export type GroupSortField = "name" | "customers";

export interface CustomerGroupListItem extends CustomerGroup {
  customerCount: number;
}

export type NotificationSortField = "date";

export interface NotificationListQuery extends ListQuery<NotificationSortField> {
  kind?: NotificationKind;
  unreadOnly?: boolean;
}

export interface CustomerRepository {
  /** Rows include group name and order aggregates (count, spend, last order). */
  list(query?: CustomerListQuery): Promise<Paginated<CustomerListItem>>;
  getById(id: ID): Promise<Customer | null>;
  /** Customer with order aggregates, for the admin detail page. */
  getListItem(id: ID): Promise<CustomerListItem | null>;
  /** Count per approval status (for the status summary). */
  statusCounts(): Promise<Record<AccountStatus, number>>;
  /** Any status; name/contact/email/phone search, max `limit` — for pickers. */
  search(term: string, options?: { excludeGroupId?: ID; limit?: number }): Promise<Pick<Customer, "id" | "companyName" | "contactName" | "status" | "groupId">[]>;
  /**
   * Online wholesale application: creates a `pending` customer with the business address (delivery + billing),
   * recorded as applied online. No login account or password — that needs the backend. Duplicate email/phone → 422.
   */
  register(input: RegistrationInput): Promise<SaveResult<Customer>>;
  /** Admin only: an uploaded identity document with its bytes (private; never cached). */
  getDocument(customerId: ID, documentId: ID): Promise<{ document: CustomerDocument; bytes: Uint8Array } | null>;
  /** Quick add with essentials only; records the initial status in the history. */
  create(input: CustomerQuickInput, actor: Actor): Promise<SaveResult<Customer>>;
  update(id: ID, input: CustomerDetailsInput, actor: Actor): Promise<SaveResult<Customer>>;
  /** The customer's own edit of their business and contact details. */
  updateProfile(id: ID, input: CustomerProfileInput, actor: Actor): Promise<SaveResult<Customer>>;
  /** Approval workflow step; appends an AccountStatusEvent. Reason required for reject/suspend. */
  setStatus(id: ID, status: AccountStatus, reason: string | undefined, actor: Actor): Promise<SaveResult<Customer>>;
  /** Create (no id) or update an address; keeps one default per address type. */
  saveAddress(id: ID, input: AddressInput, actor: Actor): Promise<SaveResult<Customer>>;
  deleteAddress(id: ID, addressId: ID, actor: Actor): Promise<SaveResult<Customer>>;
  /** Refused once the customer has an order: suspend them instead. */
  remove(id: ID, actor: Actor): Promise<SaveResult<{ id: ID }>>;
  /** All groups, e.g. for filter options. */
  listGroups(): Promise<CustomerGroup[]>;
  /** Groups as a searchable, sortable listing with member counts. */
  listGroupSummaries(query?: ListQuery<GroupSortField>): Promise<Paginated<CustomerGroupListItem>>;
  getGroup(id: ID): Promise<CustomerGroupListItem | null>;
  createGroup(input: CustomerGroupInput, actor: Actor): Promise<SaveResult<CustomerGroup>>;
  /** Rename / describe. The id never changes, so future price and quantity rules keep pointing at it. */
  updateGroup(id: ID, input: CustomerGroupInput, actor: Actor): Promise<SaveResult<CustomerGroup>>;
  /** Adds customers to (moving them from any other group) or removes them from this group. */
  assignGroupMembers(id: ID, change: { add: ID[]; remove: ID[] }, actor: Actor): Promise<SaveResult<CustomerGroupListItem>>;
  listNotifications(customerId: ID, query?: NotificationListQuery): Promise<Paginated<CustomerNotification>>;
}

// --- Orders -------------------------------------------------------------------

export type OrderSortField = "placed" | "number" | "customer" | "total" | "status";

export interface OrderListQuery extends ListQuery<OrderSortField>, DateBounds {
  /** Scope to one customer (always set for the customer portal). */
  customerId?: ID;
  status?: OrderStatus;
  /** Leave out cancelled orders (matches dashboard and customer order counts). Ignored when `status` is set. */
  excludeCancelled?: boolean;
  /** Only open orders (`isOpenOrder`). Ignored when `status` is set. */
  open?: boolean;
  paymentStatus?: PaymentStatus;
  deliveryRouteId?: ID;
  orderType?: OrderType;
}

/** An order in a listing, with its derived order type (first / repeat / walk-in). */
export type OrderListItem = Order & { orderType: OrderType };

export interface OrderCalculationSettings {
  /** Placeholder VAT rates (%) per class until the tax module exists. */
  taxRates: TaxRates;
  /** Tax class applied to shipping charges. */
  shippingTaxClass: TaxClass;
}

export interface OrderRepository {
  /** Refused unless the order is cancelled with no payment, refund or invoice. */
  remove(id: ID, actor: Actor): Promise<SaveResult<{ id: ID }>>;
  /** `search` matches order number and customer name; dates filter on placement date. Rows carry `orderType`. */
  list(query?: OrderListQuery): Promise<Paginated<OrderListItem>>;
  /** Pass customerId to scope the lookup to that customer's own orders. */
  getById(id: ID, customerId?: ID): Promise<Order | null>;
  calculationSettings(): Promise<OrderCalculationSettings>;
  /** Approved customers matching a name/email/phone search (max `limit`), for the order form. */
  searchCustomers(term: string, limit?: number): Promise<{ id: ID; companyName: string; contactName?: string; phone?: string; email?: string }[]>;
  /** Addresses and suggested delivery charge for an approved customer; null otherwise. */
  customerContext(customerId: ID): Promise<OrderCustomerContext | null>;
  /**
   * Purchasable options of a product with this customer's prices; null if not orderable. Without a customer id
   * (walk-in order) options carry the catalog price (sale price when active) — rule prices need an approved account.
   */
  orderableProduct(productId: ID, customerId?: ID): Promise<OrderableProduct | null>;
  /** Rule price and quantity limits for one line at a quantity (prices can change with bulk tiers). No customer id = walk-in. */
  quoteLine(customerId: ID | undefined, productId: ID, variationId: ID | undefined, quantity: number): Promise<OrderLineQuote | null>;
  /** Admin creates an order on behalf of a customer. Item details are snapshotted from the catalog. */
  create(input: CreateOrderInput, actor: Actor): Promise<SaveResult<Order>>;
  /** Moves along received → preparing → on_the_way → delivered, or cancels (with a note). */
  updateStatus(id: ID, status: OrderStatus, actor: Actor, note?: string): Promise<SaveResult<Order>>;
  addNote(id: ID, note: { type: OrderNoteType; body: string }, actor: Actor): Promise<SaveResult<Order>>;
  /** Changes an item's fulfilled weight and/or agreed unit price, recording an audit entry. */
  adjustItem(id: ID, input: AdjustItemInput, actor: Actor): Promise<SaveResult<Order>>;
  /**
   * Edits an existing order (adjust / add / remove / replace an item, order discount, delivery date):
   * validates against the order's status, recalculates with the order's own tax basis, records the
   * change in `adjustments` and keeps catalog products unchanged.
   */
  edit(id: ID, edit: OrderEdit, actor: Actor): Promise<SaveResult<Order>>;
  /**
   * Issues the next invoice document (see src/lib/orders/invoice.ts): the first invoice, a revision after the order
   * changed, or a credit note for a cancelled order. Issued documents are frozen and never rewritten.
   */
  issueInvoice(id: ID, input: { kind: InvoiceKind; reason?: string }, actor: Actor): Promise<SaveResult<Order>>;
  /**
   * Customer checkout from their server-side cart: re-prices every line for the customer, checks quantity rules and
   * stock, quotes shipping for the chosen address, snapshots tax and creates the order (`createdVia: "storefront"`,
   * never paid). Empties the cart. The same `idempotencyKey` returns the order already placed (no duplicate).
   */
  checkout(customerId: ID, input: CheckoutInput): Promise<SaveResult<Order>>;
  /** Totals for the customer dashboard. */
  accountSummary(customerId: ID): Promise<AccountSummary>;
  /** Every issued invoice document of a customer, newest first. */
  listInvoices(query: { customerId: ID; search?: string; page?: number; perPage?: number }): Promise<Paginated<InvoiceListItem>>;
  /** What `checkout` would create, without saving (totals for the checkout page). */
  checkoutPreview(customerId: ID, input: Omit<CheckoutInput, "idempotencyKey">): Promise<SaveResult<CheckoutPreview>>;
  /**
   * Records a refund (see src/lib/orders/refund.ts): items, shipping or another amount, or an overpayment.
   * Optionally returns refunded quantities to stock. DEMO: status "recorded" — no money is moved; the payment
   * backend processes refunds and sets "processed".
   */
  refund(id: ID, input: RefundInput, actor: Actor): Promise<SaveResult<Order>>;
  /** Admin records payment received outside the site (unpaid/invoiced → paid). Never charges anyone. */
  recordPayment(id: ID, input: RecordPaymentInput, actor: Actor): Promise<SaveResult<Order>>;
  /** Same as `edit` without saving: before/after totals for the confirmation step. */
  previewEdit(id: ID, edit: OrderEdit): Promise<{ ok: true; value: OrderEditPreview } | { ok: false; errors: FieldErrors; message?: string }>;
}

// --- Cart -----------------------------------------------------------------------

/**
 * Server-side cart of an approved customer. The browser only sends product, option and quantity; every view is
 * re-priced for the customer (rules, sale price, bulk tiers) and checked against quantity rules and stock.
 * Customer-specific — never cache publicly.
 */
export interface CartRepository {
  get(customerId: ID): Promise<Cart>;
  /** Adds lines (same option = quantities summed). Unknown, archived or unpriced products are skipped with a reason. */
  add(customerId: ID, lines: CartLineInput[]): Promise<SaveResult<{ cart: Cart; added: number; skipped: string[] }>>;
  /** Quantity 0 removes the line. */
  setQuantity(customerId: ID, lineId: string, quantity: number): Promise<SaveResult<Cart>>;
  /**
   * Quick order sheet: published products (name/SKU search, category incl. subcategories), sorted by name, paginated
   * by product, one line per orderable option. Prices only when `customerId` is an approved customer (null = no prices).
   */
  quickOrder(customerId: ID | null, query?: QuickOrderQuery): Promise<QuickOrderPage>;
  remove(customerId: ID, lineId: string): Promise<SaveResult<Cart>>;
  /** Saves a code on the cart if it applies now. It is re-checked on every read and at checkout. */
  applyCoupon(customerId: ID, code: string): Promise<SaveResult<Cart>>;
  removeCoupon(customerId: ID): Promise<SaveResult<Cart>>;
}

// --- Delivery and reminders ---------------------------------------------------

export type RouteSortField = "name" | "fee" | "cutoff";

export interface RouteListQuery extends ListQuery<RouteSortField> {
  active?: boolean;
}

export type ReminderSortField = "type" | "lastSent";

export interface ReminderListQuery extends ListQuery<ReminderSortField> {
  type?: ReminderType;
  channel?: ReminderChannel;
  active?: boolean;
}

export interface DeliveryRepository {
  listRoutes(query?: RouteListQuery): Promise<Paginated<DeliveryRoute>>;
  /** Each saved delivery address with its route and next delivery dates. */
  forCustomer(customerId: ID): Promise<CustomerDeliveryLocation[]>;
  getRoute(id: ID): Promise<DeliveryRoute | null>;
  /** Next dates, eligible customers and open orders, for the schedule page. */
  routeDetail(id: ID): Promise<DeliveryRouteDetail | null>;
  saveRoute(id: ID | null, input: DeliveryRouteInput, actor: Actor): Promise<SaveResult<DeliveryRoute>>;
  /** Refused while a reminder campaign uses it. */
  deleteRoute(id: ID, actor: Actor): Promise<SaveResult<{ id: ID }>>;
  listReminders(query?: ReminderListQuery): Promise<Paginated<Reminder>>;
}

// --- Analytics ----------------------------------------------------------------

// --- Locations ------------------------------------------------------------------

export interface LocationRepository {
  /**
   * Postcode → prefecture/city/area suggestions. MOCK: a small sample dataset;
   * "not_found" means "not in the data", never "invalid postcode".
   */
  lookupPostcode(postalCode: string): Promise<PostcodeLookup>;
}

// --- Store settings and shipping ------------------------------------------------------

export interface SettingsRepository {
  getStore(): Promise<StoreSettings>;
}

export type ZoneSortField = "match" | "name";

export interface ShippingZoneListItem extends ShippingZone {
  locationSummary: string;
}

export interface ShippingQuoteInput {
  address: ShippingAddress;
  items: ShippingCartLine[];
  couponCode?: string;
  /** Tester only: use this group instead of the customer's. */
  customerGroupId?: ID;
  /** Tester only: use these numbers instead of the cart's. */
  grams?: number;
  subtotal?: number;
  /** Prices lines with this customer's rule/sale price when a line has no unitPrice. */
  customerId?: ID;
}

/** A cart line resolved for shipping: weight/class from the variation when it overrides the product. */
export interface ShippingQuoteLine extends ShippingItem {
  sku: string;
  variationLabel?: string;
  weightFrom: "variation" | "product";
  priceSource: "given" | "rule" | "sale" | "regular";
}

/** DEMO calculation with sample rates; the backend must repeat it at cart, checkout and order creation. */
export interface ShippingQuoteResult {
  quote: RuledQuote;
  lines: ShippingQuoteLine[];
  /** Lines that could not be resolved (unknown product/variation or no price). */
  skipped: string[];
}

export interface ShippingRepository {
  /** Default order is the matching order: postcode zones, then city, then prefecture, fallback last. */
  listZones(query?: ListQuery<ZoneSortField>): Promise<Paginated<ShippingZoneListItem>>;
  getZone(id: ID): Promise<ShippingZoneListItem | null>;
  createZone(input: ShippingZoneInput, actor: Actor): Promise<SaveResult<ShippingZone>>;
  updateZone(id: ID, input: ShippingZoneInput, actor: Actor): Promise<SaveResult<ShippingZone>>;
  /** The fallback zone cannot be deleted. */
  deleteZone(id: ID, actor: Actor): Promise<SaveResult<{ id: ID }>>;
  quote(input: ShippingQuoteInput): Promise<ShippingQuoteResult>;
  listRules(): Promise<ShippingRule[]>;
  getRule(id: ID): Promise<ShippingRule | null>;
  saveRule(id: ID | null, input: ShippingRuleInput, actor: Actor): Promise<SaveResult<ShippingRule>>;
  deleteRule(id: ID, actor: Actor): Promise<void>;
  listClasses(): Promise<ShippingClassUsage[]>;
  saveClass(id: ID | null, input: ShippingClassInput, actor: Actor): Promise<SaveResult<ShippingClassUsage>>;
  /** Refused while products use the class. */
  deleteClass(id: ID, actor: Actor): Promise<SaveResult<{ id: ID }>>;
  listPickups(): Promise<PickupLocation[]>;
  savePickup(id: ID | null, input: PickupLocationInput, actor: Actor): Promise<SaveResult<PickupLocation>>;
  deletePickup(id: ID, actor: Actor): Promise<void>;
  getGeneral(): Promise<ShippingGeneralSettings>;
  updateGeneral(input: ShippingGeneralSettings, actor: Actor): Promise<void>;
  setMethodEnabled(zoneId: ID, methodId: ID, enabled: boolean, actor: Actor): Promise<SaveResult<{ id: ID }>>;
  /** Quotes a zone that isn't saved yet, for the guided setup. */
  testDraftZone(zone: ShippingZoneInput, input: { address: ShippingAddress; grams: number; subtotal: number }): Promise<RuledQuote>;
}

// --- Tax ------------------------------------------------------------------------------

export type TaxRateSortField = "match" | "name" | "percent";

export interface TaxRateListQuery extends ListQuery<TaxRateSortField> {
  taxClass?: TaxClass;
  enabled?: boolean;
}

export interface TaxRateListItem extends TaxRate {
  locationLabel: string;
}

/** Tax class with how many products / variation overrides use it. */
export interface TaxClassUsage extends TaxClassOption {
  products: number;
  variationOverrides: number;
  /** Has an enabled country-wide (fallback) rate. */
  hasFallback: boolean;
}

export interface TaxPreviewInput {
  address: ShippingAddress;
  customerId?: ID;
  lines: TaxPreviewLineInput[];
  /** "auto" = suggested shipping method; "none" = no shipping; otherwise a method id of the matched zone. */
  shippingMethodId?: string;
  /** Overrides the shipping amount (e.g. an agreed charge on an admin order). */
  shippingAmount?: Money;
}

export interface TaxPreviewLine {
  productId: ID;
  variationId?: ID;
  name: string;
  variationLabel?: string;
  sku: string;
  quantity: number;
  unitPrice: Money;
  priceSource: "given" | "rule" | "sale" | "regular";
  taxClass: TaxClass;
  classFrom: "variation" | "product";
  taxable: boolean;
}

/** DEMO calculation with fictional rates; the backend performs the authoritative calculation. */
export interface TaxPreviewResult {
  calc: TaxCalculation;
  lines: TaxPreviewLine[];
  shipping: { zoneName?: string; options: { id: ID; name: string; cost?: Money; available: boolean }[]; selectedId?: ID; amount: Money };
  snapshot: OrderTaxSnapshot;
  /** Per-class matching explanation for this address. */
  matches: { taxClass: TaxClass; explanation: string }[];
  skipped: string[];
}

export interface TaxRepository {
  getSettings(): Promise<TaxSettings>;
  updateSettings(input: TaxSettingsInput, actor: Actor): Promise<SaveResult<TaxSettings>>;
  classes(): Promise<TaxClassUsage[]>;
  listRates(query?: TaxRateListQuery): Promise<Paginated<TaxRateListItem>>;
  getRate(id: ID): Promise<TaxRateListItem | null>;
  createRate(input: TaxRateInput, actor: Actor): Promise<SaveResult<TaxRate>>;
  updateRate(id: ID, input: TaxRateInput, actor: Actor): Promise<SaveResult<TaxRate>>;
  deleteRate(id: ID, actor: Actor): Promise<SaveResult<{ id: ID }>>;
  /** Current settings + rates matched for an address, frozen for a new order. */
  snapshotFor(address: ShippingAddress): Promise<OrderTaxSnapshot>;
  preview(input: TaxPreviewInput): Promise<TaxPreviewResult>;
}

// --- Payment methods (settings only) ---------------------------------------------------

export interface PaymentMethodListItem extends PaymentMethodSettings {
  availability: PaymentAvailability;
}

/**
 * Payment method SETTINGS. No payment processing, card data or gateway secrets: the
 * backend owns provider credentials and only reports the connection state.
 */
export interface PaymentSettingsRepository {
  /** All methods in display order, with availability. */
  listMethods(): Promise<PaymentMethodListItem[]>;
  getMethod(id: PaymentMethodId): Promise<PaymentMethodListItem | null>;
  updateMethod(id: PaymentMethodId, input: PaymentMethodInput, actor: Actor): Promise<SaveResult<PaymentMethodSettings>>;
  /** Saves a new display order; `ids` must list every method exactly once. */
  reorderMethods(ids: PaymentMethodId[], actor: Actor): Promise<SaveResult<PaymentMethodListItem[]>>;
  /**
   * For checkout (not built yet): enabled AND available methods, in display order, with
   * customer-facing fields only. Online payment is excluded until a provider is connected.
   */
  checkoutMethods(): Promise<CheckoutPaymentMethod[]>;
}

export interface AnalyticsRepository {
  /** Reports screen figures; cancelled orders count only in the status report. */
  report(range: DateRange): Promise<ReportData>;
  /** Admin dashboard figures for a date range, optionally compared with a second range. */
  getDashboard(query: DashboardQuery): Promise<DashboardSummary>;
}

// --- Journal (blog) --------------------------------------------------------------------

export type ContentSortField = "updated" | "published" | "title";

export interface ContentListQuery extends ListQuery<ContentSortField> {
  /** Without a status, everything except the trash. */
  status?: ContentStatus;
}

export interface PageRepository {
  getLiveBySlug(slug: string): Promise<ContentPage | null>;
  listLive(): Promise<ContentPage[]>;
  adminList(query?: ContentListQuery): Promise<Paginated<ContentPage>>;
  statusCounts(): Promise<Record<ContentStatus, number>>;
  getById(id: ID): Promise<ContentPage | null>;
  /** Creates when `id` is null. */
  save(id: ID | null, input: ContentPageInput, actor: Actor): Promise<SaveResult<ContentPage>>;
  trash(id: ID, actor: Actor): Promise<void>;
  restore(id: ID, actor: Actor): Promise<void>;
  /** Only from the trash. */
  deleteForever(id: ID, actor: Actor): Promise<void>;
}

export interface PostRepository {
  /** Live posts, newest first. */
  list(query?: { excludeSlug?: string; limit?: number }): Promise<BlogPostSummary[]>;
  getBySlug(slug: string): Promise<BlogPost | null>;
  /** Public blog archive. */
  /** `categories` matches a post in any of them. `category` is the older single form, still accepted. */
  archive(query: { search?: string; category?: string; categories?: string[]; page?: number; perPage?: number }): Promise<Paginated<BlogPostSummary>>;
  categories(): Promise<string[]>;
  terms(kind: TermKind): Promise<TermUsage[]>;
  /** Adds a term when `from` is null; otherwise renames it on every post. */
  saveTerm(kind: TermKind, from: string | null, name: string): Promise<SaveResult<{ name: string }>>;
  /** Removes it from every post. Refused if a published post would be left without a category. */
  deleteTerm(kind: TermKind, name: string): Promise<SaveResult<{ name: string }>>;
  adminList(query?: ContentListQuery & { category?: string }): Promise<Paginated<BlogPost>>;
  statusCounts(): Promise<Record<ContentStatus, number>>;
  getById(id: ID): Promise<BlogPost | null>;
  /** Creates when `id` is null. */
  save(id: ID | null, input: BlogPostInput, actor: Actor): Promise<SaveResult<BlogPost>>;
  trash(id: ID, actor: Actor): Promise<void>;
  restore(id: ID, actor: Actor): Promise<void>;
  /** Only from the trash. */
  deleteForever(id: ID, actor: Actor): Promise<void>;
}

export interface NavigationRepository {
  list(): Promise<NavigationMenu[]>;
  getById(id: ID): Promise<NavigationMenu | null>;
  /** The menu at a location, ready to render. Links to pages that are not live are left out. */
  resolved(location: Exclude<MenuLocation, "none">): Promise<ResolvedMenuItem[]>;
  /** Creates when `id` is null. A location holds one menu, so taking one moves any other menu off it. */
  save(id: ID | null, input: NavigationMenuInput, actor: Actor): Promise<SaveResult<NavigationMenu>>;
  remove(id: ID, actor: Actor): Promise<void>;
}

export interface SiteContentRepository {
  /** Homepage sections and About page content. */
  get(): Promise<SiteContent>;
  update(input: SiteContentInput, actor: Actor): Promise<SaveResult<SiteContent>>;
}

// --- Contact form ------------------------------------------------------------------------

export interface ContactRepository {
  /** Validates and stores a message. The backend also rate-limits it and emails the team; the demo sends nothing. */
  submit(input: ContactMessageInput): Promise<SaveResult<ContactMessage>>;
}

// --- Admin notifications -------------------------------------------------------------------

export interface AdminNotificationRepository {
  /** New orders, registrations, stock alerts and contact messages, newest first, with the bell and sidebar counts. */
  feed(query?: { limit?: number }): Promise<AdminNotificationFeed>;
  markRead(id: ID): Promise<void>;
  markAllRead(): Promise<void>;
}

// --- Company settings and media ---------------------------------------------------------------

export interface CompanyRepository {
  get(): Promise<CompanySettings>;
  update(input: CompanySettingsInput, actor: Actor): Promise<SaveResult<CompanySettings>>;
  /** Setup wizard: marks the first-time setup as finished. */
  completeSetup(actor: Actor): Promise<CompanySettings>;
  /** DEMO: back to the sample company. The backend does not need this. */
  resetDemo(): Promise<CompanySettings>;
}

export type MediaSortField = "date" | "name" | "size";

export interface MediaListQuery extends ListQuery<MediaSortField> {
  kind?: MediaKind;
}

export interface MediaRepository {
  list(query?: MediaListQuery): Promise<Paginated<MediaItem>>;
  getById(id: ID): Promise<MediaItem | null>;
  /** File contents and type for serving an uploaded file. */
  content(id: ID): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  upload(input: MediaUpload, actor: Actor): Promise<SaveResult<MediaItem>>;
  update(id: ID, input: MediaUpdate, actor: Actor): Promise<SaveResult<MediaItem>>;
  remove(id: ID, actor: Actor): Promise<void>;
}

// --- Customer portal ----------------------------------------------------------------------

export interface SavedListRepository {
  list(customerId: ID): Promise<SavedList[]>;
  /** With live product details and this customer's prices. */
  get(customerId: ID, id: ID): Promise<SavedListDetail | null>;
  create(customerId: ID, name: string, lines?: SavedListLineInput[]): Promise<SaveResult<SavedList>>;
  createFromOrder(customerId: ID, orderId: ID, name?: string): Promise<SaveResult<SavedList>>;
  rename(customerId: ID, id: ID, name: string): Promise<SaveResult<SavedList>>;
  remove(customerId: ID, id: ID): Promise<void>;
  /** The same product and option adds to the existing line. */
  addItem(customerId: ID, id: ID, line: SavedListLineInput): Promise<SaveResult<SavedList>>;
  setQuantity(customerId: ID, id: ID, itemId: ID, quantity: number): Promise<SaveResult<SavedList>>;
  removeItem(customerId: ID, id: ID, itemId: ID): Promise<SaveResult<SavedList>>;
  addToCart(customerId: ID, id: ID): Promise<SaveResult<{ added: number; skipped: string[] }>>;
}

export interface QuotationListQuery extends PageQuery {
  /** Always set on the customer portal. */
  customerId?: ID;
  status?: QuotationStatus;
  search?: string;
}

export interface QuotationRepository {
  list(query?: QuotationListQuery): Promise<Paginated<Quotation>>;
  counts(): Promise<{ requested: number }>;
  /** Pass customerId to limit the lookup to that customer's own quotations. */
  getById(id: ID, customerId?: ID): Promise<Quotation | null>;
  request(customerId: ID, input: QuotationRequestInput): Promise<SaveResult<Quotation>>;
  /** Staff price every line and set a validity date. */
  sendQuote(id: ID, input: QuotationQuoteInput, actor: Actor): Promise<SaveResult<Quotation>>;
  decline(id: ID, reason: string, actor: Actor): Promise<SaveResult<Quotation>>;
  /** Accepting creates an order at the quoted prices. An expired quote can't be accepted. */
  respond(customerId: ID, id: ID, answer: "accept" | "reject", actor: Actor): Promise<SaveResult<Quotation>>;
}

export interface CouponRepository {
  list(query?: PageQuery & { search?: string; status?: CouponListStatus }): Promise<Paginated<Coupon>>;
  getById(id: ID): Promise<Coupon | null>;
  usage(id: ID, query?: PageQuery): Promise<Paginated<CouponUsage>>;
  /** Creates when `id` is null. Codes are unique, compared in capitals. */
  save(id: ID | null, input: CouponInput, actor: Actor): Promise<SaveResult<Coupon>>;
  setEnabled(id: ID, enabled: boolean, actor: Actor): Promise<void>;
  /** Past orders keep their own record of the code and amount. */
  remove(id: ID, actor: Actor): Promise<void>;
}

export interface DeliveryRouteDetail {
  upcoming: DeliveryDate[];
  customers: { id: ID; name: string }[];
  orders: { id: ID; number: string; customerName: string; status: OrderStatus; requestedDeliveryDate?: string }[];
}

export type DeliveryRouteInput = Pick<DeliveryRoute, "name" | "areas" | "deliveryDays" | "cutoffTime" | "excludedDates" | "extraDates" | "active">;

export interface EmailRepository {
  templates(): Promise<EmailTemplate[]>;
  template(key: EmailTemplateKey): Promise<EmailTemplate | null>;
  saveTemplate(key: EmailTemplateKey, input: EmailTemplateInput, actor: Actor): Promise<SaveResult<EmailTemplate>>;
  resetTemplate(key: EmailTemplateKey, actor: Actor): Promise<void>;
  /** Renders a saved template or an unsaved draft with sample values. */
  preview(key: EmailTemplateKey, draft?: { subject: string; bodyHtml: string }): Promise<{ from: string; subject: string; bodyHtml: string; footer?: string }>;
  sender(): Promise<EmailSenderSettings>;
  saveSender(input: EmailSenderSettings, actor: Actor): Promise<SaveResult<EmailSenderSettings>>;
  logs(query?: PageQuery & { search?: string; status?: EmailLogStatus; templateKey?: EmailTemplateKey }): Promise<Paginated<EmailLog>>;
  retry(id: ID, actor: Actor): Promise<SaveResult<EmailLog>>;
}

export interface ReminderPreview {
  campaign: ReminderCampaign;
  route: DeliveryRoute;
  next: DeliveryDate | null;
  /** YYYY-MM-DD: when this reminder would go out. */
  sendOn: string | null;
  segments: Segments;
  emails: { withOrder: { subject: string; bodyHtml: string }; withoutOrder: { subject: string; bodyHtml: string } } | null;
}

export interface ReminderRepository {
  list(query?: PageQuery & { search?: string }): Promise<Paginated<ReminderCampaign>>;
  getById(id: ID): Promise<ReminderCampaign | null>;
  save(id: ID | null, input: ReminderCampaignInput, actor: Actor): Promise<SaveResult<ReminderCampaign>>;
  remove(id: ID, actor: Actor): Promise<void>;
  preview(id: ID): Promise<ReminderPreview | null>;
  /** DEMO: writes what a run would send to the email log. Never sends. One per customer, campaign and date. */
  simulate(id: ID, actor: Actor): Promise<SaveResult<{ created: number; skipped: number }>>;
  history(id: ID, query?: PageQuery): Promise<Paginated<EmailLog>>;
}

export type ReportData = { summary: ReportSummary } & ReturnType<typeof reportBreakdowns>;

export interface StaffRepository {
  roles(): Promise<Role[]>;
  role(id: ID): Promise<Role | null>;
  /** Staff per role id. */
  staffCounts(): Promise<Record<ID, number>>;
  /** Creates when `id` is null. `actorCapabilities`: nobody can grant what they don't have themselves. */
  saveRole(id: ID | null, input: RoleInput, actorCapabilities: string[]): Promise<SaveResult<Role>>;
  duplicateRole(id: ID, actorCapabilities: string[]): Promise<SaveResult<Role>>;
  /** Refused for built-in roles and roles in use. Administrator can't be renamed or lose permissions. */
  deleteRole(id: ID): Promise<SaveResult<{ id: ID }>>;
  staff(query?: PageQuery & { search?: string; roleId?: ID }): Promise<Paginated<StaffMember>>;
  staffMember(id: ID): Promise<StaffMember | null>;
  /** Refused if it would leave no active administrator. The action also refuses changing someone with more permissions than the actor. */
  saveStaff(id: ID | null, input: StaffInput): Promise<SaveResult<StaffMember>>;
  removeStaff(id: ID): Promise<SaveResult<{ id: ID }>>;
}

export interface Repositories {
  staff: StaffRepository;
  emails: EmailRepository;
  reminders: ReminderRepository;
  coupons: CouponRepository;
  savedLists: SavedListRepository;
  quotations: QuotationRepository;
  company: CompanyRepository;
  media: MediaRepository;
  adminNotifications: AdminNotificationRepository;
  contact: ContactRepository;
  posts: PostRepository;
  pages: PageRepository;
  navigation: NavigationRepository;
  siteContent: SiteContentRepository;
  products: ProductRepository;
  categories: CategoryRepository;
  catalogSettings: CatalogSettingsRepository;
  pricing: PricingRepository;
  quantityRules: QuantityRuleRepository;
  customers: CustomerRepository;
  orders: OrderRepository;
  cart: CartRepository;
  delivery: DeliveryRepository;
  locations: LocationRepository;
  settings: SettingsRepository;
  shipping: ShippingRepository;
  tax: TaxRepository;
  payments: PaymentSettingsRepository;
  analytics: AnalyticsRepository;
}
