import { LogOut } from "lucide-react";
import Link from "next/link";
import { PortalBrand } from "@/components/portal/brand";
import { PortalNav } from "@/components/portal/portal-nav";
import { portalLogoutAction } from "@/server/actions/portal";
import { Avatar } from "@/components/ui/avatar";
import { getSession } from "@/server/auth/session";
import { requirePortal } from "@/server/services/portal";
import { adminAvatarUrl } from "@/server/services/viewer";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { client } = await requirePortal();
  // The admin previewing the portal keeps a shortcut back to the back-office.
  const admin = await getSession("admin");
  const adminAvatar = admin?.session.twoFactorVerified ? await adminAvatarUrl() : undefined;
  return (
    <div className="min-h-dvh">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/espace-client" aria-label="Accueil de l'espace client">
            <PortalBrand />
          </Link>
          <div className="flex items-center gap-3">
            {admin?.session.twoFactorVerified && (
              <Link href="/admin" title={`${admin.user.name}, espace administration`} className="rounded-full">
                <Avatar name={admin.user.name} src={adminAvatar} className="size-8" />
                <span className="sr-only">Espace administration</span>
              </Link>
            )}
            <span className="flex items-center gap-2.5" title={client.name}>
              <Avatar name={client.name} className="size-8" />
              <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground sm:block">{client.name}</span>
            </span>
            <form action={portalLogoutAction}>
              <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm hover:bg-surface">
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sr-only sm:hidden">Déconnexion</span>
              </button>
            </form>
          </div>
        </div>
        <PortalNav />
      </header>
      <main id="contenu" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
