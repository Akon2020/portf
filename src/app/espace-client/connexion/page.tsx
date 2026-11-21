import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalBrand } from "@/components/portal/brand";
import { MagicLinkForm } from "@/components/portal/portal-forms";
import { requestMagicLinkAction } from "@/server/actions/portal";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ ferme?: string }> }) {
  const session = await getSession("client");
  const { ferme } = await searchParams;
  if (session && !ferme) redirect("/espace-client");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="admin-card w-full max-w-md space-y-6 p-6 sm:p-8">
        <PortalBrand />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accéder à mon espace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Saisissez l&apos;adresse e-mail communiquée à Isaac. Vous recevrez un lien de connexion valable 15 minutes, sans mot de passe.
          </p>
        </div>
        {ferme && <p className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">L&apos;accès à cet espace a été fermé. Contactez Isaac pour le rouvrir.</p>}
        <MagicLinkForm action={requestMagicLinkAction} />
      </div>
    </main>
  );
}
