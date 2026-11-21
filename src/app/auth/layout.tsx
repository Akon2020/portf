import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { ThemeScript } from "@/components/admin/theme-script";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Connexion", template: "%s | Administration" },
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="admin-root min-h-dvh bg-background font-sans text-foreground antialiased">
        <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Brand panel, reduced to a header on small screens. */}
          <aside className="relative overflow-hidden bg-[#0B1626] px-6 py-6 text-[#EDE8DE] sm:px-10 lg:flex lg:flex-col lg:justify-between lg:py-12">
            <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-[#D97706]/25 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-0 size-96 rounded-full bg-[#16A34A]/15 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-[50%_50%_50%_6px] bg-[#16A34A] font-heading text-xl font-semibold italic text-white">
                A
              </span>
              <span className="leading-tight">
                <span className="block font-semibold">Isaac Akonkwa</span>
                <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-[#EDE8DE]/60">Administration</span>
              </span>
            </div>
            <div className="relative hidden max-w-md lg:block">
              <p className="font-heading text-4xl leading-tight">Contenu, clients, devis et sécurité, au même endroit.</p>
              <p className="mt-4 text-[#EDE8DE]/70">Espace réservé à la gestion du site et de l&apos;activité.</p>
            </div>
            <p className="relative hidden items-center gap-2 text-sm text-[#EDE8DE]/60 lg:flex">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Connexion chiffrée, tentatives surveillées et limitées.
            </p>
          </aside>
          <main className="flex items-center justify-center px-4 py-10 sm:px-8">
            <div className="w-full max-w-md">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
