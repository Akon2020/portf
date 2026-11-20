import type { Metadata } from "next";
import { RequestResetForm } from "@/components/admin/recovery-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestResetAction } from "@/server/actions/recovery";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
        <CardDescription>Un lien de réinitialisation sera envoyé à l&apos;adresse du compte administrateur.</CardDescription>
      </CardHeader>
      <CardContent>
        <RequestResetForm action={requestResetAction} />
      </CardContent>
    </Card>
  );
}
