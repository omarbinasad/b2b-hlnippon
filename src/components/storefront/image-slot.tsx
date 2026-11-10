import Image from "next/image";
import type { ImageAsset } from "@/config/storefront";
import { cx } from "@/lib/cx";

/**
 * Renders a configured image (optimized, lazy unless `priority`) or, while the asset is
 * missing, a clearly labelled TEMPORARY placeholder naming the file to add.
 */
export function ImageSlot({
  image,
  sizes,
  priority = false,
  placeholder,
  decorativeAlt,
  className,
  fit = "cover",
  labelPosition = "center",
  compact = false,
  imageClassName,
  original = false,
}: {
  image: ImageAsset | null | undefined;
  sizes: string;
  priority?: boolean;
  /** Expected file, shown on the placeholder, e.g. "hero.webp". */
  placeholder: string;
  /** Use "" for purely decorative images. */
  decorativeAlt?: string;
  className?: string;
  fit?: "cover" | "contain";
  /** Where the placeholder label sits ("corner" keeps it clear of overlaid text). */
  labelPosition?: "center" | "corner";
  /** Short label for small slots. */
  compact?: boolean;
  /** Extra classes for the image, e.g. "object-top" to keep a face in a cropped slot. */
  imageClassName?: string;
  /**
   * Serve the file as-is, skipping the optimizer's resize/re-compression. Only for fixed design
   * photos that are already web-optimized (e.g. hero, owner .webp) — never for product images.
   */
  original?: boolean;
}) {
  return (
    <div className={cx("relative overflow-hidden bg-surface-muted", className)}>
      {image ? (
        <Image
          src={image.src}
          alt={decorativeAlt ?? image.alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={original || image.src.startsWith("/media/")}
          loading={priority ? undefined : "lazy"}
          className={cx(fit === "cover" ? "object-cover" : "object-contain", imageClassName)}
        />
      ) : (
        <div className={cx("absolute inset-0 grid bg-[repeating-linear-gradient(135deg,var(--surface-muted)_0_12px,var(--brand-soft)_12px_24px)] p-3 text-center", labelPosition === "center" ? "place-items-center" : "items-start justify-end")}>
          <span className={cx("rounded-ui border border-dashed border-line bg-surface/90 leading-snug text-muted", compact ? "max-w-full px-1.5 py-1 text-[10px] break-all" : "px-2.5 py-1.5 text-[11px]")}>
            <span className="block font-semibold text-foreground">{compact ? "Placeholder" : "Temporary placeholder"}</span>
            {compact ? placeholder.split(" (")[0] : `Add /images/${placeholder}`}
          </span>
        </div>
      )}
    </div>
  );
}
