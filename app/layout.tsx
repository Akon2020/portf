import { Analytics } from "@vercel/analytics/next";
import { Inter, Poppins } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Isaac Akonkwa | Ingénieur logiciel",
  description:
    "Portfolio d’Isaac Akonkwa, ingénieur logiciel full-stack, builder et mentor basé à Bukavu, RDC.",
  openGraph: {
    title: "Isaac Akonkwa | Ingénieur logiciel",
    description:
      "Portfolio d’Isaac Akonkwa, ingénieur logiciel full-stack, builder et mentor basé à Bukavu, RDC.",
    url: "https://isaacakon.com",
    siteName: "Isaac Akonkwa",
    images: [
      {
        url: "/image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  icons: {
    icon: [
      {
        url: "/image.jpg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/image.jpg",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/image.jpg",
        type: "image/jpg",
      },
    ],
    apple: "/image.jpg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
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
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
