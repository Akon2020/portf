import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = "Isaac Akonkwa, ingénieur logiciel à Bukavu, RDC";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const { cream, navy, orange, green } = siteConfig.colors;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: navy,
          color: cream,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: green,
              color: "white",
              borderRadius: "32px 32px 32px 8px",
              fontSize: 36,
              fontStyle: "italic",
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 28, letterSpacing: 4, color: orange, textTransform: "uppercase" }}>
            Ingénieur logiciel · Bukavu, RDC
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>
            Isaac Akonkwa
          </div>
          <div style={{ fontSize: 38, lineHeight: 1.3, maxWidth: 900, opacity: 0.85 }}>
            Je conçois des produits numériques qui créent un impact réel.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, opacity: 0.7 }}>
          <span>Full-stack · Mobile · IA · Sécurité</span>
          <span>EST. 2020</span>
        </div>
      </div>
    ),
    size,
  );
}
