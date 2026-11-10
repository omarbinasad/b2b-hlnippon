import type { ID, ISODateString } from "./common";

export type MediaKind = "image" | "document";

export interface MediaItem {
  id: ID;
  /** Public address of the file. */
  url: string;
  kind: MediaKind;
  fileName: string;
  title: string;
  /** Alternative text; describes the image for screen readers. */
  alt: string;
  contentType: string;
  /** Bytes. */
  size: number;
  /** Pixels; images only. */
  width?: number;
  height?: number;
  /** Bundled sample files cannot be removed from the demo. */
  sample?: boolean;
  uploadedAt: ISODateString;
  uploadedBy: string;
}

export interface MediaUpload {
  fileName: string;
  title?: string;
  alt?: string;
  bytes: Uint8Array;
  width?: number;
  height?: number;
}

export type MediaUpdate = Pick<MediaItem, "title" | "alt">;
