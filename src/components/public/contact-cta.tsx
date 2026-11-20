import { ArrowUpRight, CalendarDays, Mail, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { whatsappLink } from "@/lib/whatsapp";
import { tr } from "@/lib/localized";
import { getSetting } from "@/server/content/queries";

export async function ContactCta({ locale, number }: { locale: string; number?: string }) {
  const [t, hero, contact] = await Promise.all([getTranslations("contact"), getTranslations("hero"), getSetting("contact")]);
  const wa = contact.whatsapp ? whatsappLink(contact.whatsapp, t("whatsappMessage")) : null;
  return (
    <section className="container-site mt-24" aria-labelledby="contact-cta">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-14 text-primary-foreground sm:px-12 md:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand-orange/25 blur-3xl"
        />
        <p className="label-mono text-primary-foreground/70">
          {number ? `${number} · ` : ""}
          {t("title")}
        </p>
        <h2 id="contact-cta" className="mt-4 max-w-2xl text-(length:--text-h2) font-medium">
          {tr(contact.contactHeading, locale)}
        </h2>
        <p className="mt-4 max-w-xl text-primary-foreground/80">{tr(contact.contactText, locale)}</p>
        <p className="mt-2 max-w-xl text-sm text-primary-foreground/70">
          {tr(contact.openTo, locale)} {tr(contact.responseTime, locale)}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
          >
            {hero("ctaPrimary")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-primary-foreground/30 px-5 text-sm font-medium hover:bg-primary-foreground/10"
          >
            <Mail className="size-4" aria-hidden="true" />
            {t("email")}
          </a>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-primary-foreground/30 px-5 text-sm font-medium hover:bg-primary-foreground/10"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {t("whatsapp")}
            </a>
          )}
          {contact.calendlyUrl && (
            <a
              href={contact.calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-primary-foreground/30 px-5 text-sm font-medium hover:bg-primary-foreground/10"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {t("calendly")}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
