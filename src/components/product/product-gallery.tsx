"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import type { ProductImage as Img } from "@/lib/types";
import { ProductImage } from "./product-image";

/** Main image with thumbnails when a product has several. */
export function ProductGallery({ images }: { images: Img[] }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  return (
    <div className="space-y-3">
      <ProductImage image={current} sizes="(min-width: 768px) 50vw, 100vw" priority />
      {images.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.src} className="w-16 sm:w-20">
              <button type="button" onClick={() => setActive(i)} aria-label={`Show image ${i + 1} of ${images.length}`} aria-current={i === active ? "true" : undefined} className={cx("block w-full overflow-hidden rounded-ui border-2", i === active ? "border-brand" : "border-line hover:border-muted")}>
                <ProductImage image={img} sizes="5rem" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
