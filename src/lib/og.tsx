import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const COLORS = { cream: "#F4F0E8", navy: "#0B1626", orange: "#D97706", green: "#16A34A" };

/** Shared Open Graph card in the design system colors. */
export function ogCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string }) {
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
          background: COLORS.navy,
          color: COLORS.cream,
          fontFamily: "serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -160,
            width: 520,
            height: 520,
            borderRadius: 520,
            background: "rgba(217,119,6,0.22)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 60,
              height: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: COLORS.green,
              color: "white",
              borderRadius: "30px 30px 30px 8px",
              fontSize: 34,
              fontStyle: "italic",
            }}
          >
            A
          </div>
          <div style={{ fontSize: 26, letterSpacing: 4, color: COLORS.orange, textTransform: "uppercase", fontFamily: "monospace" }}>
            {eyebrow}
          </div>
        </div>
        <div style={{ fontSize: title.length > 60 ? 64 : 80, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, opacity: 0.75, fontFamily: "sans-serif" }}>
          <span>Isaac Akonkwa</span>
          <span>{footer}</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
