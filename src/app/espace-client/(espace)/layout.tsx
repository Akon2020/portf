import { LogOut } from "lucide-react";
import Link from "next/link";
import { PortalBrand } from "@/components/portal/brand";
import { PortalNav } from "@/components/portal/portal-nav";
import { portalLogoutAction } from "@/server/actions/portal";
import { requirePortal } from "@/server/services/portal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { client } = await requirePortal();
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
            <span className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:block">{client.name}</span>
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
