import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: siteConfig.colors.green,
          color: "white",
          borderRadius: "32px 32px 32px 8px",
          fontSize: 40,
          fontStyle: "italic",
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    size,
  );
}
