import { headers } from "next/headers";
import { THEME_SCRIPT } from "@/lib/theme-script";

/** Applies the saved theme before paint, with the CSP nonce of private areas. */
export async function ThemeScript() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
