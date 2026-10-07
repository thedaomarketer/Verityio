"use client";

import { addReceiptAction } from "@/lib/actions/attachments";
import { prepareImage, uploadToStorage } from "@/lib/uploads/client-upload";
import { RECEIPT_TYPES, receiptPath } from "@/lib/uploads/paths";

export type ReceiptUploadError = "unsupported" | "tooLarge" | "failed" | string;

/**
 * Photo -> 2000px JPEG (legible, and EXIF/location stripped) -> the user's
 * private folder -> recorded against the expense by the server. PDFs go up
 * unchanged. Returns null on success or an error key/message.
 */
export async function uploadReceipt(userId: string, expenseId: string, file: File): Promise<ReceiptUploadError | null> {
  try {
    const blob = await prepareImage(file, 2000, 0.85);
    const mimeType = blob.type;
    if (!(RECEIPT_TYPES as readonly string[]).includes(mimeType)) return "unsupported";

    const path = receiptPath(userId, expenseId, crypto.randomUUID(), mimeType);
    const uploadError = await uploadToStorage(path, blob);
    if (uploadError) return uploadError;

    const result = await addReceiptAction({
      expenseId,
      path,
      fileName: (file.name || "receipt").slice(0, 200),
      mimeType: mimeType as (typeof RECEIPT_TYPES)[number],
      size: blob.size,
    });
    return result.error ?? null;
  } catch {
    // A dropped connection mid-save: report it rather than leaving the sheet spinning.
    return "failed";
  }
}
