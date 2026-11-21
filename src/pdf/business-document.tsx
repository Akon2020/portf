import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney, type Currency } from "@/lib/money";
import type { IssuerSettings } from "@/server/content/settings-schema";

const NB = String.fromCharCode(0xa0);

const INK = "#132238";
const MUTED = "#5B6676";
const LINE = "#E5E1D8";

/** Mixes a hex color with white: 0 keeps the color, 1 gives white. */
export function tint(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => Math.round(channel + (255 - channel) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** White text on dark brand colors, ink on light ones (WCAG relative luminance). */
export function textOn(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? INK : "#FFFFFF";
}

const styles = StyleSheet.create({
  page: { paddingBottom: 64, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.45 },
  band: { paddingHorizontal: 44, paddingTop: 30, paddingBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoBox: { width: 54, height: 54, borderRadius: 10, backgroundColor: "#FFFFFF", padding: 5, marginRight: 12, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 44 },
  row: { flexDirection: "row" },
  muted: { color: MUTED },
  label: { fontSize: 7, letterSpacing: 1.2, color: MUTED, textTransform: "uppercase", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  card: { borderRadius: 6, padding: 12 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 7, textTransform: "uppercase", letterSpacing: 0.6 },
  td: { paddingVertical: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 10 },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 44, textAlign: "right" },
  colPrice: { width: 90, textAlign: "right" },
  colTotal: { width: 94, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 10 },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, fontSize: 7.5, color: MUTED, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 8 },
});

export type DocLocale = "fr" | "en";

export const PDF_LABELS = {
  fr: {
    number: "N°",
    to: "Facturé à",
    from: "Émetteur",
    subject: "Objet",
    description: "Description",
    qty: "Qté",
    unit: "Prix unitaire",
    total: "Total",
    subtotal: "Sous-total",
    discount: "Remise",
    tax: "Taxe",
    approx: (amount: string) => `Soit environ ${amount} au taux indicatif de`,
    page: (n: number, total: number) => `Page ${n} sur ${total}`,
    draft: "BROUILLON",
  },
  en: {
    number: "No.",
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
    approx: (amount: string) => `About ${amount} at the indicative rate of`,
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
  /** Summary of the whole engagement (quote total, payments, remaining), for deposits and receipts. */
  engagement?: { title: string; rows: { label: string; amount: number; strong?: boolean }[] } | null;
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

export function BusinessDocument({ data, issuer, logo }: { data: BusinessDocumentData; issuer: IssuerSettings; logo: string | null }) {
  const { locale } = data;
  const L = PDF_LABELS[locale];
  const brand = /^#[0-9a-f]{6}$/i.test(issuer.brandColor) ? issuer.brandColor : "#C2410C";
  const onBrand = textOn(brand);
  const soft = tint(brand, 0.9);
  const softer = tint(brand, 0.95);
  const money = (cents: number) => formatMoney(cents, data.currency, locale);
  const approx = approximate(data);
  // French typography: non-breaking space before the colon.
  const colon = locale === "fr" ? `${NB}: ` : ": ";
  const stampColor = data.stamp ? { success: "#15803D", danger: "#B91C1C", accent: brand }[data.stamp.tone] : INK;

  return (
    <Document title={`${data.heading} ${data.number ?? ""}`.trim()} author={issuer.name} creator={issuer.name} language={locale}>
      <Page size="A4" style={styles.page}>
        {/* Header band in the brand color, with the logo. */}
        <View style={[styles.band, { backgroundColor: brand }]} fixed={false}>
          <View style={[styles.row, { alignItems: "center", maxWidth: 300 }]}>
            {logo ? (
              <View style={styles.logoBox}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
                <Image src={logo} style={{ maxWidth: 44, maxHeight: 44, objectFit: "contain" }} />
              </View>
            ) : null}
            <View>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 15, color: onBrand }}>{issuer.businessName || issuer.name}</Text>
              {issuer.businessName ? <Text style={{ color: onBrand, opacity: 0.85 }}>{issuer.name}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.15, letterSpacing: 1.5, color: onBrand }}>{data.number ? data.heading : `${data.heading} (${L.draft})`}</Text>
            {data.number ? (
              <Text style={{ color: onBrand, fontSize: 10.5, marginTop: 6 }}>
                {L.number} {data.number}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          {/* Issuer details and dates. */}
          <View style={[styles.row, { justifyContent: "space-between", marginTop: 16 }]}>
            <View style={{ maxWidth: 280 }}>
              {issuer.address ? <Text style={styles.muted}>{issuer.address}</Text> : null}
              {[issuer.phone, issuer.email, issuer.website].filter(Boolean).length ? (
                <Text style={styles.muted}>{[issuer.phone, issuer.email, issuer.website].filter(Boolean).join("  ·  ")}</Text>
              ) : null}
              {issuer.legalIds ? <Text style={[styles.muted, { marginTop: 2, fontSize: 8 }]}>{issuer.legalIds}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {data.dates.map(([label, value]) => (
                <Text key={label}>
                  <Text style={styles.muted}>
                    {label}
                    {colon}
                  </Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{value}</Text>
                </Text>
              ))}
            </View>
          </View>

          {/* Recipient and subject. */}
          <View style={[styles.row, { marginTop: 18, gap: 12 }]}>
            <View style={[styles.card, { flex: 1, backgroundColor: softer, borderLeftWidth: 3, borderLeftColor: brand }]}>
              <Text style={styles.label}>{L.to}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{data.recipient.name}</Text>
              {data.recipient.lines.filter(Boolean).map((line) => (
                <Text key={line} style={styles.muted}>
                  {line}
                </Text>
              ))}
            </View>
            <View style={[styles.card, { flex: 1, backgroundColor: softer, borderLeftWidth: 3, borderLeftColor: brand }]}>
              <Text style={styles.label}>{L.subject}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{data.subject}</Text>
            </View>
          </View>

          {/* Lines. */}
          {data.items.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <View style={[styles.tableRow, { backgroundColor: brand, borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4 }]} fixed>
                <Text style={[styles.th, styles.colDesc, { color: onBrand }]}>{L.description}</Text>
                <Text style={[styles.th, styles.colQty, { color: onBrand }]}>{L.qty}</Text>
                <Text style={[styles.th, styles.colPrice, { color: onBrand }]}>{L.unit}</Text>
                <Text style={[styles.th, styles.colTotal, { color: onBrand }]}>{L.total}</Text>
              </View>
              {data.items.map((item, index) => (
                <View key={item.id} style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: softer } : {}]} wrap={false}>
                  <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
                  <Text style={[styles.td, styles.colQty]}>{formatQuantity(item.quantity, locale)}</Text>
                  <Text style={[styles.td, styles.colPrice]}>{money(item.unitPrice)}</Text>
                  <Text style={[styles.td, styles.colTotal, { fontFamily: "Helvetica-Bold" }]}>{money(item.total)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* QR code and totals. */}
          <View style={[styles.row, { marginTop: 14 }]} wrap={false}>
            <View style={{ flex: 1, paddingRight: 24 }}>
              {data.qr ? (
                <View style={[styles.row, { alignItems: "center", gap: 10 }]}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
                  <Image src={data.qr.dataUrl} style={{ width: 66, height: 66 }} />
                  <Text style={[styles.muted, { maxWidth: 150, fontSize: 8.5 }]}>{data.qr.label}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ width: 240 }}>
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
                  <View style={[styles.totalRow, { backgroundColor: soft, borderRadius: 4, paddingVertical: 7, marginTop: 4 }]}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.grandLabel}</Text>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11.5 }}>{money(data.totals.total)}</Text>
                  </View>
                </>
              ) : null}
              {data.extraRows.map((row) =>
                row.strong ? (
                  <View key={row.label} style={[styles.totalRow, { backgroundColor: brand, borderRadius: 4, paddingVertical: 8, marginTop: 4 }]}>
                    <Text style={{ fontFamily: "Helvetica-Bold", color: onBrand }}>{row.label}</Text>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, color: onBrand }}>{money(row.amount)}</Text>
                  </View>
                ) : (
                  <View key={row.label} style={styles.totalRow}>
                    <Text style={styles.muted}>{row.label}</Text>
                    <Text>{money(row.amount)}</Text>
                  </View>
                ),
              )}
              {approx ? <Text style={[styles.muted, { fontSize: 7.5, textAlign: "right", marginTop: 4, paddingHorizontal: 10 }]}>{approx}</Text> : null}
            </View>
          </View>

          {data.stamp ? (
            <View style={{ marginTop: 14, alignSelf: "flex-start", borderWidth: 1.5, borderColor: stampColor, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 10 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: stampColor, letterSpacing: 0.8 }}>{data.stamp.text}</Text>
            </View>
          ) : null}

          {/* Engagement summary: the total to pay and what remains, across every invoice and payment. */}
          {data.engagement ? (
            <View style={[styles.card, { marginTop: 16, borderWidth: 1, borderColor: tint(brand, 0.6) }]} wrap={false}>
              <Text style={[styles.label, { color: brand }]}>{data.engagement.title}</Text>
              {data.engagement.rows.map((row) => (
                <View key={row.label} style={[styles.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
                  <Text style={row.strong ? { fontFamily: "Helvetica-Bold" } : styles.muted}>{row.label}</Text>
                  <Text style={row.strong ? { fontFamily: "Helvetica-Bold", color: brand } : {}}>{money(row.amount)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {data.sections
            .filter(([, text]) => text)
            .map(([label, text]) => (
              <View key={label} style={{ marginTop: 14 }} wrap={false}>
                <Text style={[styles.label, { color: brand }]}>{label}</Text>
                <Text>{text}</Text>
              </View>
            ))}
        </View>

        <View style={[styles.footer, { borderTopColor: brand }]} fixed>
          <Text style={{ maxWidth: 400 }}>{issuer.footer || `${issuer.businessName || issuer.name}${issuer.address ? `, ${issuer.address}` : ""}`}</Text>
          <Text render={({ pageNumber, totalPages }) => L.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
