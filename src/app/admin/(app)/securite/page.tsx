import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import {
  ChangePasswordForm,
  DisableTotpForm,
  EnrollForm,
  RegenerateCodesForm,
} from "@/components/admin/security-forms";
import { Badge } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/guards";
import {
  changePasswordAction,
  confirmEnrollmentAction,
  disableTotpAction,
  regenerateCodesAction,
  revokeOtherSessionsAction,
  startEnrollmentAction,
} from "@/server/actions/security";
import { getDb } from "@/server/db";
import { backupCodes, sessions } from "@/server/db/schema";
import { beginTotpEnrollment } from "@/server/services/auth";

export const metadata: Metadata = { title: "Sécurité du compte" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

function describeAgent(userAgent: string | null): string {
  if (!userAgent) return "Appareil inconnu";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Navigateur";
  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "système inconnu";
  return `${browser} sur ${os}`;
}

function Section({ icon: Icon, title, description, children }: { icon: typeof KeyRound; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="admin-card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function SecurityPage() {
  const { user, session } = await requireAdmin();
  const db = getDb();
  const totpOn = Boolean(user.totpEnabledAt);
  const [enrollment, activeSessions, [{ remaining }]] = await Promise.all([
    !totpOn && user.totpSecretEnc ? beginTotpEnrollment(user.id) : Promise.resolve(null),
    db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), eq(sessions.kind, "admin"), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastSeenAt)),
    db.select({ remaining: count() }).from(backupCodes).where(and(eq(backupCodes.userId, user.id), isNull(backupCodes.usedAt))),
  ]);
  const others = activeSessions.filter((row) => row.id !== session.id).length;

  return (
    <>
      <PageHeader title="Sécurité du compte" description={`Connecté en tant que ${user.email}`} />
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-2">
        <Section
          icon={totpOn ? ShieldCheck : ShieldOff}
          title="Double authentification"
          description="Un code à usage unique généré par une application (Google Authenticator, Aegis, 1Password...) est demandé après le mot de passe."
        >
          {totpOn ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone="success">Active</Badge>
                <span className="text-muted-foreground">
                  Depuis le {dateTime.format(user.totpEnabledAt!)} · {remaining} codes de secours restants sur 10
                </span>
              </div>
              <div className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold">Codes de secours</h3>
                <RegenerateCodesForm action={regenerateCodesAction} />
              </div>
              <div className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold">Désactiver</h3>
                <p className="text-sm text-muted-foreground">Déconseillé : seul le mot de passe protégera alors le compte.</p>
                <DisableTotpForm action={disableTotpAction} />
              </div>
            </div>
          ) : enrollment ? (
            <div className="space-y-5">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Scannez le QR code avec votre application d&apos;authentification.</li>
                <li>Saisissez le code à 6 chiffres affiché pour confirmer.</li>
              </ol>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated on the server */}
                <img src={enrollment.qrDataUrl} alt="QR code de configuration de la double authentification" width={176} height={176} className="size-44 shrink-0 rounded-xl border bg-white p-2" />
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="text-muted-foreground">Impossible de scanner ? Saisissez cette clé manuellement :</p>
                  <code className="block break-all rounded-lg border bg-surface px-3 py-2 font-mono text-xs">{enrollment.secret}</code>
                </div>
              </div>
              <EnrollForm action={confirmEnrollmentAction} />
            </div>
          ) : (
            <div className="space-y-4">
              <Badge tone="warning">Désactivée</Badge>
              <p className="text-sm text-muted-foreground">Recommandé : en cas de fuite du mot de passe, le compte reste protégé.</p>
              <form action={startEnrollmentAction}>
                <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90">
                  <ShieldCheck className="size-4" aria-hidden="true" /> Configurer
                </button>
              </form>
            </div>
          )}
        </Section>

        <Section icon={KeyRound} title="Mot de passe" description="Le changement ferme toutes les autres sessions ouvertes.">
          <ChangePasswordForm action={changePasswordAction} withCode={totpOn} />
        </Section>

        <section className="admin-card p-5 sm:p-6 xl:col-span-2">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <MonitorSmartphone className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Sessions actives</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Appareils actuellement connectés à l&apos;administration.</p>
              </div>
            </div>
            {others > 0 && (
              <form action={revokeOtherSessionsAction}>
                <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-surface">
                  <LogOut className="size-4" aria-hidden="true" /> Déconnecter les autres ({others})
                </button>
              </form>
            )}
          </div>
          <ul className="divide-y">
            {activeSessions.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                  {describeAgent(row.userAgent)}
                  {row.id === session.id && <Badge tone="success">Cet appareil</Badge>}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{row.ip ?? "IP inconnue"}</span>
                <span className="text-xs text-muted-foreground">Vu le {dateTime.format(row.lastSeenAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
