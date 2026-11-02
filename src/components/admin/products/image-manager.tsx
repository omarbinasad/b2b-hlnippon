"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import type { FieldErrors } from "@/lib/types";
import { newKey, type ImageDraft } from "./draft";

interface ImageManagerProps {
  images: ImageDraft[];
  onChange: (images: ImageDraft[]) => void;
  errors: FieldErrors;
  /** Error-key / id prefix, e.g. "images". */
  path: string;
  fieldId: (path: string) => string;
  /** Allow only one image (categories). */
  single?: boolean;
}

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-ui border border-line bg-surface text-muted hover:text-foreground disabled:opacity-40";

function readSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1200, height: img.naturalHeight || 1200 });
    img.onerror = () => resolve({ width: 1200, height: 1200 });
    img.src = src;
  });
}

/**
 * Gallery editor: first image is the main image. Files picked here are previewed
 * with object URLs only — uploading needs the backend media service.
 */
export function ImageManager({ images, onChange, errors, path, fieldId, single }: ImageManagerProps) {
  const inputId = useId();
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);
  // Release local previews when the form unmounts.
  useEffect(() => () => latest.current.filter((i) => i.local).forEach((i) => URL.revokeObjectURL(i.src)), []);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = await Promise.all(
      [...files].filter((f) => f.type.startsWith("image/")).map(async (file) => {
        const src = URL.createObjectURL(file);
        const size = await readSize(src);
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        return { key: newKey("img"), src, alt, ...size, local: true } satisfies ImageDraft;
      }),
    );
    if (single) {
      images.filter((i) => i.local).forEach((i) => URL.revokeObjectURL(i.src));
      onChange(picked.slice(0, 1));
    } else {
      onChange([...images, ...picked]);
    }
  };

  const remove = (key: string) => {
    const img = images.find((i) => i.key === key);
    if (img?.local) URL.revokeObjectURL(img.src);
    onChange(images.filter((i) => i.key !== key));
  };
  const move = (index: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const setAlt = (key: string, alt: string) => onChange(images.map((i) => (i.key === key ? { ...i, alt } : i)));

  return (
    <div>
      {images.length > 0 && (
        <ul className={cx("mb-3 grid gap-3", single ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          {images.map((img, index) => {
            const altPath = `${path}.${index}.alt`;
            const altId = fieldId(altPath);
            return (
              <li key={img.key} className="flex gap-3 rounded-ui border border-line p-2.5">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-ui bg-surface-muted">
                  {/* Plain <img>: local object URLs cannot go through next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" className="size-full object-cover" />
                  {index === 0 && !single && (
                    <span className="absolute inset-x-0 bottom-0 bg-brand py-0.5 text-center text-[10px] font-semibold text-brand-contrast">
                      Main
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label htmlFor={altId} className="block text-xs font-medium">
                    Alt text <span className="text-danger" aria-hidden>*</span>
                  </label>
                  <input
                    id={altId}
                    value={img.alt}
                    onChange={(e) => setAlt(img.key, e.target.value)}
                    aria-invalid={errors[altPath] ? true : undefined}
                    aria-describedby={errors[altPath] ? `${altId}-error` : undefined}
                    className="h-9 w-full rounded-ui border border-line bg-surface px-2 text-sm aria-invalid:border-danger"
                  />
                  {errors[altPath] && <p id={`${altId}-error`} className="text-xs text-danger">{errors[altPath]}</p>}
                  {img.local && <p className="text-xs text-warning">Preview only — not uploaded or saved.</p>}
                  <div className="flex gap-1">
                    {!single && (
                      <>
                        <button type="button" className={iconBtn} disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move image ${index + 1} earlier`}>
                          <Icon name="arrowLeft" className="size-4" />
                        </button>
                        <button type="button" className={iconBtn} disabled={index === images.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move image ${index + 1} later`}>
                          <Icon name="arrowRight" className="size-4" />
                        </button>
                        {index > 0 && (
                          <button type="button" className={cx(iconBtn, "w-auto px-2 text-xs")} onClick={() => move(index, 0)}>
                            Make main
                          </button>
                        )}
                      </>
                    )}
                    <button type="button" className={cx(iconBtn, "ml-auto hover:text-danger")} onClick={() => remove(img.key)} aria-label={`Remove image ${index + 1}`}>
                      <Icon name="trash" className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-ui border border-dashed border-line px-4 py-6 text-center text-sm text-muted hover:border-brand hover:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
      >
        <Icon name="image" className="size-6" />
        <span className="font-medium text-foreground">{single ? "Choose image" : "Add images"}</span>
        <span className="text-xs">Preview only in this demo — files stay on your device.</span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple={!single}
          className="sr-only"
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
