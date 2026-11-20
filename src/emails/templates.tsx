import { Button, Heading, Section, Text } from "@react-email/components";
import { COLORS, EmailLayout, button, muted, paragraph } from "./layout";

type Locale = "fr" | "en";

const T = {
  fr: {
    ackPreview: "Votre message a bien été reçu",
    ackHello: (name: string) => `Bonjour ${name},`,
    ackBody: "Merci pour votre message. Je l'ai bien reçu et je vous réponds en général sous 24 à 48 h.",
    ackQuoteBody: "Merci pour votre demande de devis. Je l'étudie et je reviens vers vous en général sous 24 à 48 h.",
    ackRecap: "Rappel de votre message :",
    ackSign: "À très vite,",
    quotePreview: (number: string) => `Votre devis ${number}`,
    quoteHello: (name: string) => `Bonjour ${name},`,
    quoteBody: (number: string, total: string, until: string) =>
      `Vous trouverez ci-joint le devis ${number} d'un montant de ${total}, valable jusqu'au ${until}.`,
    quoteCta: "Consulter et accepter le devis",
    quoteHelp: "Le devis est aussi disponible en PDF en pièce jointe. N'hésitez pas à répondre à cet e-mail pour toute question.",
  },
  en: {
    ackPreview: "Your message has been received",
    ackHello: (name: string) => `Hello ${name},`,
    ackBody: "Thank you for your message. I have received it and usually reply within 24 to 48 hours.",
    ackQuoteBody: "Thank you for your quote request. I am reviewing it and usually reply within 24 to 48 hours.",
    ackRecap: "Your message:",
    ackSign: "Talk soon,",
    quotePreview: (number: string) => `Your quote ${number}`,
    quoteHello: (name: string) => `Hello ${name},`,
    quoteBody: (number: string, total: string, until: string) =>
      `Please find attached quote ${number} for a total of ${total}, valid until ${until}.`,
    quoteCta: "View and accept the quote",
    quoteHelp: "The quote is also attached as a PDF. Feel free to reply to this email with any question.",
  },
};

export function ContactAckEmail({ name, locale, message, kind = "contact" }: { name: string; locale: Locale; message: string; kind?: "contact" | "quote" }) {
  const t = T[locale];
  return (
    <EmailLayout preview={t.ackPreview} locale={locale}>
      <Text style={paragraph}>{t.ackHello(name)}</Text>
      <Text style={paragraph}>{kind === "quote" ? t.ackQuoteBody : t.ackBody}</Text>
      <Text style={muted}>{t.ackRecap}</Text>
      <Section style={{ borderLeft: `3px solid ${COLORS.line}`, paddingLeft: 14, marginBottom: 16 }}>
        <Text style={{ ...muted, whiteSpace: "pre-line" }}>{message.slice(0, 1500)}</Text>
      </Section>
      <Text style={paragraph}>
        {t.ackSign}
        <br />
        Isaac Akonkwa
      </Text>
    </EmailLayout>
  );
}

/** Reply written in the admin. The body is already sanitized HTML. */
export function ReplyEmail({
  bodyHtml,
  locale,
  quoted,
}: {
  bodyHtml: string;
  locale: Locale;
  quoted?: { author: string; date: string; text: string };
}) {
  return (
    <EmailLayout preview={bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 120)} locale={locale}>
      <div style={{ fontSize: 15, lineHeight: "24px" }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Text style={{ ...paragraph, marginTop: 18 }}>
        Isaac Akonkwa
        <br />
        <span style={{ color: COLORS.muted, fontSize: 13 }}>{locale === "en" ? "Software engineer" : "Ingénieur logiciel"}</span>
      </Text>
      {quoted && (
        <Section style={{ borderLeft: `3px solid ${COLORS.line}`, paddingLeft: 14, marginTop: 20 }}>
          <Text style={{ ...muted, fontSize: 12, margin: "0 0 6px" }}>
            {locale === "en" ? `On ${quoted.date}, ${quoted.author} wrote:` : `Le ${quoted.date}, ${quoted.author} a écrit :`}
          </Text>
          <Text style={{ ...muted, whiteSpace: "pre-line" }}>{quoted.text.slice(0, 3000)}</Text>
        </Section>
      )}
    </EmailLayout>
  );
}

export function AdminNotificationEmail({
  title,
  fields,
  body,
  url,
  cta = "Ouvrir dans l'administration",
}: {
  title: string;
  fields: [string, string][];
  body?: string;
  url?: string;
  cta?: string;
}) {
  return (
    <EmailLayout preview={title} footer="Notification automatique du site">
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 16px" }}>
        {title}
      </Heading>
      {fields.map(([label, value]) => (
        <Text key={label} style={{ ...paragraph, margin: "0 0 6px", fontSize: 14 }}>
          <strong>{label} :</strong> {value}
        </Text>
      ))}
      {body && (
        <Section style={{ borderLeft: `3px solid ${COLORS.line}`, paddingLeft: 14, marginTop: 14 }}>
          <Text style={{ ...muted, whiteSpace: "pre-line" }}>{body.slice(0, 4000)}</Text>
        </Section>
      )}
      {url && (
        <Section style={{ marginTop: 20 }}>
          <Button href={url} style={button}>
            {cta}
          </Button>
        </Section>
      )}
    </EmailLayout>
  );
}

export function QuoteEmail({
  name,
  number,
  total,
  validUntil,
  url,
  locale,
  message,
}: {
  name: string;
  number: string;
  total: string;
  validUntil: string;
  url: string;
  locale: Locale;
  message?: string;
}) {
  const t = T[locale];
  return (
    <EmailLayout preview={t.quotePreview(number)} locale={locale}>
      <Text style={paragraph}>{t.quoteHello(name)}</Text>
      {message ? <Text style={{ ...paragraph, whiteSpace: "pre-line" }}>{message}</Text> : null}
      <Text style={paragraph}>{t.quoteBody(number, total, validUntil)}</Text>
      <Section style={{ margin: "8px 0 18px" }}>
        <Button href={url} style={button}>
          {t.quoteCta}
        </Button>
      </Section>
      <Text style={muted}>{t.quoteHelp}</Text>
      <Text style={paragraph}>Isaac Akonkwa</Text>
    </EmailLayout>
  );
}

export function SecurityEmail({
  title,
  lines,
  url,
  cta,
}: {
  title: string;
  lines: string[];
  url?: string;
  cta?: string;
}) {
  return (
    <EmailLayout preview={title} footer="Alerte de sécurité automatique">
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 16px" }}>
        {title}
      </Heading>
      {lines.map((line) => (
        <Text key={line} style={{ ...paragraph, fontSize: 14 }}>
          {line}
        </Text>
      ))}
      {url && cta && (
        <Section style={{ marginTop: 12 }}>
          <Button href={url} style={button}>
            {cta}
          </Button>
        </Section>
      )}
    </EmailLayout>
  );
}
