import { and, count, desc, eq, isNull } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/guards";
import { reviewQueue } from "@/server/content/admin-queries";
import { getDb } from "@/server/db";
import { backupCodes, loginAttempts } from "@/server/db/schema";

export const metadata: Metadata = { title: "Tableau de bord" };

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lubumbashi",
});

const REASON_LABELS: Record<string, string> = {
  password_ok: "Mot de passe correct",
  totp_ok: "Code TOTP valide",
  totp_setup_ok: "2FA activée",
  backup_code_ok: "Code de secours utilisé",
  wrong_password: "Mot de passe incorrect",
  unknown_email: "E-mail inconnu",
  rate_limited: "Limite de débit atteinte",
  locked: "Compte verrouillé",
  locked_now: "Verrouillage déclenché",
  totp_invalid: "Code TOTP invalide",
  totp_replay: "Code TOTP rejoué",
  totp_rate_limited: "Trop de codes TOTP",
  backup_code_invalid: "Code de secours invalide",
  not_allowed: "Compte non autorisé",
  totp_setup_invalid: "Code de configuration invalide",
};

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();
  const db = getDb();

  const [[{ remaining }], attempts, queue] = await Promise.all([
    db
      .select({ remaining: count() })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, user.id), isNull(backupCodes.usedAt))),
    db.select().from(loginAttempts).orderBy(desc(loginAttempts.createdAt)).limit(10),
    reviewQueue(),
  ]);
  const toReview = queue.projects.length + queue.journey.length + queue.testimonials.length + queue.media.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-muted-foreground">
          Visites, messages, devis, factures et tâches arriveront avec les prochaines phases.
        </p>
      </div>

      {toReview > 0 && (
        <Link
          href="/admin/a-valider"
          className="flex items-center justify-between gap-4 rounded-xl border border-warning/40 bg-warning/5 p-5 hover:bg-warning/10"
        >
          <span>
            <span className="block font-medium">{toReview} éléments à valider</span>
            <span className="block text-sm text-muted-foreground">Contenus importés ou incohérents à confirmer avant publication.</span>
          </span>
          <span className="text-sm font-medium text-warning">Ouvrir</span>
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              Sécurité du compte
            </CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Double authentification</dt>
              <dd>{user.totpEnabledAt ? `Active depuis le ${dateTime.format(user.totpEnabledAt)}` : "Inactive"}</dd>
              <dt className="text-muted-foreground">Codes de secours restants</dt>
              <dd className={remaining <= 3 ? "font-medium text-destructive" : undefined}>{remaining} sur 10</dd>
              <dt className="text-muted-foreground">Dernière connexion</dt>
              <dd>
                {user.lastLoginAt ? `${dateTime.format(user.lastLoginAt)} (${user.lastLoginIp ?? "IP inconnue"})` : "Aucune"}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dernières tentatives de connexion</CardTitle>
            <CardDescription>Le journal complet sera disponible dans Monitoring.</CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune tentative enregistrée.</p>
            ) : (
              <ul className="divide-y text-sm">
                {attempts.map((attempt) => (
                  <li key={attempt.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className={attempt.success ? "text-success" : "text-destructive"}>
                        {REASON_LABELS[attempt.reason ?? ""] ?? attempt.reason}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {attempt.email} · {attempt.ip}
                      </span>
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={attempt.createdAt.toISOString()}>
                      {dateTime.format(attempt.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
