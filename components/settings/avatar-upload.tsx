"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client";
import { removeAvatarAction, saveAvatarAction } from "@/lib/actions/attachments";
import { prepareImage, uploadToStorage } from "@/lib/uploads/client-upload";
import { avatarPath, IMAGE_TYPES } from "@/lib/uploads/paths";

/**
 * Profile photo: picked from the camera or library, cropped-to-fit by CSS,
 * downsized to 512px JPEG in the browser (which also strips location
 * metadata), uploaded to the user's own private folder, then recorded by a
 * server action that checks the path and that the file exists.
 */
export function AvatarUpload({
  userId,
  avatarVersion,
  initials,
  name,
}: {
  userId: string;
  avatarVersion: string | null;
  initials: string;
  name: string;
}) {
  const { m } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const src = preview ?? (avatarVersion ? `/api/avatar?v=${encodeURIComponent(avatarVersion)}` : null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(m.uploads.notAnImage);
      return;
    }
    setBusy(true);
    try {
      const blob = await prepareImage(file, 512, 0.88);
      // Normally a JPEG; if the browser couldn't re-encode it, only plain image types are accepted as-is.
      if (!(IMAGE_TYPES as readonly string[]).includes(blob.type)) {
        toast.error(m.uploads.notAnImage);
        return;
      }
      const path = avatarPath(userId, crypto.randomUUID(), blob.type);
      const uploadError = await uploadToStorage(path, blob);
      if (uploadError) {
        toast.error(uploadError === "tooLarge" ? m.uploads.tooLarge : m.errors.uploadFailed);
        return;
      }
      const result = await saveAvatarAction(path);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPreview(URL.createObjectURL(blob));
      toast.success(m.uploads.photoUpdated);
      startTransition(() => router.refresh());
    } catch {
      // Never fail silently (a dropped connection, an unreadable photo).
      toast.error(m.errors.uploadFailed);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    const result = await removeAvatarAction();
    setBusy(false);
    if (result.error) toast.error(result.error);
    else {
      setPreview(null);
      startTransition(() => router.refresh());
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={m.uploads.changePhoto}
          className="relative size-20 shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed, private URL; next/image can't optimize it.
            <img src={src} alt={name} className="size-20 rounded-full object-cover" />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">{initials}</span>
          )}
          <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </span>
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate font-semibold">{name}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={busy}>
              {avatarVersion || preview ? m.uploads.changePhoto : m.uploads.addPhoto}
            </Button>
            {(avatarVersion || preview) && (
              <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={remove} disabled={busy}>
                {m.uploads.removePhoto}
              </Button>
            )}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
      </CardContent>
    </Card>
  );
}
