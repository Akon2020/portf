import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Connexion" };

const REASONS: Record<string, string> = {
  expiree: "Votre session a expiré, reconnectez-vous.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; raison?: string }>;
}) {
  const current = await getSession("admin");
  if (current?.session.twoFactorVerified) redirect("/admin");

  const { next, raison } = await searchParams;
  const notice = raison ? REASONS[raison] : undefined;

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>Accès réservé à l&apos;administration du site.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
