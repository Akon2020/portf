import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { LoginForm } from "@/components/admin/auth-forms";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Connexion" };

const REASONS: Record<string, string> = {
  expiree: "Votre session a expiré, reconnectez-vous.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; raison?: string }> }) {
  const current = await getSession("admin");
  if (current?.session.twoFactorVerified) redirect("/admin");
  const { next, raison } = await searchParams;
  const notice = raison ? REASONS[raison] : undefined;

  return (
    <AuthCard title="Bon retour" description="Connectez-vous pour gérer le site et votre activité.">
      {notice && <p className="rounded-xl border bg-card px-3 py-2.5 text-sm text-muted-foreground">{notice}</p>}
      <LoginForm next={next} />
    </AuthCard>
  );
}
