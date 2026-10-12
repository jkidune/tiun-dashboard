"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { updateAvatar } from "@/app/actions/account";
import { FormMessage } from "@/components/ui/client";

const SIZE = 256;

/** Center-crops and shrinks any photo to a 256×256 JPEG in the browser. */
async function toSquareJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("unreadable"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarUploader({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, action] = useActionState(updateAvatar, null);
  const [pending, start] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = (fields: Record<string, string>) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
    start(() => action(fd));
  };

  return (
    <div className="stack" style={{ gap: 8, alignItems: "flex-end" }}>
      <div className="row">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="avatar-file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setLocalError(null);
            try {
              submit({ avatar: await toSquareJpeg(file) });
            } catch {
              setLocalError("We couldn’t read that image. Try a JPG or PNG photo.");
            }
          }}
        />
        <button type="button" className="btn" disabled={pending} onClick={() => input.current?.click()}>
          <Camera size={16} /> {pending ? "Uploading…" : "Change photo"}
        </button>
        {hasPhoto && (
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => submit({ remove: "1" })}>
            <Trash2 size={16} /> Remove
          </button>
        )}
      </div>
      {localError ? <div className="form-msg err" role="alert">{localError}</div> : <FormMessage state={state} />}
    </div>
  );
}
