/**
 * Storage paths in the private `attachments` bucket. Every path starts with
 * the owner's user id -- the bucket's RLS policies only let a user touch
 * their own top-level folder -- and the server re-checks the exact shape
 * before recording a path, so a client can't point a profile or receipt at
 * someone else's file (or at an arbitrary key in their own folder).
 */

export const ATTACHMENTS_BUCKET = "attachments";

/** Largest file accepted, after the browser has downsized photos. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RECEIPT_TYPES = [...IMAGE_TYPES, "application/pdf"] as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function extensionFor(mimeType: string): string | null {
  return EXTENSIONS[mimeType] ?? null;
}

export function avatarPath(userId: string, fileId: string, mimeType: string): string {
  return `${userId}/avatar/${fileId}.${extensionFor(mimeType) ?? "jpg"}`;
}

export function receiptPath(userId: string, expenseId: string, fileId: string, mimeType: string): string {
  return `${userId}/receipts/${expenseId}/${fileId}.${extensionFor(mimeType) ?? "jpg"}`;
}

export function isOwnAvatarPath(userId: string, path: string): boolean {
  return new RegExp(`^${userId}/avatar/${UUID}\\.(jpg|png|webp)$`).test(path);
}

export function isOwnReceiptPath(userId: string, expenseId: string, path: string): boolean {
  return new RegExp(`^${userId}/receipts/${expenseId}/${UUID}\\.(jpg|png|webp|pdf)$`).test(path);
}

/** The folder and file name parts of a path, for Storage's `list(folder, { search })`. */
export function splitPath(path: string): { folder: string; name: string } {
  const i = path.lastIndexOf("/");
  return { folder: path.slice(0, i), name: path.slice(i + 1) };
}
