import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TotpSetupForm } from "@/components/admin/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, readSessionToken } from "@/server/auth/session";
import { startTotpSetup } from "@/server/services/auth";

export const metadata: Metadata = { title: "Configurer la double authentification" };

function groupSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export default async function TotpSetupPage() {
  const token = await readSessionToken("admin");
  const setup = token ? await startTotpSetup(token) : null;

  // After confirmation the session is upgraded and this page re-renders:
  // the form keeps its client state so the backup codes stay visible.
  if (!setup) {
    const current = await getSession("admin");
    if (!current?.session.twoFactorVerified || !current.user.totpEnabledAt) {
      redirect("/admin/login?raison=expiree");
    }
  }

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Configurer la double authentification</CardTitle>
        <CardDescription>
          Obligatoire pour accéder à l&apos;administration. Scannez ce QR code avec une application comme
          Google Authenticator, Aegis, 1Password ou Bitwarden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {setup ? (
          <div className="flex flex-col items-center gap-3">
            {/* Data URL generated on the server, next/image brings nothing here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrDataUrl}
              width={200}
              height={200}
              alt="QR code de configuration de la double authentification"
              className="rounded-lg bg-white p-2"
            />
            <details className="w-full text-sm">
              <summary className="cursor-pointer text-muted-foreground">Saisie manuelle de la clé</summary>
              <p className="mt-2 break-all rounded-lg border bg-card p-3 text-center font-mono tracking-wider">
                {groupSecret(setup.secret)}
              </p>
            </details>
          </div>
        ) : null}
        <TotpSetupForm alreadyEnabled={!setup} />
      </CardContent>
    </Card>
  );
}
