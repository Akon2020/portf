import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/auth-card";
import { ResetPasswordForm } from "@/components/admin/recovery-forms";
import { resetPasswordAction } from "@/server/actions/recovery";
import { isResetTokenValid } from "@/server/services/account-recovery";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  const valid = jeton ? await isResetTokenValid(jeton) : false;
  return (
    <AuthCard title="Nouveau mot de passe" description="Après validation, toutes les sessions ouvertes sont fermées.">
      {valid ? (
        <ResetPasswordForm action={resetPasswordAction.bind(null, jeton)} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Ce lien est invalide ou a expiré.{" "}
          <Link href="/auth/mot-de-passe-oublie" className="font-medium text-accent underline-offset-4 hover:underline">
            Demander un nouveau lien
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
