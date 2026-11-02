import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cx } from "@/lib/cx";

/**
 * Logo slot: renders the configured logo image (light/dark theme variants), or a neutral
 * text placeholder. `inverse` is for always-dark backgrounds such as the admin sidebar.
 * `markOnlyClassName` narrows the image to its round emblem (e.g. a collapsed sidebar).
 * `size`: "lg" (default, store header/footer/auth: 48px, 64px from md) or "sm" (40px, tight bars).
 */
export function Logo({
  href = "/",
  inverse = false,
  nameClassName,
  markOnlyClassName,
  size = "lg",
}: {
  href?: "/" | "/account" | "/admin";
  inverse?: boolean;
  nameClassName?: string;
  markOnlyClassName?: string;
  size?: "sm" | "lg";
}) {
  const { logo, name } = siteConfig;
  const imageHeight = size === "sm" ? 40 : 64;
  const img = (src: string, className?: string) => (
    // width/height at the largest display height so next/image serves sharp 1x/2x variants.
    <Image
      src={src}
      alt={name}
      width={Math.round((imageHeight * logo.width) / logo.height)}
      height={imageHeight}
      priority
      className={cx(size === "sm" ? "h-10" : "h-12 md:h-16", "w-auto max-w-none", className)}
    />
  );
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-2 rounded-ui font-semibold tracking-tight">
      {logo.light && logo.dark ? (
        <span className={cx("block overflow-hidden", markOnlyClassName)}>
          {inverse ? img(logo.dark) : (
            <>
              {img(logo.light, "dark:hidden")}
              {img(logo.dark, "hidden dark:block")}
            </>
          )}
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
