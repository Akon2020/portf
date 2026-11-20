"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { uploadFile } from "./media-picker";

/** Drag and drop or file picker, several files at once. */
export function MediaUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const send = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    const errors: string[] = [];
    for (const file of list) {
      try {
        await uploadFile(file);
      } catch (error) {
        errors.push(`${file.name} : ${(error as Error).message}`);
      }
    }
    setMessages(errors.length ? errors : [`${list.length} fichier(s) envoyé(s).`]);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void send(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground transition-colors",
          over && "border-accent bg-accent/5",
        )}
      >
        {busy ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <Upload className="size-6" aria-hidden="true" />}
        <span>
          <span className="font-medium text-foreground">Déposez des fichiers</span> ou cliquez pour choisir
        </span>
        <span className="text-xs">JPEG, PNG, WebP, AVIF, GIF ou PDF, 10 Mo maximum. Les métadonnées (GPS, appareil) sont supprimées.</span>
        <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={(event) => event.target.files && send(event.target.files)} />
      </label>
      {messages.map((message) => (
        <p key={message} className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ))}
    </div>
  );
}
