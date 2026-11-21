import type { Metadata } from "next";
import Link from "next/link";
import { PortalBrand } from "@/components/portal/brand";
import { ConfirmLinkForm } from "@/components/portal/portal-forms";
import { confirmMagicLinkAction } from "@/server/actions/portal";
import { peekAuthToken } from "@/server/auth/tokens";

export const metadata: Metadata = { title: "Confirmation" };

/** The link only shows a button: opening it (or a mail scanner opening it) never signs in. */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  const valid = jeton ? await peekAuthToken(jeton, "magic_link") : null;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="admin-card w-full max-w-md space-y-6 p-6 sm:p-8">
        <PortalBrand />
        {valid ? (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Confirmer la connexion</h1>
              <p className="mt-2 text-sm text-muted-foreground">Connexion demandée pour {valid.email}.</p>
            </div>
            <ConfirmLinkForm action={confirmMagicLinkAction.bind(null, jeton)} />
          </>
        ) : (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Lien expiré</h1>
            <p className="text-sm text-muted-foreground">Ce lien a déjà servi ou a expiré (15 minutes). Demandez-en un nouveau.</p>
            <Link href="/espace-client/connexion" className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground">
              Recevoir un nouveau lien
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
