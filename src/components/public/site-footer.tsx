import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/localized";
import { getSetting, getSocialLinks } from "@/server/content/queries";
import { SocialLinks } from "./social-links";

export async function SiteFooter({ locale }: { locale: string }) {
  const [t, nav, profile, contact, socials] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
    getSetting("profile"),
    getSetting("contact"),
    getSocialLinks(),
  ]);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t">
      <div className="container-site grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <p className="font-heading text-2xl">{profile.name}</p>
          <p className="max-w-sm text-muted-foreground">
            {tr(profile.title, locale)} · {tr(profile.location, locale)}
          </p>
          <p className="font-heading text-lg italic">{profile.slogan}</p>
          <a href={`mailto:${contact.email}`} className="inline-block text-sm underline decoration-accent underline-offset-4">
            {contact.email}
          </a>
        </div>
        <nav aria-label={t("quickLinks")}>
          <p className="label-mono mb-4 text-muted-foreground">{t("quickLinks")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/a-propos" className="hover:text-accent">{nav("about")}</Link></li>
            <li><Link href="/projets" className="hover:text-accent">{nav("projects")}</Link></li>
            <li><Link href="/services" className="hover:text-accent">{nav("services")}</Link></li>
            <li><Link href="/contact" className="hover:text-accent">{nav("contact")}</Link></li>
          </ul>
        </nav>
        <div>
          <p className="label-mono mb-4 text-muted-foreground">{t("follow")}</p>
          <SocialLinks links={socials} size="sm" />
        </div>
      </div>
      <div className="border-t">
        <div className="container-site flex flex-col gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {profile.name}. {t("rights")}
          </p>
          <ul className="flex gap-5">
            <li><Link href="/mentions-legales" className="hover:text-foreground">{t("legal")}</Link></li>
            <li><Link href="/confidentialite" className="hover:text-foreground">{t("privacy")}</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
