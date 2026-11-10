import type { ContentPage, HeroSlide, NavigationMenu, SiteContent, SiteImage } from "@/lib/types";

/*
 * SAMPLE website content for the demo company: homepage, About page, policy pages, menus. Everything here is editable in
 * the admin (Pages, Menus, Homepage) and is sample wording, not a rule of the platform. Replace it for a real company.
 */
const AT = "2026-01-01T00:00:00+09:00";
const OWNER: SiteImage = { src: "/images/owner.webp", alt: "Business owner standing in the warehouse", width: 1749, height: 1454 };

/** The sample homepage hero, from the owner's design: a photo per theme, with the copy on a frosted card. */
export const HERO_SLIDE: HeroSlide = {
  eyebrow: "HL Nippon Wholesale",
  title: "Stock your business with confidence",
  description: "Halal meat, seafood and essential groceries supplied in business-ready quantities across Japan.",
  cta: { label: "Shop wholesale", href: "/shop" },
  secondaryCta: { label: "Open a trade account", href: "/register" },
  image: { src: "/brand/hero/hero-light.webp", alt: "Boxes of halal beef, chicken, mutton, seafood, rice, spices and oil on a pallet at a warehouse, with a delivery truck behind", width: 2089, height: 753 },
  imageDark: { src: "/brand/hero/hero-dark.webp", alt: "Boxes of halal beef, chicken, mutton, seafood, rice, spices and oil on a pallet inside a lit warehouse at night, with a delivery truck behind", width: 2089, height: 753 },
  icons: [],
};

/** Three sample slides on the same photos. Each slide can have its own photos in the homepage builder. */
export const HERO_SLIDES: HeroSlide[] = [
  HERO_SLIDE,
  {
    ...HERO_SLIDE,
    eyebrow: "Halal meat & seafood",
    title: "Halal meat and fish, delivered chilled",
    description: "Beef, chicken, mutton and seafood for kitchens and shops, on scheduled delivery routes.",
    cta: { label: "Shop meat", href: "/shop?category=meat" },
    secondaryCta: { label: "See delivery areas", href: "/#delivery" },
  },
  {
    ...HERO_SLIDE,
    eyebrow: "Pantry staples",
    title: "Rice, spices and everyday essentials",
    description: "Basmati rice, flour, lentils, spices and oils in restaurant and retail pack sizes.",
    cta: { label: "Shop cooking essentials", href: "/shop?category=cooking" },
    secondaryCta: { label: "View all products", href: "/shop" },
  },
];

export const seedSiteContent: SiteContent = {
  topBar: "Wholesale halal groceries for businesses across Japan",
  updatedAt: AT,
  sections: [
    {
      id: "sec-hero",
      type: "hero",
      enabled: true,
      slides: HERO_SLIDES,
      highlights: [
        { icon: "shieldCheck", label: "Halal certified suppliers" },
        { icon: "sparkles", label: "Fresh, high quality" },
        { icon: "truck", label: "Scheduled delivery" },
      ],
    },
    {
      id: "sec-benefits",
      type: "benefits",
      enabled: true,
      items: [
        { icon: "shieldCheck", title: "Halal products", text: "A wide range of halal groceries" },
        { icon: "coins", title: "Wholesale pricing", text: "Business prices after account approval" },
        { icon: "truck", title: "Scheduled delivery", text: "Delivery routes with set days and cutoffs" },
        { icon: "headset", title: "Dedicated support", text: "Our team helps with orders and accounts" },
      ],
    },
    {
      id: "sec-categories",
      type: "categories",
      enabled: true,
      eyebrow: "Browse our catalog",
      title: "Everything your business needs",
      slugs: ["meat", "fish", "vegetables-fruits", "cooking", "masala-spices", "snacks-sweets", "drink-beverage", "nuts-dry-fruits", "country-wise", "ramadan-special"],
      max: 12,
    },
    { id: "sec-featured", type: "featuredProducts", enabled: false, eyebrow: "Popular with our customers", title: "Featured products", max: 8 },
    { id: "sec-quick", type: "quickOrder", enabled: true, title: "Restock faster with quick order", text: "Search by product name or SKU, enter quantities, then add everything to your cart at once." },
    {
      id: "sec-business",
      type: "business",
      enabled: true,
      eyebrow: "",
      title: "Built for Food Businesses",
      text: "We understand your business needs and provide the support you deserve.",
      cta: { label: "Learn More About Us", href: "/about" },
      image: OWNER,
      cards: [
        { icon: "file", title: "Invoice & Credit Support", text: "Get invoices and flexible payment options for eligible businesses." },
        { icon: "truckFast", title: "Repeat Orders Made Easy", text: "Reorder your past purchases in just a few clicks." },
        { icon: "users", title: "Dedicated Account Assistance", text: "Our wholesale team is always here to support you." },
        { icon: "box", title: "Flexible Case Quantities", text: "Order by the case with clear MOQ and tiered pricing." },
      ],
    },
    { id: "sec-brands", type: "brands", enabled: true, title: "Trusted Brands", max: 7 },
    { id: "sec-promo", type: "promo", enabled: false, eyebrow: "Special offer", title: "Add a promotion here", text: "Turn this section on and edit it to feature a seasonal range or offer.", cta: { label: "View products", href: "/shop" }, image: null },
    { id: "sec-delivery", type: "delivery", enabled: true, eyebrow: "Delivery information", title: "Plan your stock. We'll plan the delivery.", text: "Choose your area to see the delivery route, delivery days and order cutoff.", image: null },
    {
      id: "sec-steps",
      type: "steps",
      enabled: true,
      eyebrow: "How it works",
      title: "Start wholesale shopping in 4 simple steps",
      items: [
        { title: "Create an account", text: "Fill in the business application form." },
        { title: "Submit business details", text: "Tell us about your business and delivery address." },
        { title: "Get approved", text: "We review and approve your application." },
        { title: "See trade prices", text: "Approved accounts see wholesale prices and quantity rules." },
      ],
    },
    { id: "sec-journal", type: "journal", enabled: true, eyebrow: "From our wholesale journal", title: "Guides for food businesses", max: 3 },
    { id: "sec-contact", type: "contact", enabled: true, title: "Let's grow your business together.", text: "Join our wholesale network across Japan.", cta: { label: "Contact our team", href: "/contact" } },
  ],
  // DRAFT wording: no founding year, figures or certifications until the owner supplies real ones.
  about: {
    eyebrow: "About us",
    title: "Your wholesale partner for halal food supply",
    text: "We supply halal groceries to restaurants, grocers, caterers and distributors across Japan, with wholesale pricing for approved businesses and scheduled deliveries you can plan around.",
    image: OWNER,
    pillars: [
      { icon: "target", title: "Our mission", text: "To make wholesale buying simple and dependable for food businesses: quality halal products, clear pricing for each account, and deliveries you can plan around." },
      { icon: "eye", title: "Our vision", text: "To be the supplier food businesses across Japan rely on first, helping every kitchen and shop serve its community with confidence." },
    ],
    valuesEyebrow: "What we stand for",
    valuesTitle: "How we work with you",
    values: [
      { icon: "shieldCheck", title: "Halal first", text: "Halal products are the centre of our catalog, and we help you find the details you need." },
      { icon: "coins", title: "Clear pricing", text: "Approved accounts see their own wholesale prices and quantity rules before ordering." },
      { icon: "truck", title: "Reliable delivery", text: "Scheduled routes with set delivery days and order cutoffs, so you can plan your stock." },
      { icon: "headset", title: "Real support", text: "Talk to our team about your account, your orders and the products you need." },
    ],
    serveEyebrow: "Who we serve",
    serveTitle: "Built for food businesses of every size",
    serveText: "From a single kitchen to a regional distributor, you get a wholesale account set up around how you buy.",
    serve: [
      { icon: "pot", title: "Restaurants" },
      { icon: "store", title: "Grocers and shops" },
      { icon: "users", title: "Caterers" },
      { icon: "truck", title: "Distributors" },
    ],
    ctaTitle: "Ready to order wholesale?",
    ctaText: "Apply for a business account, and we'll review your application.",
  },
};

const page = (id: string, slug: string, title: string, excerpt: string, bodyHtml: string): ContentPage => ({
  id, slug, title, excerpt, bodyHtml, status: "published", visibility: "public", publishedAt: AT, seo: {}, authorName: "Website team", createdAt: AT, updatedAt: AT,
});

export const seedPages: ContentPage[] = [
  page("page-privacy", "privacy-policy", "Privacy policy", "How we handle your business and contact information (sample text).", `<p><strong>Demonstration content: requires legal review.</strong> This is sample text. Replace it with your own policy, reviewed by your legal adviser, before going live.</p><h2>What we collect</h2><p>Business and contact details you give us when you apply for an account, place an order or contact us.</p><h2>How we use it</h2><ul><li>To review applications and run your account.</li><li>To process and deliver orders.</li><li>To answer your questions.</li></ul><h2>Contact</h2><p>Questions about your information? <a href="/contact">Contact us</a>.</p>`),
  page("page-terms", "terms-and-conditions", "Terms and conditions", "The terms for wholesale accounts and orders (sample text).", `<p><strong>Demonstration content: requires legal review.</strong> This is sample text. Replace it with your own terms, reviewed by your legal adviser, before going live.</p><h2>Accounts</h2><p>Wholesale accounts are for approved businesses. We may ask for business documents before approving an application.</p><h2>Orders and prices</h2><p>Prices shown to your account apply when you order. Weighed products are charged by the weight delivered.</p><h2>Delivery</h2><p>Delivery days and order cutoffs depend on your area.</p>`),
  { ...page("page-delivery-terms", "wholesale-guide", "Wholesale guide", "How ordering works for approved customers (sample text).", `<p>This page is visible only to approved customers. It shows how a page can be limited to your wholesale accounts.</p><h2>Ordering</h2><p>Use quick order to add several products at once, then choose your delivery date at checkout.</p>`), visibility: "customers" },
];

export const seedMenus: NavigationMenu[] = [
  {
    id: "menu-header",
    name: "Main menu",
    location: "header",
    updatedAt: AT,
    items: [
      { id: "mi-catalog", label: "Product catalog", kind: "custom", url: "/shop", children: [] },
      { id: "mi-delivery", label: "Delivery information", kind: "custom", url: "/#delivery", children: [] },
      { id: "mi-blog", label: "Journal", kind: "custom", url: "/blog", children: [] },
      { id: "mi-about", label: "About us", kind: "custom", url: "/about", children: [] },
      { id: "mi-contact", label: "Contact", kind: "custom", url: "/contact", children: [] },
    ],
  },
  {
    id: "menu-footer",
    name: "Footer menu",
    location: "footer",
    updatedAt: AT,
    items: [
      {
        id: "mf-catalog", label: "Catalog", kind: "custom", url: "/shop",
        children: [
          { id: "mf-all", label: "All products", kind: "custom", url: "/shop", children: [] },
          { id: "mf-cats", label: "Categories", kind: "custom", url: "/#categories", children: [] },
          { id: "mf-quick", label: "Quick order", kind: "custom", url: "/#quick-order", children: [] },
        ],
      },
      {
        id: "mf-business", label: "For businesses", kind: "custom", url: "/register",
        children: [
          { id: "mf-apply", label: "Apply for B2B account", kind: "custom", url: "/register", children: [] },
          { id: "mf-delivery", label: "Delivery information", kind: "custom", url: "/#delivery", children: [] },
          { id: "mf-about", label: "About us", kind: "custom", url: "/about", children: [] },
          { id: "mf-journal", label: "Journal", kind: "custom", url: "/blog", children: [] },
        ],
      },
      {
        id: "mf-support", label: "Support", kind: "custom", url: "/contact",
        children: [
          { id: "mf-contact", label: "Contact us", kind: "custom", url: "/contact", children: [] },
          { id: "mf-login", label: "Log in", kind: "custom", url: "/login", children: [] },
          { id: "mf-account", label: "Customer account", kind: "custom", url: "/account", children: [] },
          { id: "mf-privacy", label: "Privacy policy", kind: "page", ref: "page-privacy", children: [] },
          { id: "mf-terms", label: "Terms and conditions", kind: "page", ref: "page-terms", children: [] },
        ],
      },
    ],
  },
];
