import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cx } from "@/lib/cx";
import type { BrandImage } from "@/lib/types";

/**
 * Logo slot: renders the configured logos from the company settings, or a neutral text placeholder.
 * `inverse` is for always-dark backgrounds such as the admin sidebar.
 * `markOnlyClassName` narrows the image to its round emblem (e.g. a collapsed sidebar).
 * `size`: "lg" (default, store header/footer/auth: 48px, 64px from md) or "sm" (40px, tight bars).
 * `responsive` uses the mobile logo on phones when one is set.
 */
export function Logo({
  href = "/",
  inverse = false,
  nameClassName,
  markOnlyClassName,
  size = "lg",
  responsive = false,
}: {
  href?: "/" | "/account" | "/admin";
  inverse?: boolean;
  nameClassName?: string;
  markOnlyClassName?: string;
  size?: "sm" | "lg";
  responsive?: boolean;
}) {
  const { logo, name } = siteConfig;
  const onLight = logo.logoLight ?? logo.logoMain;
  const onDark = logo.logoDark ?? logo.logoMain;
  const imageHeight = size === "sm" ? 40 : 64;
  const img = (src: BrandImage, className?: string) => (
    // width/height at the largest display height so next/image serves sharp 1x/2x variants.
    <Image
      src={src.url}
      alt={name}
      width={Math.round((imageHeight * src.width) / src.height)}
      height={imageHeight}
      priority
      // Files uploaded to the demo media library are served as they are.
      unoptimized={src.url.startsWith("/media/")}
      className={cx(size === "sm" ? "h-10" : "h-12 md:h-16", "w-auto max-w-none", className)}
    />
  );
  const mobile = responsive ? logo.logoMobile : null;
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-2 rounded-ui font-semibold tracking-tight">
      {onLight && onDark ? (
        <span className={cx("block overflow-hidden", markOnlyClassName)}>
          {mobile && img(mobile, "md:hidden")}
          <span className={cx("contents", mobile && "max-md:hidden")}>
            {inverse ? img(onDark, mobile ? "max-md:hidden" : undefined) : (
              <>
                {img(onLight, cx("dark:hidden", mobile && "max-md:hidden"))}
                {img(onDark, cx("hidden dark:block", mobile && "max-md:hidden!"))}
              </>
            )}
          </span>
        </span>
      ) : (
        <>
          <span
            aria-hidden
            className={cx(
              "grid size-8 place-items-center rounded-ui text-sm",
              inverse ? "bg-sidebar-active-foreground text-sidebar" : "bg-brand text-brand-contrast",
            )}
          >
            {name.charAt(0)}
          </span>
          <span className={cx("text-base", inverse && "text-sidebar-active-foreground", nameClassName)}>{name}</span>
        </>
      )}
    </Link>
  );
}
