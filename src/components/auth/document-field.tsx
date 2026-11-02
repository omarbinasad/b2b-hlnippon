"use client";

import { useRef } from "react";
import { formatFileSize } from "@/lib/format";
import { DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES } from "@/lib/validation/documents";

type Props = {
  id: string;
  label: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null, error?: string) => void;
};

/** One optional identity-document file (photo or PDF). Size and type are checked again on the server. */
export function DocumentField({ id, label, file, error, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const describedBy = error ? `${id}-error` : `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-ui border border-dashed border-line bg-background px-3 py-2">
        <input
          ref={input}
          id={id}
          type="file"
          accept={DOCUMENT_ACCEPT}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-ui file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onChange(f, f && f.size > MAX_DOCUMENT_BYTES ? "The file is larger than 4 MB." : undefined);
          }}
        />
        {file && (
          <>
            <span className="text-xs text-muted tabular-nums">{formatFileSize(file.size)}</span>
            <button
              type="button"
              className="text-xs font-medium text-danger hover:underline"
              onClick={() => {
                if (input.current) input.current.value = "";
                onChange(null);
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">{error}</p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted">Optional. JPG, PNG, WebP or PDF, up to 4 MB.</p>
      )}
    </div>
  );
}
