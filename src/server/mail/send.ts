import { randomUUID } from "node:crypto";
import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";
import { getSiteUrl } from "@/lib/site";
import { enqueueJob } from "../jobs/queue";
import { getMailTransport } from "./transport";

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
  cc?: string;
  /** Threading: Message-ID of the message we reply to, and the full chain. */
  inReplyTo?: string | null;
  references?: string[];
  attachments?: MailAttachment[];
}

export interface SentMail {
  messageId: string;
  preview?: string;
}

function mailDomain(): string {
  const from = process.env.MAIL_FROM ?? "";
  const match = from.match(/@([^>\s]+)/);
  return match?.[1] ?? getSiteUrl().hostname;
}

export function newMessageId(): string {
  return `<${randomUUID()}@${mailDomain()}>`;
}

export function mailFrom(): string {
  return process.env.MAIL_FROM || `"Isaac Akonkwa" <no-reply@${mailDomain()}>`;
}

/** Renders a React Email template and sends it. Throws on failure. */
export async function sendMail(mail: OutgoingMail, messageId = newMessageId()): Promise<SentMail> {
  const html = await render(mail.react);
  const text = toPlainText(html);
  const references = mail.references?.filter(Boolean) ?? [];
  const result = await getMailTransport().send({
    from: mailFrom(),
    to: mail.to,
    cc: mail.cc,
    replyTo: mail.replyTo ?? process.env.MAIL_REPLY_TO ?? undefined,
    subject: mail.subject,
    html,
    text,
    messageId,
    inReplyTo: mail.inReplyTo ?? undefined,
    references: references.length > 0 ? references.join(" ") : undefined,
    attachments: mail.attachments,
    headers: { "X-Auto-Response-Suppress": "OOF" },
  });
  return { messageId, preview: result.preview };
}

/**
 * Sends now and falls back to the job queue when SMTP fails, so a slow or
 * unavailable mail server never breaks the visitor's request.
 */
export async function sendMailOrQueue(
  mail: { to: string; subject: string; html: string; text: string; replyTo?: string; inReplyTo?: string | null; references?: string[] },
  messageId = newMessageId(),
): Promise<{ sent: boolean; messageId: string; error?: string }> {
  try {
    await getMailTransport().send({
      from: mailFrom(),
      to: mail.to,
      replyTo: mail.replyTo ?? process.env.MAIL_REPLY_TO ?? undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      messageId,
      inReplyTo: mail.inReplyTo ?? undefined,
      references: mail.references?.length ? mail.references.join(" ") : undefined,
    });
    return { sent: true, messageId };
  } catch (error) {
    await enqueueJob("mail.raw", { ...mail, messageId }, { maxAttempts: 5 });
    return { sent: false, messageId, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function renderMail(react: ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(react);
  return { html, text: toPlainText(html) };
}
