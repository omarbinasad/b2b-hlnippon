import { RichText } from "@/components/ui/rich-text";
import type { ProductImage } from "@/lib/types";
import { ImageSlot } from "./image-slot";

/** Page layout for content written in the admin. */
export function CmsArticle({ title, excerpt, bodyHtml, image }: { title: string; excerpt?: string; bodyHtml: string; image?: ProductImage }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {excerpt && <p className="mt-3 text-base text-muted sm:text-lg">{excerpt}</p>}
      {image && <ImageSlot image={image} sizes="(min-width: 768px) 48rem, 100vw" placeholder="" decorativeAlt={image.alt} className="mt-6 aspect-[16/9] rounded-ui" />}
      <RichText rich value={bodyHtml} className="mt-8 !space-y-4 text-base leading-7 [&_h2]:!mt-8 [&_h2]:!text-xl [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" />
    </article>
  );
}
