import { FileText, Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ReplyBox } from "@/components/admin/reply-box";
import { ActionButton, Badge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { convertToClientAction, replyAction, setStatusAction } from "@/server/actions/inbox";
import { requireAdmin } from "@/server/auth/guards";
import { readSettingUncached } from "@/server/content/queries";
import { getConversation } from "@/server/services/inbox-queries";
import { markConversationRead, TOPIC_LABELS } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Conversation" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
const DELIVERY = { received: null, queued: "En attente d'envoi", sent: "Envoyé", failed: "Échec d'envoi" } as const;

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getConversation(id);
  if (!data) notFound();
  await markConversationRead(id);
  const templates = (await readSettingUncached("templates")).replies;
  const { conversation, contact, thread, quoteRequest } = data;
  const wa = contact.phone ? whatsappLink(contact.phone) : null;

  return (
    <>
      <PageHeader
        title={conversation.subject}
        back={{ href: "/admin/messagerie", label: "Messagerie" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {contact.name} · <a href={`mailto:${contact.email}`} className="underline underline-offset-4">{contact.email}</a>
            </span>
            {contact.phone && <span>· {contact.phone}</span>}
            <Badge>{contact.locale.toUpperCase()}</Badge>
            {conversation.topic && <Badge>{TOPIC_LABELS.fr[conversation.topic as keyof (typeof TOPIC_LABELS)["fr"]] ?? conversation.topic}</Badge>}
          </span>
        }
        actions={
          <>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs hover:bg-surface">
                WhatsApp
              </a>
            )}
            {contact.clientId ? (
              <Badge tone="success">Client</Badge>
            ) : (
              <ActionButton action={convertToClientAction.bind(null, contact.id, conversation.id)} label="Convertir en client" />
            )}
            <Link href={`/admin/devis/emis/nouveau?conversation=${conversation.id}`} className="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs hover:bg-surface">
              Créer un devis
            </Link>
            {conversation.status === "closed" ? (
              <ActionButton action={setStatusAction.bind(null, conversation.id, "open")} label="Rouvrir" />
            ) : (
              <ActionButton action={setStatusAction.bind(null, conversation.id, "closed")} label="Fermer" />
            )}
            {conversation.status !== "spam" && (
              <ActionButton action={setStatusAction.bind(null, conversation.id, "spam")} label="Spam" className="text-destructive" />
            )}
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <ol className="space-y-4">
            {thread.map(({ message, authorName }) => {
              const inbound = message.direction === "inbound";
              const automatic = !inbound && !message.authorId;
              const card = (
                <div className={cn("rounded-xl border p-4", inbound ? "bg-card" : "bg-surface/60")}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {inbound ? contact.name : automatic ? "Accusé de réception automatique" : (authorName ?? "Isaac Akonkwa")}
                    </span>
                    <span className="flex items-center gap-2">
                      {DELIVERY[message.deliveryStatus] && (
                        <Badge tone={message.deliveryStatus === "sent" ? "success" : message.deliveryStatus === "failed" ? "danger" : "warning"}>
                          {DELIVERY[message.deliveryStatus]}
                        </Badge>
                      )}
                      <time dateTime={message.sentAt.toISOString()}>{dateFormat.format(message.sentAt)}</time>
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.bodyText}</p>
                  {message.attachments.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {message.attachments.map((file) => (
                        <li key={file.id}>
                          <a href={`/api/admin/fichiers/${file.id}`} className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs hover:bg-surface">
                            <Paperclip className="size-3" aria-hidden="true" />
                            {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.deliveryError && <p className="mt-2 text-xs text-destructive">{message.deliveryError}</p>}
                </div>
              );
              return (
                <li key={message.id} className={cn(inbound ? "mr-8" : "ml-8")}>
                  {automatic ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">Accusé de réception envoyé le {dateFormat.format(message.sentAt)}</summary>
                      <div className="mt-2">{card}</div>
                    </details>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ol>
          {conversation.status !== "spam" && (
            <ReplyBox action={replyAction.bind(null, conversation.id)} templates={templates} recipient={contact.email} />
          )}
        </div>

        {quoteRequest && (
          <aside className="space-y-3 rounded-xl border bg-card p-5 xl:sticky xl:top-6 xl:self-start">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
              <FileText className="size-4 text-accent" aria-hidden="true" />
              Demande de devis
            </h2>
            <Link href={`/admin/devis/${quoteRequest.id}`} className="text-sm underline underline-offset-4">
              Ouvrir la demande
            </Link>
          </aside>
        )}
      </div>
    </>
  );
}
