
/** Small inline stroke icon set (24×24), so no icon package is needed. */
const paths: Record<string, React.ReactNode> = {
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>,
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  box: <path d="M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 11h6M9 15h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  truckFast: (
    <>
      <path d="M6 6h9v10h-3M15 9h3.5L22 12.5V16h-2M6 16h1" />
      <circle cx="9.5" cy="16.5" r="2" />
      <circle cx="17.5" cy="16.5" r="2" />
      <path d="M2 9h6M1 12h5" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronsLeft: <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  cart: (
    <>
      <path d="M3 4h2l2.4 11h10.2L20 7H6.2" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  alert: <path d="M12 3 2 20h20L12 3ZM12 10v4M12 17h.01" />,
  fileUser: (
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <circle cx="12" cy="12.5" r="2" />
      <path d="M8.5 18a3.5 3.5 0 0 1 7 0" />
    </>
  ),
  store: <path d="M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6" />,
  heart: <path d="M12 20.5s-8-4.6-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 6-8 10.6-8 10.6z" />,
  folder: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  phone: <path d="M5 3h3.5l1.8 4.5-2.3 1.7a12 12 0 0 0 5.8 5.8l1.7-2.3L19 14.5V18a3 3 0 0 1-3 3C9.4 21 3 14.6 3 8V5a2 2 0 0 1 2-2Z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 22s7.5-6.6 7.5-12.5a7.5 7.5 0 0 0-15 0C4.5 15.4 12 22 12 22Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  pencil: <path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  archive: <path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4" />,
  restore: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-8 9" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="m5 12 5 5 9-10" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  headset: <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5ZM20 14h-3v6h2a1 1 0 0 0 1-1v-5ZM17 20a4 4 0 0 1-4 2" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6M9 16h3" />,
  repeat: <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />,
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m8.6 13.9-1.6 8.1 5-3 5 3-1.6-8.1M12 6.5l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2Z" />
    </>
  ),
  shieldCheck: <path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3ZM8.5 12l2.5 2.5 4.5-5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  // Food category icons (storefront category navigation).
  meat: <path d="M15.4 15.6a7.9 6 135 1 1 6.2-6.2 4.3 3.4 135 0 0-6.2 6.2ZM8.3 12.7l-2.6 2.6a2.5 2.5 0 1 0-1.7 4.7 2.5 2.5 0 1 0 4.7-1.7l2.6-2.6" />,
  fish: (
    <>
      <path d="M6.5 12c.9-3.5 4.9-6 8.5-6s6.1 2.5 7 6c-.9 3.5-3.4 6-7 6s-7.6-2.5-8.5-6Z" />
      <path d="M18 11.5v.5M16 17.9a9.8 9.8 0 0 1 0-11.8" />
      <path d="M7 10.7C7 8 5.6 6 2.7 5.5c-1 1.5-1 5 .2 6.5-1.2 1.5-1.2 5-.2 6.5C5.6 18 7 16 7 13.3" />
    </>
  ),
  apple: <path d="M12 20.9c1.5 0 2.8 1.1 4 1.1 3 0 6-8 6-12.2A4.9 4.9 0 0 0 17 5c-2.2 0-4 1.4-5 2-1-.6-2.8-2-5-2a4.9 4.9 0 0 0-5 4.8C2 14 5 22 8 22c1.3 0 2.5-1.1 4-1.1ZM10 2c1 .5 2 2 2 5" />,
  wheat: (
    <>
      <path d="M12 22V9" />
      <path d="M12 9c-2 0-3.2-1.2-3.2-3.2 2 0 3.2 1.2 3.2 3.2Zm0 0c2 0 3.2-1.2 3.2-3.2-2 0-3.2 1.2-3.2 3.2ZM12 13.5c-2.4 0-3.8-1.4-3.8-3.8 2.4 0 3.8 1.4 3.8 3.8Zm0 0c2.4 0 3.8-1.4 3.8-3.8-2.4 0-3.8 1.4-3.8 3.8ZM12 18c-2.4 0-3.8-1.4-3.8-3.8 2.4 0 3.8 1.4 3.8 3.8Zm0 0c2.4 0 3.8-1.4 3.8-3.8-2.4 0-3.8 1.4-3.8 3.8ZM12 5V2" />
    </>
  ),
  pot: <path d="M2 12h20M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8M4 8l16-4M8.9 6.8l-.5-1.8a2 2 0 0 1 1.5-2.4l1.9-.5a2 2 0 0 1 2.4 1.5l.5 1.8" />,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />,
  cookie: <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5ZM8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01" />,
  cupSoda: <path d="m6 8 1.8 12.3a2 2 0 0 0 2 1.7h4.5a2 2 0 0 0 2-1.7L18 8M5 8h14M7 15a6.5 6.5 0 0 1 5 0 6.5 6.5 0 0 0 5 0M12 8l1-6h2" />,
  nut: (
    <>
      <path d="M12 4V2M5 10v4a7 7 0 0 0 5.3 6.8c.4.1.8.3 1.1.6L12 22l.6-.6c.3-.3.7-.5 1.1-.6A7 7 0 0 0 19 14v-4" />
      <path d="M12 4C8 4 4.5 6 4 8c-.2 1-.9 2-2 3 1.3-.1 2-.3 3-1 .5.9 1 1.4 2 2 1.5-.6 2-1.1 2.5-2 .6 1 1.2 1.4 2.5 2 1.3-.6 1.9-1.1 2.5-2 .6 1 1.2 1.4 2.5 2 1.2-.5 1.7-1 2-2 1 .9 1.7 1.2 3 1-1.3-1-1.8-2-2-3-.5-2-4-4-8-4Z" />
    </>
  ),
  sparkles: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 3v4M17 5h4M5 17v4M3 19h4" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5a14.5 14.5 0 0 1 0 19 14.5 14.5 0 0 1 0-19Z" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 12 8 12 8s2.5-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
};

export type IconName =
  | "award"
  | "minus"
  | "file"
  | "dashboard"
  | "box"
  | "clipboard"
  | "user"
  | "users"
  | "tag"
  | "truck"
  | "truckFast"
  | "heart"
  | "bell"
  | "settings"
  | "folder"
  | "fileUser"
  | "sun"
  | "moon"
  | "calendar"
  | "chevronDown"
  | "chevronRight"
  | "chevronsLeft"
  | "chart"
  | "cart"
  | "coins"
  | "arrowUp"
  | "arrowDown"
  | "alert"
  | "fileUser"
  | "store"
  | "folder"
  | "plus"
  | "phone"
  | "mail"
  | "mapPin"
  | "clock"
  | "target"
  | "pencil"
  | "copy"
  | "archive"
  | "restore"
  | "eye"
  | "image"
  | "trash"
  | "close"
  | "arrowLeft"
  | "arrowRight"
  | "check"
  | "search"
  | "lock"
  | "headset"
  | "receipt"
  | "repeat"
  | "meat"
  | "fish"
  | "apple"
  | "wheat"
  | "pot"
  | "flame"
  | "cookie"
  | "cupSoda"
  | "nut"
  | "sparkles"
  | "globe"
  | "gift"
  | "percent"
  | "shieldCheck"
  | "menu";

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
