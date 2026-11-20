import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoFactorForm } from "@/components/admin/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelLoginAction } from "@/server/actions/auth";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Double authentification" };

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const current = await getSession("admin");
  if (!current) redirect("/admin/login?raison=expiree");
  if (current.session.twoFactorVerified) redirect("/admin");
  if (!current.user.totpEnabledAt) redirect("/admin/2fa/configuration");

  const { next } = await searchParams;

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Double authentification</CardTitle>
        <CardDescription>
          Saisissez le code affiché par votre application d&apos;authentification, ou un code de secours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TwoFactorForm next={next} />
        <form action={cancelLoginAction}>
          <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Annuler et revenir à la connexion
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
