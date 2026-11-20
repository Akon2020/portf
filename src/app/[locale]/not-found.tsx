import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <section className="container-site flex min-h-[60vh] flex-col items-start justify-center py-24">
      <p className="label-mono text-accent">404</p>
      <h1 className="mt-4 text-(length:--text-h2) font-medium">{t("title")}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t("text")}</p>
      <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
        {t("back")}
      </Link>
    </section>
  );
}
