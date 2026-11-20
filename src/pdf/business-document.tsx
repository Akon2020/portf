import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney, type Currency } from "@/lib/money";
import type { IssuerSettings } from "@/server/content/settings-schema";

const NB = String.fromCharCode(0xa0);

const COLORS = { ink: "#132238", muted: "#4F5B6B", line: "#E2DCD0", accent: "#A34B07", success: "#166534", danger: "#991B1B" };

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 9.5, color: COLORS.ink, lineHeight: 1.45 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  muted: { color: COLORS.muted },
  label: { fontSize: 7.5, letterSpacing: 1, color: COLORS.muted, textTransform: "uppercase", marginBottom: 3 },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 20, color: COLORS.accent, textAlign: "right", marginBottom: 6 },
  box: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 4, padding: 10 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: COLORS.muted, paddingVertical: 6 },
  td: { paddingVertical: 7 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.line },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 48, textAlign: "right" },
  colPrice: { width: 88, textAlign: "right" },
  colTotal: { width: 92, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, marginTop: 4, borderTopWidth: 1.5, borderTopColor: COLORS.ink },
  stamp: { marginTop: 14, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, fontSize: 7.5, color: COLORS.muted, flexDirection: "row", justifyContent: "space-between" },
});

export type DocLocale = "fr" | "en";

export const PDF_LABELS = {
  fr: {
    number: "Numéro",
    to: "Destinataire",
    subject: "Objet",
    description: "Description",
    qty: "Qté",
    unit: "Prix unitaire",
    total: "Total",
    subtotal: "Sous-total",
    discount: "Remise",
    tax: "Taxe",
    approx: (amount: string) => `Soit environ ${amount} au taux indicatif de`,
    notes: "Notes",
    terms: "Conditions",
    payment: "Modalités de paiement",
    page: (n: number, total: number) => `Page ${n} sur ${total}`,
    draft: "BROUILLON",
  },
  en: {
    number: "Number",
    to: "Bill to",
    subject: "Subject",
    description: "Description",
    qty: "Qty",
    unit: "Unit price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    approx: (amount: string) => `About ${amount} at the indicative rate of`,
    notes: "Notes",
    terms: "Terms",
    payment: "Payment details",
    page: (n: number, total: number) => `Page ${n} of ${total}`,
    draft: "DRAFT",
  },
};

export interface BusinessDocumentData {
  locale: DocLocale;
  /** QUOTE, INVOICE, RECEIPT in the document language. */
  heading: string;
  number: string | null;
  dates: [string, string][];
  recipient: { name: string; lines: string[] };
  subject: string;
  currency: Currency;
  items: { id: string; description: string; quantity: string; unitPrice: number; total: number }[];
  totals: { subtotal: number; discount: number; taxRate: number; taxAmount: number; total: number } | null;
  grandLabel: string;
  /** Extra rows below the total, for example amount paid and balance. */
  extraRows: { label: string; amount: number; strong?: boolean }[];
  exchangeRate: string | null;
  /** Amount converted for information only (USD and CDF are never added). */
  approxBase: number;
  stamp: { text: string; tone: "success" | "danger" | "accent" } | null;
  sections: [string, string | null | undefined][];
  qr: { dataUrl: string; label: string } | null;
}

function formatQuantity(value: string, locale: DocLocale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 3 }).format(Number(value)).replace(/\u{202F}/gu, " ");
}

function approximate(data: BusinessDocumentData): string | null {
  if (!data.exchangeRate) return null;
  const rate = Number(data.exchangeRate);
  if (!rate) return null;
  const other: Currency = data.currency === "USD" ? "CDF" : "USD";
  const converted = data.currency === "USD" ? Math.round(data.approxBase * rate) : Math.round(data.approxBase / rate);
  const formattedRate = new Intl.NumberFormat(data.locale === "fr" ? "fr-FR" : "en-US").format(rate).replace(/[\u{202F} ]/gu, NB);
  // Non-breaking spaces keep "1 USD = 2 800 CDF" on a single line.
  const rateText = ["1", "USD", "=", formattedRate, "CDF"].join(NB);
  return `${PDF_LABELS[data.locale].approx(formatMoney(converted, other, data.locale))} ${rateText}`;
}

export function BusinessDocument({ data, issuer }: { data: BusinessDocumentData; issuer: IssuerSettings }) {
  const { locale } = data;
  const L = PDF_LABELS[locale];
  const money = (cents: number) => formatMoney(cents, data.currency, locale);
  const approx = approximate(data);
  // French typography: non-breaking space before the colon.
  const colon = locale === "fr" ? `${NB}: ` : ": ";
  const stampColor = data.stamp ? { success: COLORS.success, danger: COLORS.danger, accent: COLORS.accent }[data.stamp.tone] : COLORS.ink;

  return (
    <Document title={`${data.heading} ${data.number ?? ""}`.trim()} author={issuer.name} creator={issuer.name} language={locale}>
      <Page size="A4" style={styles.page}>
        <View style={styles.between}>
          <View style={{ maxWidth: 260 }}>
            <Text style={styles.brand}>{issuer.businessName || issuer.name}</Text>
            {issuer.businessName ? <Text>{issuer.name}</Text> : null}
            {issuer.address ? <Text style={styles.muted}>{issuer.address}</Text> : null}
            {issuer.phone ? <Text style={styles.muted}>{issuer.phone}</Text> : null}
            {issuer.email ? <Text style={styles.muted}>{issuer.email}</Text> : null}
            {issuer.website ? <Text style={styles.muted}>{issuer.website}</Text> : null}
            {issuer.legalIds ? <Text style={[styles.muted, { marginTop: 3 }]}>{issuer.legalIds}</Text> : null}
          </View>
          <View>
            <Text style={styles.docTitle}>{data.number ? data.heading : `${data.heading} (${L.draft})`}</Text>
            <View style={{ marginTop: 8, alignItems: "flex-end" }}>
              {data.number ? (
                <Text>
                  {L.number}
                  {colon}
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.number}</Text>
                </Text>
              ) : null}
              {data.dates.map(([label, value]) => (
                <Text key={label}>
                  {label}
                  {colon}
                  {value}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.row, { marginTop: 26, gap: 14 }]}>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.label}>{L.to}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.recipient.name}</Text>
            {data.recipient.lines.filter(Boolean).map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.label}>{L.subject}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.subject}</Text>
          </View>
        </View>

        {data.items.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <View style={[styles.tableRow, { borderBottomColor: COLORS.ink }]} fixed>
              <Text style={[styles.th, styles.colDesc]}>{L.description}</Text>
              <Text style={[styles.th, styles.colQty]}>{L.qty}</Text>
              <Text style={[styles.th, styles.colPrice]}>{L.unit}</Text>
              <Text style={[styles.th, styles.colTotal]}>{L.total}</Text>
            </View>
            {data.items.map((item) => (
              <View key={item.id} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
                <Text style={[styles.td, styles.colQty]}>{formatQuantity(item.quantity, locale)}</Text>
                <Text style={[styles.td, styles.colPrice]}>{money(item.unitPrice)}</Text>
                <Text style={[styles.td, styles.colTotal]}>{money(item.total)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.row, { marginTop: 14 }]} wrap={false}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            {data.qr ? (
              <View style={[styles.row, { alignItems: "center", gap: 10 }]}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
                <Image src={data.qr.dataUrl} style={{ width: 70, height: 70 }} />
                <Text style={[styles.muted, { maxWidth: 160 }]}>{data.qr.label}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: 230 }}>
            {data.totals ? (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>{L.subtotal}</Text>
                  <Text>{money(data.totals.subtotal)}</Text>
                </View>
                {data.totals.discount > 0 ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.muted}>{L.discount}</Text>
                    <Text>- {money(data.totals.discount)}</Text>
                  </View>
                ) : null}
                {data.totals.taxRate > 0 ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.muted}>
                      {L.tax} ({(data.totals.taxRate / 100).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} %)
                    </Text>
                    <Text>{money(data.totals.taxAmount)}</Text>
                  </View>
                ) : null}
                <View style={styles.grandTotal}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.grandLabel}</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>{money(data.totals.total)}</Text>
                </View>
              </>
            ) : null}
            {data.extraRows.map((row) => (
              <View key={row.label} style={row.strong ? styles.grandTotal : styles.totalRow}>
                <Text style={row.strong ? { fontFamily: "Helvetica-Bold" } : styles.muted}>{row.label}</Text>
                <Text style={row.strong ? { fontFamily: "Helvetica-Bold", fontSize: 12 } : {}}>{money(row.amount)}</Text>
              </View>
            ))}
            {approx ? <Text style={[styles.muted, { fontSize: 8, textAlign: "right" }]}>{approx}</Text> : null}
          </View>
        </View>

        {data.stamp ? <Text style={[styles.stamp, { color: stampColor }]}>{data.stamp.text}</Text> : null}

        {data.sections
          .filter(([, text]) => text)
          .map(([label, text]) => (
            <View key={label} style={{ marginTop: 16 }} wrap={false}>
              <Text style={styles.label}>{label}</Text>
              <Text>{text}</Text>
            </View>
          ))}

        <View style={styles.footer} fixed>
          <Text style={{ maxWidth: 400 }}>{issuer.footer || `${issuer.businessName || issuer.name}${issuer.address ? `, ${issuer.address}` : ""}`}</Text>
          <Text render={({ pageNumber, totalPages }) => L.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
