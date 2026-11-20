import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { RequestResetForm } from "@/components/admin/recovery-forms";
import { requestResetAction } from "@/server/actions/recovery";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Mot de passe oublié" description="Un lien de réinitialisation sera envoyé à l'adresse du compte administrateur.">
      <RequestResetForm action={requestResetAction} />
    </AuthCard>
  );
}
