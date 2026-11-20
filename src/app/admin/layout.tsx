import type { Metadata } from "next";
import { ThemeScript } from "@/components/admin/theme-script";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Administration" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="admin-root min-h-dvh bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
