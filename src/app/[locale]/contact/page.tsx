import { ArrowUpRight, CalendarDays, Clock, Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/public/contact-form";
import { SectionLabel } from "@/components/public/section-heading";
import { SocialLinks } from "@/components/public/social-links";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { whatsappLink } from "@/lib/whatsapp";
import { getSetting, getSocialLinks } from "@/server/content/queries";
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
  const [t, contact, socials] = await Promise.all([getTranslations("contact"), getSetting("contact"), getSocialLinks()]);
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
    <section className="container-site pt-16 md:pt-24">
      <SectionLabel label={t("title")} />
      <div className="mt-8 grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <h1 className="text-(length:--text-hero) font-medium leading-[0.98]">{tr(contact.contactHeading, locale)}</h1>
          <p className="mt-6 max-w-xl text-(length:--text-body) text-muted-foreground">{t("intro")}</p>
          <p className="mt-4 max-w-xl text-muted-foreground">{tr(contact.openTo, locale)}</p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm">
            <Clock className="size-4 text-accent" aria-hidden="true" />
            {tr(contact.responseTime, locale)}
          </p>
          <div className="mt-10">
            <ContactForm formToken={createFormToken()} siteKey={turnstileSiteKey()} defaultTopic={sujet} />
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {channels.map((channel) => (
            <a
              key={channel.label}
              href={channel.href}
              {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex items-center gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-accent"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface">
                <channel.icon className="size-5 text-accent" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="label-mono block text-muted-foreground">{channel.label}</span>
                <span className="block truncate font-medium">{channel.value}</span>
              </span>
              <ArrowUpRight className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          ))}
          {networks.length > 0 && (
            <div className="rounded-2xl border bg-card p-5">
              <p className="label-mono text-muted-foreground">{t("socials")}</p>
              <SocialLinks links={networks} className="mt-4" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
