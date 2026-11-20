import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { readSettingUncached } from "@/server/content/queries";
import type { Quote, QuoteItem } from "@/server/db/schema";
import { publicQuoteUrl } from "@/server/services/quotes";
import { QuoteDocument } from "./quote-document";

/** Renders the quote PDF. Drafts have no public link, so no QR code. */
export async function renderQuotePdf(quote: Quote, items: QuoteItem[]): Promise<Buffer> {
  const issuer = await readSettingUncached("issuer");
  const qrDataUrl = quote.status === "draft" ? null : await QRCode.toDataURL(publicQuoteUrl(quote.publicToken), { margin: 0, width: 220 });
  const element = createElement(QuoteDocument, { quote, items, issuer, qrDataUrl }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
