"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="container-site flex min-h-[60vh] flex-col items-start justify-center py-24">
      <p className="label-mono text-accent">500</p>
      <h1 className="mt-4 text-(length:--text-h2) font-medium">{t("title")}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t("text")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        {t("retry")}
      </button>
    </section>
  );
}
