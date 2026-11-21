import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { RequestResetForm } from "@/components/admin/recovery-forms";
import { requestResetAction } from "@/server/actions/recovery";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  const current = await getSession("admin");
  if (current?.session.twoFactorVerified) redirect("/admin");
  return (
    <AuthCard title="Mot de passe oublié" description="Un lien de réinitialisation sera envoyé à l'adresse du compte administrateur.">
      <RequestResetForm action={requestResetAction} />
    </AuthCard>
  );
}
