import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

export const COLORS = { cream: "#F4F0E8", ink: "#132238", muted: "#4F5B6B", accent: "#A34B07", line: "#E2DCD0", green: "#16A34A" };

export function EmailLayout({
  preview,
  locale = "fr",
  children,
  footer,
}: {
  preview: string;
  locale?: string;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: COLORS.cream, fontFamily: "Inter, Helvetica, Arial, sans-serif", color: COLORS.ink, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#FFFFFF", borderRadius: 12, border: `1px solid ${COLORS.line}`, padding: "32px 32px 24px" }}>
          <Section>
            <Text style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: 0.4 }}>
              <span style={{ display: "inline-block", width: 22, height: 22, lineHeight: "22px", textAlign: "center", borderRadius: "11px 11px 11px 3px", backgroundColor: COLORS.green, color: "#FFFFFF", fontStyle: "italic", marginRight: 8 }}>
                A
              </span>
              Isaac Akonkwa
            </Text>
          </Section>
          <Section style={{ paddingTop: 16 }}>{children}</Section>
          <Hr style={{ borderColor: COLORS.line, margin: "28px 0 12px" }} />
          <Text style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>
            {footer ?? (locale === "en" ? "Isaac Akonkwa, software engineer, Bukavu, DRC" : "Isaac Akonkwa, ingénieur logiciel, Bukavu, RDC")}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const paragraph = { fontSize: 15, lineHeight: "24px", margin: "0 0 14px" } as const;
export const muted = { ...paragraph, color: COLORS.muted, fontSize: 14 } as const;
export const button = {
  display: "inline-block",
  backgroundColor: COLORS.accent,
  color: "#FFFFFF",
  borderRadius: 999,
  padding: "12px 22px",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
} as const;
