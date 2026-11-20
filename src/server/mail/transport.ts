import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";

export interface MailTransport {
  send(message: SendMailOptions): Promise<{ messageId: string; preview?: string }>;
  kind: "smtp" | "outbox";
}

let cached: MailTransport | undefined;

function outboxDir(): string {
  return resolve(process.env.MAIL_OUTBOX_DIR ?? join(process.env.DATA_DIR ?? "./portfolio_data", "mail-outbox"));
}

/**
 * SMTP of the domain mailbox when configured. Without SMTP (development),
 * messages are written as .eml files in the outbox folder so they can be
 * opened in any mail client.
 */
export function getMailTransport(): MailTransport {
  if (cached) return cached;
  if (process.env.SMTP_HOST) {
    const smtp: Transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? "true") !== "false",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    cached = {
      kind: "smtp",
      async send(message) {
        const info = await smtp.sendMail(message);
        return { messageId: info.messageId };
      },
    };
  } else {
    const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    cached = {
      kind: "outbox",
      async send(message) {
        const info = await stream.sendMail(message);
        const dir = outboxDir();
        await mkdir(dir, { recursive: true });
        const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.eml`);
        await writeFile(file, info.message as Buffer);
        return { messageId: info.messageId, preview: file };
      },
    };
  }
  return cached;
}

/** Used by the healthcheck and the admin SMTP test. */
export async function verifySmtp(): Promise<string> {
  if (!process.env.SMTP_HOST) return "non configuré, envoi vers la boîte locale";
  const smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await smtp.verify();
  return `${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 465} OK`;
}
