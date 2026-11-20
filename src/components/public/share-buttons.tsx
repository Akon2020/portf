"use client";

import { Check, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Plain share links (no third party script) plus a copy button. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations("blog");
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const networks = [
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&via=akon1703` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  ];
  return (
    <ul className="flex flex-wrap gap-2">
      {networks.map((network) => (
        <li key={network.name}>
          <a
            href={network.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-full border px-3.5 text-xs font-medium transition-colors hover:bg-surface"
            aria-label={t("shareOn", { network: network.name })}
          >
            {network.name}
          </a>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              window.prompt(t("copyLink"), url);
            }
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors hover:bg-surface"
        >
          {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Link2 className="size-3.5" aria-hidden="true" />}
          <span aria-live="polite">{copied ? t("copied") : t("copyLink")}</span>
        </button>
      </li>
    </ul>
  );
}
