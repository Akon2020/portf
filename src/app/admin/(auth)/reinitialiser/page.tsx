import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/admin/recovery-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPasswordAction } from "@/server/actions/recovery";
import { isResetTokenValid } from "@/server/services/account-recovery";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  const valid = jeton ? await isResetTokenValid(jeton) : false;
  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Nouveau mot de passe</CardTitle>
        <CardDescription>Après validation, toutes les sessions sont fermées et le code TOTP reste demandé.</CardDescription>
      </CardHeader>
      <CardContent>
        {valid ? (
          <ResetPasswordForm action={resetPasswordAction.bind(null, jeton)} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Ce lien est invalide ou a expiré.{" "}
            <Link href="/admin/mot-de-passe-oublie" className="underline underline-offset-4">
              Demander un nouveau lien
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
