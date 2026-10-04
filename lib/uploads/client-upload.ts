"use client";

import { createClient } from "@/lib/supabase/client";
import { ATTACHMENTS_BUCKET, MAX_UPLOAD_BYTES } from "./paths";

/**
 * Re-encodes a photo as a JPEG no larger than `maxDimension` on its long
 * side. Phone photos are 3-12 MB; receipts stay legible at 2000px and
 * avatars need far less. Also normalizes HEIC and strips EXIF (including
 * location), since the canvas copy carries no metadata. Non-images (PDFs) and
 * anything the browser can't decode are returned unchanged.
 */
export async function prepareImage(file: File, maxDimension: number, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Uploads to the user's own folder in the private bucket (RLS-enforced). Returns an error key or null. */
export async function uploadToStorage(path: string, blob: Blob): Promise<"tooLarge" | "failed" | null> {
  if (blob.size > MAX_UPLOAD_BYTES) return "tooLarge";
  const { error } = await createClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false, cacheControl: "3600" });
  return error ? "failed" : null;
}
