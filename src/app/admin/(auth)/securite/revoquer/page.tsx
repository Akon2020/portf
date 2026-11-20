import type { Metadata } from "next";
import { ConfirmTokenForm } from "@/components/admin/recovery-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { revokeSessionsAction } from "@/server/actions/recovery";

export const metadata: Metadata = { title: "Révoquer les sessions" };

export default async function RevokeSessionsPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Ce n&apos;était pas moi</CardTitle>
        <CardDescription>
          Toutes les sessions ouvertes sur l&apos;administration seront fermées immédiatement. Changez ensuite votre mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmTokenForm action={revokeSessionsAction.bind(null, jeton)} label="Révoquer toutes les sessions" />
      </CardContent>
    </Card>
  );
}
