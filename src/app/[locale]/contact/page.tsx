import { ArrowRight, ArrowUpRight, CalendarDays, Clock, FileText, Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/public/contact-form";
import { FaqList } from "@/components/public/faq-list";
import { SectionLabel } from "@/components/public/section-heading";
import { SocialLinks } from "@/components/public/social-links";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { whatsappLink } from "@/lib/whatsapp";
import { getFaqs, getSetting, getSocialLinks } from "@/server/content/queries";
import { createFormToken, turnstileSiteKey } from "@/server/services/anti-spam";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({ locale, href: "/contact", title: t("title"), description: t("intro") });
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ sujet?: string }>;
}) {
  const { locale } = await params;
  const { sujet } = await searchParams;
  setRequestLocale(locale);
  const [t, contact, socials, faqs] = await Promise.all([getTranslations("contact"), getSetting("contact"), getSocialLinks(), getFaqs()]);
  const wa = contact.whatsapp ? whatsappLink(contact.whatsapp, t("whatsappMessage")) : null;
  const networks = socials.filter((link) => !["email", "calendly", "whatsapp"].includes(link.platform));

  const channels = [
    { icon: Mail, label: t("email"), value: contact.email, href: `mailto:${contact.email}`, external: false },
    wa && { icon: MessageCircle, label: t("whatsapp"), value: contact.whatsapp, href: wa, external: true },
    contact.calendlyUrl && {
      icon: CalendarDays,
      label: t("calendly"),
      value: contact.calendlyUrl.replace(/^https?:\/\//, ""),
      href: contact.calendlyUrl,
      external: true,
    },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string; external: boolean }[];

  return (
    <>
      <section className="container-site pt-10 md:pt-16">
        <div className="relative overflow-hidden rounded-3xl border bg-card">
          <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="min-w-0 border-b p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
              <p className="label-mono text-accent">{t("label")}</p>
              <h1 className="mt-4 text-[clamp(2.2rem,1.4rem+2.6vw,3.6rem)] font-medium leading-[1.02]">{tr(contact.contactHeading, locale)}</h1>
              <p className="mt-5 max-w-xl text-(length:--text-body) text-muted-foreground">{t("intro")}</p>
              <p className="mt-3 max-w-xl text-muted-foreground">{tr(contact.openTo, locale)}</p>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-1.5 text-sm">
                <Clock className="size-4 text-accent" aria-hidden="true" />
                {tr(contact.responseTime, locale)}
              </p>

              <ul className="mt-8 space-y-3">
                {channels.map((channel) => (
                  <li key={channel.label}>
                    <a
                      href={channel.href}
                      {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="group flex items-center gap-4 rounded-2xl border bg-background p-4 transition-colors hover:border-accent"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface">
                        <channel.icon className="size-5 text-accent" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="label-mono block text-muted-foreground">{channel.label}</span>
                        <span className="block truncate font-medium">{channel.value}</span>
                      </span>
                      <ArrowUpRight className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
              {networks.length > 0 && (
                <div className="mt-8">
                  <p className="label-mono text-muted-foreground">{t("socials")}</p>
                  <SocialLinks links={networks} className="mt-3" />
                </div>
              )}
            </div>

            <div className="min-w-0 p-6 sm:p-10 lg:p-12">
              <h2 className="font-heading text-2xl font-medium">{t("formTitle")}</h2>
              <div className="mt-6">
                <ContactForm formToken={createFormToken()} siteKey={turnstileSiteKey()} defaultTopic={sujet} bare />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border bg-surface/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15">
              <FileText className="size-5 text-accent" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium">{t("quoteTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("quoteText")}</p>
            </div>
          </div>
          <Link
            href="/devis"
            data-track="cta_click"
            data-track-label="devis_contact"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground"
          >
            {t("quoteCta")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="faq">
          <SectionLabel label={t("faqLabel")} />
          <div className="mt-10 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 id="faq" className="text-(length:--text-h2) font-medium">
                {t("faqTitle")}
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">{t("faqIntro")}</p>
            </div>
            <FaqList items={faqs} locale={locale} grouped />
          </div>
        </section>
      )}
    </>
  );
}
