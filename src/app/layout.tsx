import { Analytics } from "@vercel/analytics/next";
import { Inter, Poppins } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { getSiteUrl, siteConfig } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const defaultTitle = `${siteConfig.name} | ${siteConfig.title.fr}`;

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: defaultTitle, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description.fr,
  openGraph: {
    title: defaultTitle,
    description: siteConfig.description.fr,
    url: "/",
    siteName: siteConfig.name,
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: siteConfig.description.fr,
    creator: "@akon1703",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: siteConfig.colors.cream },
    { media: "(prefers-color-scheme: dark)", color: siteConfig.colors.navy },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${poppins.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === "production" && process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
