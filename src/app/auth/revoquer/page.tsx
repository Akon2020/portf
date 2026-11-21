import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { ConfirmTokenForm } from "@/components/admin/recovery-forms";
import { revokeSessionsAction } from "@/server/actions/recovery";

export const metadata: Metadata = { title: "Révoquer les sessions" };

export default async function RevokeSessionsPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  return (
    <AuthCard title="Ce n'était pas moi" description="Toutes les sessions ouvertes sur l'administration seront fermées immédiatement. Changez ensuite votre mot de passe.">
      <ConfirmTokenForm action={revokeSessionsAction.bind(null, jeton)} label="Révoquer toutes les sessions" />
    </AuthCard>
  );
}
