import { DemoViewSwitcher } from "@/components/layout/demo-view-switcher";
import { StoreFooter } from "@/components/layout/store-footer";
import { StoreHeader } from "@/components/layout/store-header";

/** Storefront shell. Home uses the full width; other store pages add their own container ((pages)/layout.tsx). */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreHeader />
      <main id="main" className="flex w-full flex-1 flex-col">
        {children}
      </main>
      <StoreFooter />
      <DemoViewSwitcher />
    </>
  );
}
