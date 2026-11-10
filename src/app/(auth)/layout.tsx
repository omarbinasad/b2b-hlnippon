import Link from "next/link";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Logo />
      <main id="main" className="mt-8 w-full max-w-md rounded-ui has-[[data-wide]]:max-w-3xl border border-line bg-surface p-5 sm:p-8">
        {children}
      </main>
      <Link href="/shop" className="mt-6 text-sm text-muted hover:text-foreground">
        ← Back to store
      </Link>
      <MobileBottomNav />
    </div>
  );
}
