import Image from "next/image";
import type { ProductImage as ProductImageType } from "@/lib/types";
import { cx } from "@/lib/cx";

interface ProductImageProps {
  image?: ProductImageType;
  /** Responsive `sizes` hint; defaults suit a 2/3/4-column grid. */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/** Square product image with a neutral placeholder when no image exists. */
export function ProductImage({
  image,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  priority,
  className,
}: ProductImageProps) {
  return (
    <div className={cx("relative aspect-square overflow-hidden rounded-ui bg-surface-muted", className)}>
      {image ? (
        <Image src={image.src} alt={image.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-xs text-muted" role="img" aria-label="No image available">
          <svg aria-hidden viewBox="0 0 24 24" className="size-8 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-8 9" />
          </svg>
        </div>
      )}
    </div>
  );
}
