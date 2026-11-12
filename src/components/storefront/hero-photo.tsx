import { getImageProps } from "next/image";
import { cx } from "@/lib/cx";
import type { SiteImage } from "@/lib/types";

/** Phones are under this width (Tailwind's `sm`). */
const PHONE_MAX = "(max-width: 39.999rem)";

/**
 * One hero photo filling its slide, with an optional separate photo for phones (art direction through `<picture>`, so a
 * browser downloads only the one it shows). The hero photos are fixed, already web-optimised files, served as they are.
 */
function ArtPhoto({ desktop, phone, className, imageClassName, eager }: { desktop: SiteImage; phone?: SiteImage | null; className?: string; imageClassName?: string; eager: boolean }) {
  const common = { alt: "", fill: true, sizes: "(min-width: 1380px) 1380px, 100vw", unoptimized: true } as const;
  const main = getImageProps({ ...common, src: desktop.src }).props;
  const small = phone && phone.src !== desktop.src ? getImageProps({ ...common, src: phone.src, sizes: "100vw" }).props : null;
  return (
    <div className={cx("absolute inset-0 overflow-hidden bg-surface-muted", className)}>
      <picture>
        {small && <source media={PHONE_MAX} srcSet={small.srcSet ?? small.src} sizes={small.sizes} />}
        {/* A theme's photo that's hidden stays lazy, so only the photo on screen is fetched (high priority for the first slide). */}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps (decorative, alt="") */}
        <img {...main} loading="lazy" fetchPriority={eager ? "high" : undefined} className={cx("object-cover", imageClassName)} />
      </picture>
    </div>
  );
}

/**
 * The hero background: the light and dark theme photos, each with an optional phone photo. Phones use the phone photo
 * when there is one (otherwise the banner, cropped to its right-hand side); the dark theme falls back to the light photos.
 */
export function HeroPhoto({ image, imageDark, imageMobile, imageMobileDark, first }: { image: SiteImage; imageDark?: SiteImage | null; imageMobile?: SiteImage | null; imageMobileDark?: SiteImage | null; first: boolean }) {
  const darkDesktop = imageDark ?? image;
  const lightPhone = imageMobile ?? null;
  const darkPhone = imageMobileDark ?? imageMobile ?? null;
  const themed = darkDesktop.src !== image.src || (darkPhone?.src ?? "") !== (lightPhone?.src ?? "");
  // A phone photo is framed for phones: keep its top (where the subject is) clear of the card at the bottom.
  const position = (phone: SiteImage | null) => (phone ? "object-[center_45%] sm:object-[82%_center] xl:object-center" : "object-[82%_center] xl:object-center");
  return (
    <div className="absolute inset-0 -z-10">
      <ArtPhoto desktop={image} phone={lightPhone} eager={first} className={themed ? "dark:hidden" : undefined} imageClassName={position(lightPhone)} />
      {themed && <ArtPhoto desktop={darkDesktop} phone={darkPhone} eager={first} className="hidden dark:block" imageClassName={position(darkPhone)} />}
    </div>
  );
}
