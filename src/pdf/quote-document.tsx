import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney, type Currency } from "@/lib/money";
import type { IssuerSettings } from "@/server/content/settings-schema";
import type { Quote, QuoteItem } from "@/server/db/schema";

const COLORS = { ink: "#132238", muted: "#4F5B6B", line: "#E2DCD0", accent: "#A34B07", soft: "#F4F0E8" };

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 9.5, color: COLORS.ink, lineHeight: 1.45 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  muted: { color: COLORS.muted },
  label: { fontSize: 7.5, letterSpacing: 1, color: COLORS.muted, textTransform: "uppercase", marginBottom: 3 },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 20, color: COLORS.accent, textAlign: "right" },
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
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, fontSize: 7.5, color: COLORS.muted, flexDirection: "row", justifyContent: "space-between" },
});

const LABELS = {
  fr: {
    doc: "DEVIS",
    number: "Numéro",
    issued: "Date d'émission",
    valid: "Valable jusqu'au",
    to: "Destinataire",
    from: "Émetteur",
    subject: "Objet",
    description: "Description",
    qty: "Qté",
    unit: "Prix unitaire",
    total: "Total",
    subtotal: "Sous-total",
    discount: "Remise",
    tax: "Taxe",
    grand: "Total à payer",
    approx: (amount: string) => `Soit environ ${amount} au taux indicatif de`,
    notes: "Notes",
    terms: "Conditions",
    payment: "Modalités de paiement",
    online: "Consulter et accepter ce devis en ligne",
    accepted: (name: string, date: string) => `Accepté en ligne par ${name} le ${date}`,
    page: (n: number, total: number) => `Page ${n} sur ${total}`,
    draft: "BROUILLON",
  },
  en: {
    doc: "QUOTE",
    number: "Number",
    issued: "Issue date",
    valid: "Valid until",
    to: "Bill to",
    from: "From",
    subject: "Subject",
    description: "Description",
    qty: "Qty",
    unit: "Unit price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    grand: "Total due",
    approx: (amount: string) => `About ${amount} at the indicative rate of`,
    notes: "Notes",
    terms: "Terms",
    payment: "Payment details",
    online: "View and accept this quote online",
    accepted: (name: string, date: string) => `Accepted online by ${name} on ${date}`,
    page: (n: number, total: number) => `Page ${n} of ${total}`,
    draft: "DRAFT",
  },
};

function formatQuantity(value: string, locale: "fr" | "en") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 3 }).format(Number(value)).replace(/\u{202F}/gu, " ");
}

/** Conversion shown for information only, USD and CDF are never added. */
function approximate(quote: Quote, locale: "fr" | "en"): string | null {
  if (!quote.exchangeRate) return null;
  const rate = Number(quote.exchangeRate);
  if (!rate) return null;
  const other: Currency = quote.currency === "USD" ? "CDF" : "USD";
  const converted = quote.currency === "USD" ? Math.round(quote.total * rate) : Math.round(quote.total / rate);
  const rateText = `1 USD = ${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(rate).replace(/\u{202F}/gu, " ")} CDF`;
  return `${LABELS[locale].approx(formatMoney(converted, other, locale))} ${rateText}`;
}

export function QuoteDocument({
  quote,
  items,
  issuer,
  qrDataUrl,
}: {
  quote: Quote;
  items: QuoteItem[];
  issuer: IssuerSettings;
  qrDataUrl: string | null;
}) {
  const locale = quote.locale === "en" ? "en" : "fr";
  const L = LABELS[locale];
  const date = (value: string | Date) =>
    new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
      typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value,
    );
  const money = (cents: number) => formatMoney(cents, quote.currency, locale);
  const approx = approximate(quote, locale);

  return (
    <Document title={`${L.doc} ${quote.number ?? ""}`} author={issuer.name} creator={issuer.name} language={locale}>
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
            <Text style={styles.docTitle}>{quote.number ? L.doc : `${L.doc} (${L.draft})`}</Text>
            <View style={{ marginTop: 8, alignItems: "flex-end" }}>
              {quote.number ? (
                <Text>
                  {L.number} : <Text style={{ fontFamily: "Helvetica-Bold" }}>{quote.number}</Text>
                </Text>
              ) : null}
              <Text>
                {L.issued} : {date(quote.issueDate)}
              </Text>
              <Text>
                {L.valid} : {date(quote.validUntil)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.row, { marginTop: 26, gap: 14 }]}>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.label}>{L.to}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{quote.recipientName}</Text>
            {quote.recipientEmail ? <Text style={styles.muted}>{quote.recipientEmail}</Text> : null}
            {quote.recipientPhone ? <Text style={styles.muted}>{quote.recipientPhone}</Text> : null}
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.label}>{L.subject}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{quote.title}</Text>
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <View style={[styles.tableRow, { borderBottomColor: COLORS.ink }]} fixed>
            <Text style={[styles.th, styles.colDesc]}>{L.description}</Text>
            <Text style={[styles.th, styles.colQty]}>{L.qty}</Text>
            <Text style={[styles.th, styles.colPrice]}>{L.unit}</Text>
            <Text style={[styles.th, styles.colTotal]}>{L.total}</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.td, styles.colQty]}>{formatQuantity(item.quantity, locale)}</Text>
              <Text style={[styles.td, styles.colPrice]}>{money(item.unitPrice)}</Text>
              <Text style={[styles.td, styles.colTotal]}>{money(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.row, { marginTop: 14 }]} wrap={false}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            {qrDataUrl ? (
              <View style={[styles.row, { alignItems: "center", gap: 10 }]}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
                <Image src={qrDataUrl} style={{ width: 70, height: 70 }} />
                <Text style={[styles.muted, { maxWidth: 160 }]}>{L.online}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: 230 }}>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>{L.subtotal}</Text>
              <Text>{money(quote.subtotal)}</Text>
            </View>
            {quote.discount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>{L.discount}</Text>
                <Text>- {money(quote.discount)}</Text>
              </View>
            ) : null}
            {quote.taxRate > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>
                  {L.tax} ({(quote.taxRate / 100).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} %)
                </Text>
                <Text>{money(quote.taxAmount)}</Text>
              </View>
            ) : null}
            <View style={styles.grandTotal}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{L.grand}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>{money(quote.total)}</Text>
            </View>
            {approx ? <Text style={[styles.muted, { fontSize: 8, textAlign: "right" }]}>{approx}</Text> : null}
          </View>
        </View>

        {quote.acceptedAt && quote.acceptedBy ? (
          <Text style={{ marginTop: 14, color: "#166534", fontFamily: "Helvetica-Bold" }}>{L.accepted(quote.acceptedBy, date(quote.acceptedAt))}</Text>
        ) : null}

        {[
          [L.notes, quote.notes],
          [L.terms, quote.terms],
          [L.payment, issuer.paymentDetails],
        ]
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
