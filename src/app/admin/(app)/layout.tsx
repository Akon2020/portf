import { LogOut } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";
import { requireAdmin } from "@/server/auth/guards";
import { unreadCount } from "@/server/services/inbox";
import { newQuoteRequestCount } from "@/server/services/quote-requests";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  const [unread, newRequests] = await Promise.all([unreadCount(), newQuoteRequestCount()]);

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[260px_1fr]">
      <aside className="border-b bg-card/60 px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0 lg:py-6">
        <div className="mb-4 flex items-center justify-between gap-3 lg:mb-8">
          <Link href="/admin" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-[50%_50%_50%_4px] bg-brand font-bold italic text-white"
            >
              A
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">Isaac Akonkwa</span>
              <span className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Administration
              </span>
            </span>
          </Link>
        </div>
        <AdminNav badges={{ "/admin/messagerie": unread, "/admin/devis": newRequests }} />
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-8">
          <p className="truncate text-sm text-muted-foreground">
            Connecté en tant que <span className="font-medium text-foreground">{user.name}</span>
          </p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut aria-hidden="true" />
              Déconnexion
            </Button>
          </form>
        </header>
        <main className="px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
