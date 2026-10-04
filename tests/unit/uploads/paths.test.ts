import { describe, expect, it } from "vitest";

import { avatarPath, isOwnAvatarPath, isOwnReceiptPath, receiptPath, splitPath } from "@/lib/uploads/paths";

const USER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const EXPENSE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FILE = "12345678-1234-4234-8234-123456789012";

describe("upload paths", () => {
  it("builds paths under the owner's folder", () => {
    expect(avatarPath(USER, FILE, "image/jpeg")).toBe(`${USER}/avatar/${FILE}.jpg`);
    expect(receiptPath(USER, EXPENSE, FILE, "application/pdf")).toBe(`${USER}/receipts/${EXPENSE}/${FILE}.pdf`);
  });

  it("accepts only the user's own, exactly-shaped paths", () => {
    expect(isOwnAvatarPath(USER, avatarPath(USER, FILE, "image/png"))).toBe(true);
    expect(isOwnAvatarPath(OTHER, avatarPath(USER, FILE, "image/png"))).toBe(false);
    expect(isOwnAvatarPath(USER, `${USER}/avatar/../${OTHER}/avatar/${FILE}.jpg`)).toBe(false);
    expect(isOwnAvatarPath(USER, `${USER}/avatar/${FILE}.svg`)).toBe(false);
    expect(isOwnAvatarPath(USER, `${USER}/avatar/not-a-uuid.jpg`)).toBe(false);
  });

  it("ties receipts to one expense", () => {
    const path = receiptPath(USER, EXPENSE, FILE, "image/jpeg");
    expect(isOwnReceiptPath(USER, EXPENSE, path)).toBe(true);
    expect(isOwnReceiptPath(USER, FILE, path)).toBe(false);
    expect(isOwnReceiptPath(OTHER, EXPENSE, path)).toBe(false);
  });

  it("splits a path into folder and file name", () => {
    expect(splitPath(`${USER}/avatar/${FILE}.jpg`)).toEqual({ folder: `${USER}/avatar`, name: `${FILE}.jpg` });
  });
});
