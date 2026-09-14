"use client";

/** Shrink a camera photo before it leaves the phone: quicker to upload and far less storage. */
const MAX_EDGE = 1600;
const QUALITY = 0.8;

export type Shrunk = { blob: Blob; width: number; height: number };

export async function shrinkImage(file: File, maxEdge = MAX_EDGE): Promise<Shrunk> {
  // "from-image" applies the EXIF rotation, so portrait photos do not arrive on their side.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { blob: file, width: bitmap.width, height: bitmap.height };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  return blob ? { blob, width, height } : { blob: file, width, height };
}

export function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
