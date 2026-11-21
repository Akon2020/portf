import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { TwoFactorForm } from "@/components/admin/auth-forms";
import { cancelLoginAction } from "@/server/actions/auth";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Double authentification" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const current = await getSession("admin");
  if (!current) redirect("/auth/login?raison=expiree");
  if (current.session.twoFactorVerified) redirect("/admin");
  const { next } = await searchParams;

  return (
    <AuthCard title="Double authentification" description="Saisissez le code de votre application d'authentification, ou un code de secours.">
      <TwoFactorForm next={next} />
      <form action={cancelLoginAction}>
        <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Annuler et revenir à la connexion
        </button>
      </form>
    </AuthCard>
  );
}
