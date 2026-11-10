import type { Metadata, Viewport } from "next";
import { Inter, Merriweather, Noto_Sans_JP, Poppins, Roboto } from "next/font/google";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import { RuntimeBootstrap } from "@/components/ui/runtime-bootstrap";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { PreferencesScript } from "@/components/ui/theme";
import { setCompany } from "@/config/runtime";
import { brandCss } from "@/lib/branding/css";
import { repositories } from "@/lib/data";
import "./globals.css";

// The fonts offered in Company & Branding (FONT_OPTIONS). Only the default preloads; others load when a page uses them.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const merriweather = Merriweather({ variable: "--font-merriweather", subsets: ["latin"], display: "swap", preload: false });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", subsets: ["latin"], display: "swap", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const c = await repositories.company.get();
  return {
    title: { default: c.storeName, template: `%s | ${c.storeName}` },
    description: c.description,
    ...(c.branding.favicon ? { icons: { icon: c.branding.favicon } } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1311" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Single company per deployment: what the service returns applies to this whole server.
  const settings = await repositories.company.get();
  setCompany(settings);
  const css = brandCss(settings.branding);
  return (
    // data-theme / data-sidebar are set by PreferencesScript before hydration, so the server markup intentionally differs.
    <html lang={settings.locale.language} className={`${inter.variable} ${roboto.variable} ${poppins.variable} ${merriweather.variable} ${notoJp.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <PreferencesScript />
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      </head>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before hydration; this covers <body>'s own attributes only. */}
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only z-50 rounded-ui bg-surface px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <NavigationProgress />
        <RuntimeBootstrap settings={settings} />
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}
