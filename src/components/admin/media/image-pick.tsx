"use client";

import Image from "next/image";
import { useState } from "react";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import type { SiteImage } from "@/lib/types";

/** Thumbnail plus Choose and Remove, opening the media library. `contain` shows the whole image, for logos. */
export function ImagePick({ label, value, onChange, contain, hint }: { label: string; value: SiteImage | null; onChange: (v: SiteImage | null) => void; contain?: boolean; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className={cx("relative grid h-20 shrink-0 place-items-center overflow-hidden rounded-ui text-xs text-muted", contain ? "w-32 border border-line bg-logo-tile" : "w-20 bg-surface-muted")}>
          {value ? <Image src={value.src} alt="" fill sizes={contain ? "8rem" : "5rem"} unoptimized={value.src.startsWith("/media/")} className={contain ? "object-contain p-2" : "object-cover"} /> : "None"}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Choose</Button>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Remove</Button>}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      <MediaPicker open={open} onClose={() => setOpen(false)} title={label} onSelect={(m) => { onChange({ src: m.url, alt: m.alt, width: m.width ?? 1200, height: m.height ?? 800 }); setOpen(false); }} />
    </div>
  );
}
